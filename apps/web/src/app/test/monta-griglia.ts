// Montaggio comune dei test della griglia: rotta vera, repository e dialoghi finti, giorno di oggi fisso.
// Solo per i test (escluso dal build, vedi tsconfig.app.json).
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  calendarioMese,
  cellaVuota,
  chiaveMese,
  codiceAssenza,
  codiceTurno,
  dataISO,
  oraLocale,
  type CellaDoc,
  type ChiaveGiorno,
  type Ruolo,
} from '@turni/domain';
import { vi } from 'vitest';
import { DATA_OGGI, FINESTRA_MESI_MODIFICABILI } from '../core/ambiente';
import { modificheNonSalvateGuard } from '../core/guardie';
import { Sessione } from '../core/sessione.service';
import { AssenzeRepo, type AssenzaSalvata } from '../dati/assenze.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../dati/dipendenti.repo';
import { MesiRepo, type MeseSalvato } from '../dati/mesi.repo';
import { RepartiRepo, type RepartoConfigurazione } from '../dati/reparti.repo';
import { RigheRepo, type RichiestaSalvaRighe, type RigaSalvata } from '../dati/righe.repo';
import { TurniRepo, type TurnoSalvato } from '../dati/turni.repo';
import { GrigliaPage } from '../pagine/griglia/griglia.page';
import { Dialoghi } from '../ui/dialog';
import { ToastService } from '../ui/toast';
import { sessioneFinta } from './finti';

@Component({ selector: 'app-vuoto-griglia', template: 'altrove' })
class Altrove {}

export const TURNI: readonly TurnoSalvato[] = [
  turno('M1', 'Mattina', 'arancio', '07:00', '14:00', 0),
  turno('P1', 'Pomeriggio', 'verde', '14:00', '22:00', 1),
  turno('N1', 'Notte', 'ardesia', '22:00', '07:00', 2),
  fascia('R1', 'Reperibilità pomeriggio', '14:00', '20:00', 3),
  fascia('R2', 'Reperibilità notte', '20:00', '08:00', 4),
  fascia('R3', 'Reperibilità extra', '08:00', '14:00', 5),
];

export const ASSENZE: readonly AssenzaSalvata[] = [
  assenza('R', 'Riposo', 'comeRiposo', 0),
  assenza('MA', 'Malattia', 'neutra', 1, true),
  assenza('F', 'Ferie', 'neutra', 2),
];

function turno(
  codice: string,
  nome: string,
  colore: TurnoSalvato['colore'],
  inizio: string,
  fine: string,
  ordine: number,
): TurnoSalvato {
  return {
    codice: codiceTurno(codice),
    tipo: 'turno',
    nome,
    colore,
    inizio: oraLocale(inizio),
    fine: oraLocale(fine),
    pausaMinuti: codice === 'N1' ? 0 : 30,
    notturno: codice === 'N1',
    attivo: true,
    ordine,
  };
}

function fascia(
  codice: string,
  nome: string,
  inizio: string,
  fine: string,
  ordine: number,
): TurnoSalvato {
  return {
    ...turno(codice, nome, null, inizio, fine, ordine),
    tipo: 'reperibilita',
    pausaMinuti: 0,
    notturno: fine < inizio,
  };
}

function assenza(
  codice: string,
  descrizione: string,
  effetto: 'comeRiposo' | 'neutra',
  ordine: number,
  malattia = false,
): AssenzaSalvata {
  return {
    codice: codiceAssenza(codice),
    descrizione,
    effetto,
    malattia,
    predefinita: codice === 'R' || codice === 'MA',
    attivo: true,
    ordine,
  };
}

export function dipendente(
  id: string,
  cognome: string,
  nome: string,
  extra: Partial<DipendenteSalvato> = {},
): DipendenteSalvato {
  return {
    id,
    nome,
    cognome,
    oreSettimanali: 36,
    turniEsclusi: [],
    dataAssunzione: null,
    dataCessazione: null,
    attivo: true,
    ...extra,
  };
}

