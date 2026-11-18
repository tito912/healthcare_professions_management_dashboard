// Montaggio comune dei test della schermata Dipendenti: rotte vere (elenco e scheda), repository, funzioni e
// dialoghi finti. Solo per i test (escluso dal build, vedi tsconfig.app.json).
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type CodiceErrore,
  type LeggiDatiPrivatiOutput,
  type Ruolo,
  type SalvaDipendenteInput,
} from '@turni/domain';
import { vi } from 'vitest';
import { Sessione } from '../core/sessione.service';
import { ConfigurazioneRepo } from '../dati/configurazione.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../dati/dipendenti.repo';
import { ElencoReparti } from '../dati/elenco-reparti';
import { RepartiRepo, type RepartoConfigurazione } from '../dati/reparti.repo';
import { TurniRepo, type TurnoSalvato } from '../dati/turni.repo';
import { FunzioniDipendenti } from '../funzioni/dipendenti';
import { ROTTE_DIPENDENTI } from '../pagine/dipendenti/rotte';
import { Dialoghi } from '../ui/dialog';
import { ToastService } from '../ui/toast';
import { elencoFinto, sessioneFinta } from './finti';
import { Component } from '@angular/core';

@Component({ selector: 'app-vuoto', template: 'altrove' })
class Vuoto {}

export interface OpzioniMontaggio {
  readonly ruolo?: Ruolo;
  readonly passo?: RepartoConfigurazione['passo'];
  readonly dipendenti?: readonly DipendenteSalvato[];
  readonly turni?: readonly TurnoSalvato[];
  /** Dati restituiti da `leggiDatiPrivati`; una funzione per far fallire la chiamata. */
  readonly privati?: LeggiDatiPrivatiOutput | (() => Promise<LeggiDatiPrivatiOutput>);
  /** Errore della callable `salva`, come lo restituirebbe il server. */
  readonly erroreSalvataggio?: CodiceErrore;
  readonly letturaReparto?: () => Promise<RepartoConfigurazione | null>;
  readonly letturaDipendenti?: () => Promise<DipendenteSalvato[]>;
  readonly esitoDialogoDisattiva?: string | undefined;
  readonly confermaUscita?: boolean;
}

export function reparto(passo: RepartoConfigurazione['passo']): RepartoConfigurazione {
  return {
    id: 'r1',
    nome: 'Radiologia',
    coordinatoreUid: 'u1',
    passo,
    attribuzioneNotte: 'inizio',
    festivita: { nazionaliEscluse: [], locali: [] },
  };
}

/** Errore come lo restituisce una callable: `details.codice`. */
export function erroreFunzione(codice: CodiceErrore): Error {
  return Object.assign(new Error('rifiutata'), { code: 'functions/failed', details: { codice } });
}

export async function montaDipendenti(url: string, opzioni: OpzioniMontaggio = {}) {
  const ruolo = opzioni.ruolo ?? 'COORDINATORE';
  const salvataggi: SalvaDipendenteInput[] = [];
  const letture: { repartoId: string; dipendenteId: string }[] = [];
  const completamenti: { repartoId: string; uid: string }[] = [];
  const funzioni = {
    salva: vi.fn((input: SalvaDipendenteInput) => {
      salvataggi.push(input);
      return opzioni.erroreSalvataggio === undefined
        ? Promise.resolve({ dipendenteId: input.dipendenteId ?? 'nuovo1' })
        : Promise.reject(erroreFunzione(opzioni.erroreSalvataggio));
    }),
    leggiDatiPrivati: vi.fn((input: { repartoId: string; dipendenteId: string }) => {
      letture.push(input);
      const privati = opzioni.privati;
      if (typeof privati === 'function') {
        return privati();
      }
      return privati === undefined
        ? Promise.reject(new Error('non previsto'))
        : Promise.resolve(privati);
    }),
  };
  const dialoghi = {
    conferma: vi.fn(() => Promise.resolve(opzioni.confermaUscita ?? false)),
    apri: vi.fn(() => Promise.resolve(opzioni.esitoDialogoDisattiva)),
  };
  const configurazione = {
    completa: vi.fn((repartoId: string, uid: string) => {
      completamenti.push({ repartoId, uid });
      return Promise.resolve();
    }),
  };
  const elenco = elencoFinto([]);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reparti/:rid/dipendenti', loadChildren: () => ROTTE_DIPENDENTI },
        { path: 'reparti/:rid', component: Vuoto },
        { path: 'reparti/:rid/configurazione', component: Vuoto },
        { path: 'home', component: Vuoto },
      ]),
      { provide: Sessione, useValue: sessioneFinta(ruolo) },
      { provide: ElencoReparti, useValue: elenco },
      {
        provide: RepartiRepo,
        useValue: {
          leggiConfigurazione:
            opzioni.letturaReparto ??
            (() => Promise.resolve(reparto(opzioni.passo ?? 'completata'))),
        },
      },
      {
        provide: DipendentiRepo,
        useValue: {
          elenco:
            opzioni.letturaDipendenti ?? (() => Promise.resolve([...(opzioni.dipendenti ?? [])])),
        },
      },
      {
        provide: TurniRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.turni ?? [])]) },
      },
      { provide: FunzioniDipendenti, useValue: funzioni },
      { provide: ConfigurazioneRepo, useValue: configurazione },
      { provide: Dialoghi, useValue: dialoghi },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await assestati(harness);
  const radice = harness.routeNativeElement as HTMLElement;
  return {
    harness,
    router: TestBed.inject(Router),
    toast: TestBed.inject(ToastService),
    radice: () => harness.fixture.nativeElement as HTMLElement,
    radiceRotta: radice,
    funzioni,
    dialoghi,
    configurazione,
    elenco,
    salvataggi,
    letture,
    completamenti,
  };
}

/** Lascia correre le promesse in sospeso (repository finti asincroni) e aggiorna la vista. */
export async function assestati(harness: RouterTestingHarness): Promise<void> {
  for (let giro = 0; giro < 6; giro++) {
    harness.detectChanges();
    await harness.fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
  }
  harness.detectChanges();
}

export const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

export function scrivi(campo: HTMLInputElement, valore: string): void {
  campo.value = valore;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

export function pulsante(radice: ParentNode, testo: string): HTMLElement {
  const trovato = Array.from(radice.querySelectorAll<HTMLElement>('button, a')).find(
    (b) => testoDi(b) === testo,
  );
  if (trovato === undefined) {
    throw new Error(`Pulsante «${testo}» non trovato`);
  }
  return trovato;
}

export function campoConEtichetta(radice: ParentNode, etichetta: string): HTMLInputElement {
  const etichette = Array.from(radice.querySelectorAll('label')).filter((l) =>
    testoDi(l).startsWith(etichetta),
  );
  const id = etichette[0]?.getAttribute('for');
  const campo =
    id === null || id === undefined ? null : radice.querySelector<HTMLInputElement>(`#${id}`);
  if (campo === null) {
    throw new Error(`Campo «${etichetta}» non trovato`);
  }
  return campo;
}
