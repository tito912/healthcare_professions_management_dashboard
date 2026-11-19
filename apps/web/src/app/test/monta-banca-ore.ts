// Montaggio comune dei test delle pagine «Banca ore» e «Dettaglio del dipendente»: rotte vere, repository finti,
// giorno di oggi fisso. Solo per i test (escluso dal build, vedi tsconfig.app.json).
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { dataISO, type Ruolo } from '@turni/domain';
import { vi } from 'vitest';
import { DATA_OGGI } from '../core/ambiente';
import { Sessione } from '../core/sessione.service';
import { AssenzeRepo, type AssenzaSalvata } from '../dati/assenze.repo';
import { BancaOreRepo, type BancaOreSalvata } from '../dati/banca-ore.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../dati/dipendenti.repo';
import { RepartiRepo, type RepartoConfigurazione } from '../dati/reparti.repo';
import { RiepiloghiRepo, type RiepilogoDelDipendente } from '../dati/riepiloghi.repo';
import type { RigaSalvata } from '../dati/righe.repo';
import { BancaOre } from '../pagine/banca-ore/banca-ore';
import { DettaglioDipendente } from '../pagine/dettaglio-dipendente/dettaglio-dipendente';
import { ASSENZE, DIPENDENTI, assestatiGriglia } from './monta-griglia';
import { sessioneFinta } from './finti';

const REPARTO: RepartoConfigurazione = {
  id: 'r1',
  nome: 'Radiologia',
  coordinatoreUid: 'u1',
  passo: 'completata',
  attribuzioneNotte: 'inizio',
  festivita: { nazionaliEscluse: [], locali: [] },
};

export interface OpzioniBancaOre {
  readonly ruolo?: Ruolo;
  readonly url?: string;
  readonly reparto?: RepartoConfigurazione | null;
  readonly dipendenti?: readonly DipendenteSalvato[];
  readonly assenze?: readonly AssenzaSalvata[];
  /** Una funzione per far fallire la lettura. */
  readonly banche?: (anno: number) => Promise<readonly BancaOreSalvata[]>;
  readonly riepiloghi?: readonly RiepilogoDelDipendente[];
  readonly righe?: Readonly<Record<string, RigaSalvata>>;
}

export async function montaBancaOre(opzioni: OpzioniBancaOre = {}) {
  const richiesteBanca: number[] = [];
  const righeLette: string[] = [];
  const bancaOreRepo = {
    anno: vi.fn((_rid: string, anno: number) => {
      richiesteBanca.push(anno);
      return opzioni.banche === undefined
        ? Promise.resolve([])
        : opzioni.banche(anno).then((b) => [...b]);
    }),
  };
  const riepiloghiRepo = {
    delDipendente: vi.fn(() => Promise.resolve([...(opzioni.riepiloghi ?? [])])),
    rigaDelDipendente: vi.fn((_rid: string, chiave: string) => {
      righeLette.push(chiave);
      return Promise.resolve(opzioni.righe?.[chiave] ?? null);
    }),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reparti/:rid/banca-ore', component: BancaOre },
        { path: 'reparti/:rid/banca-ore/:did', component: DettaglioDipendente },
        { path: 'reparti/:rid/dipendenti/:did/anagrafica', component: BancaOre },
        { path: 'home', component: BancaOre },
      ]),
      { provide: Sessione, useValue: sessioneFinta(opzioni.ruolo ?? 'COORDINATORE') },
      { provide: DATA_OGGI, useValue: () => dataISO('2026-11-03') },
      {
        provide: RepartiRepo,
        useValue: {
          leggiConfigurazione: () =>
            Promise.resolve(opzioni.reparto === undefined ? REPARTO : opzioni.reparto),
        },
      },
      {
        provide: DipendentiRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.dipendenti ?? DIPENDENTI)]) },
      },
      {
        provide: AssenzeRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.assenze ?? ASSENZE)]) },
      },
      { provide: BancaOreRepo, useValue: bancaOreRepo },
      { provide: RiepiloghiRepo, useValue: riepiloghiRepo },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(opzioni.url ?? '/reparti/r1/banca-ore?anno=2026');
  await assestatiGriglia(harness);
  const radice = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  return {
    harness,
    router: TestBed.inject(Router),
    radice,
    richiesteBanca,
    righeLette,
    bancaOreRepo,
    riepiloghiRepo,
    assesta: () => assestatiGriglia(harness),
    vai: async (url: string) => {
      await harness.navigateByUrl(url);
      await assestatiGriglia(harness);
    },
  };
}