/** Cinque dipendenti, in ordine alfabetico: Bianchi, Bruni, Neri, Rossi (esclude N1), Verdi. */
export const DIPENDENTI: readonly DipendenteSalvato[] = [
  dipendente('d1', 'Rossi', 'Maria', { turniEsclusi: [codiceTurno('N1')] }),
  dipendente('d2', 'Bianchi', 'Laura'),
  dipendente('d3', 'Neri', 'Giovanni'),
  dipendente('d4', 'Verdi', 'Anna'),
  dipendente('d5', 'Bruni', 'Elena'),
];

export function cellaConTurno(codice: string): CellaDoc {
  const t = TURNI.find((x) => x.codice === codice);
  if (t === undefined) {
    throw new Error(`Turno ${codice} non previsto`);
  }
  return {
    ...cellaVuota(),
    turno: {
      codice: t.codice,
      inizio: t.inizio,
      fine: t.fine,
      pausaMinuti: t.pausaMinuti,
      notturno: t.notturno,
    },
  };
}

export function cellaConReperibilita(...codici: string[]): CellaDoc {
  return {
    ...cellaVuota(),
    reperibilita: codici.map((codice) => {
      const t = TURNI.find((x) => x.codice === codice);
      if (t === undefined) {
        throw new Error(`Fascia ${codice} non prevista`);
      }
      return {
        codice: t.codice,
        inizio: t.inizio,
        fine: t.fine,
        chiamate: [],
        sostituisce: null,
        copertaDa: null,
      };
    }),
  };
}

export function rigaSalvata(
  id: string,
  giorni: Partial<Record<ChiaveGiorno, CellaDoc>> = {},
  versione = 1,
): RigaSalvata {
  return {
    dipendenteId: id,
    contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
    giorni,
    grezzi: {},
    versione,
  };
}

export interface OpzioniGriglia {
  readonly ruolo?: Ruolo;
  readonly oggi?: string;
  readonly finestra?: number;
  /** Il mese aperto; null = non creato. */
  readonly mese?: MeseSalvato | null;
  readonly righe?: Readonly<Record<string, readonly RigaSalvata[]>>;
  readonly dipendenti?: readonly DipendenteSalvato[];
  readonly turni?: readonly TurnoSalvato[];
  /** Esito del salvataggio: una funzione per far fallire la chiamata. */
  readonly salva?: (richiesta: RichiestaSalvaRighe) => Promise<ReadonlyMap<string, number>>;
  readonly esitoDialogo?: unknown;
  readonly confermaDialogo?: boolean;
  readonly url?: string;
}

export function mese(chiave: string, stato: 'bozza' | 'convalidato' = 'bozza'): MeseSalvato {
  return {
    chiave: chiaveMese(chiave),
    stato,
    calendario: calendarioMese(chiaveMese(chiave), { nazionaliEscluse: [], locali: [] }, 'inizio'),
    convalidatoIlMs: stato === 'convalidato' ? 1796285640000 : null,
    convalidatoDaNome: stato === 'convalidato' ? 'Maria Rossi' : null,
  };
}

const REPARTO: RepartoConfigurazione = {
  id: 'r1',
  nome: 'Radiologia',
  coordinatoreUid: 'u1',
  passo: 'completata',
  attribuzioneNotte: 'inizio',
  festivita: { nazionaliEscluse: [], locali: [] },
};

export async function montaGriglia(opzioni: OpzioniGriglia = {}) {
  const url = opzioni.url ?? '/reparti/r1/mesi/2026-11';
  const chiaveUrl = url.split('/').at(-1) ?? '2026-11';
  const salvataggi: RichiestaSalvaRighe[] = [];
  const letture: string[] = [];
  const creazioni: { chiave: string; righe: number }[] = [];
  const righeDefault: Record<string, readonly RigaSalvata[]> = {
    '2026-11': DIPENDENTI.map((d) => rigaSalvata(d.id)),
    ...opzioni.righe,
  };
  const righeRepo = {
    leggi: vi.fn((_rid: string, chiave: string) => {
      letture.push(chiave);
      return Promise.resolve([...(righeDefault[chiave] ?? [])]);
    }),
    salva: vi.fn((richiesta: RichiestaSalvaRighe) => {
      salvataggi.push(richiesta);
      return opzioni.salva === undefined
        ? Promise.resolve(
            new Map(richiesta.righe.map((r) => [r.dipendenteId, (r.versioneCaricata ?? 0) + 1])),
          )
        : opzioni.salva(richiesta);
    }),
  };
  const mesiRepo = {
    leggi: vi.fn((_rid: string, chiave: string) =>
      Promise.resolve(opzioni.mese === undefined ? mese(chiave) : opzioni.mese),
    ),
    elenco: vi.fn(() => Promise.resolve([])),
    crea: vi.fn((richiesta: { chiave: string; righe: readonly unknown[] }) => {
      creazioni.push({ chiave: richiesta.chiave, righe: richiesta.righe.length });
      return Promise.resolve();
    }),
  };
  const dialoghi = {
    apri: vi.fn(() => Promise.resolve(opzioni.esitoDialogo)),
    conferma: vi.fn(() => Promise.resolve(opzioni.confermaDialogo ?? false)),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'reparti/:rid/mesi/:chiaveMese',
          component: GrigliaPage,
          canDeactivate: [modificheNonSalvateGuard],
        },
        { path: 'reparti/:rid/dipendenti/:did/anagrafica', component: Altrove },
        { path: 'home', component: Altrove },
      ]),
      { provide: Sessione, useValue: sessioneFinta(opzioni.ruolo ?? 'COORDINATORE') },
      { provide: DATA_OGGI, useValue: () => dataISO(opzioni.oggi ?? '2026-11-03') },
      { provide: FINESTRA_MESI_MODIFICABILI, useValue: opzioni.finestra ?? 2 },
      { provide: RepartiRepo, useValue: { leggiConfigurazione: () => Promise.resolve(REPARTO) } },
      {
        provide: TurniRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.turni ?? TURNI)]) },
      },
      { provide: AssenzeRepo, useValue: { elenco: () => Promise.resolve([...ASSENZE]) } },
      {
        provide: DipendentiRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.dipendenti ?? DIPENDENTI)]) },
      },
      { provide: MesiRepo, useValue: mesiRepo },
      { provide: RigheRepo, useValue: righeRepo },
      { provide: Dialoghi, useValue: dialoghi },
    ],
  });
  localStorage.clear();
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, GrigliaPage);
  await assestatiGriglia(harness);
  const radice = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  return {
    harness,
    router: TestBed.inject(Router),
    toast: TestBed.inject(ToastService),
    radice,
    righeRepo,
    mesiRepo,
    dialoghi,
    salvataggi,
    letture,
    creazioni,
    chiaveUrl,
    assesta: () => assestatiGriglia(harness),
    /** La cella di un dipendente in un giorno. */
    cella: (id: string, giorno: string): HTMLElement => {
      const trovata = Array.from(
        radice().querySelectorAll<HTMLElement>(`[role="gridcell"][data-g="${giorno}"]`),
      ).find((e) => e.getAttribute('data-r') === id);
      if (trovata === undefined) {
        throw new Error(`Cella ${id}/${giorno} non trovata`);
      }
      return trovata;
    },
    tasto: async (elemento: Element, key: string, extra: KeyboardEventInit = {}) => {
      const evento = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...extra,
      });
      elemento.dispatchEvent(evento);
      await assestatiGriglia(harness);
      return evento;
    },
  };
}

/** Lascia correre le promesse e i ridisegni. */
export async function assestatiGriglia(harness: RouterTestingHarness): Promise<void> {
  for (let giro = 0; giro < 6; giro++) {
    harness.detectChanges();
    await harness.fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
  }
  harness.detectChanges();
}

export const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

export function pulsante(radice: ParentNode, testo: string): HTMLElement {
  const trovato = Array.from(radice.querySelectorAll<HTMLElement>('button, a')).find((b) =>
    testoDi(b).includes(testo),
  );
  if (trovato === undefined) {
    throw new Error(`Pulsante «${testo}» non trovato`);
  }
  return trovato;
}
