// Montaggio comune dei test delle pagine del report: rotte vere, repository, funzioni e dialoghi finti, giorno di oggi
// fisso. Solo per i test (escluso dal build, vedi tsconfig.app.json).
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  chiaveMese,
  dataISO,
  type ConteggiReport,
  type IdBimestre,
  type InviaReportInput,
  type InviaReportOutput,
  type RiepilogoPerReport,
  type Ruolo,
} from '@turni/domain';
import { vi } from 'vitest';
import { DATA_OGGI } from '../core/ambiente';
import { Sessione } from '../core/sessione.service';
import { ElencoReparti } from '../dati/elenco-reparti';
import { DipendentiRepo, type DipendenteSalvato } from '../dati/dipendenti.repo';
import { RepartiRepo, type RepartoConfigurazione, type RepartoSintesi } from '../dati/reparti.repo';
import { ReportRepo, type MesiDelBimestre, type ReportSalvato } from '../dati/report.repo';
import { RiepiloghiRepo, type RiepilogoFestivitaAnno } from '../dati/riepiloghi.repo';
import type { UtenteElenco } from '../dati/utenti.repo';
import { FunzioniReport } from '../funzioni/report';
import { Report } from '../pagine/report/report';
import { ReportTutti } from '../pagine/report/report-tutti';
import { Dialoghi, type DatiConferma } from '../ui/dialog';
import { ToastService } from '../ui/toast';
import { elencoFinto, sessioneFinta } from './finti';
import { assestatiGriglia, dipendente } from './monta-griglia';

export const REPARTO: RepartoConfigurazione = {
  id: 'r1',
  nome: 'Radiologia',
  coordinatoreUid: 'u1',
  passo: 'completata',
  attribuzioneNotte: 'inizio',
  festivita: { nazionaliEscluse: [], locali: [] },
};

export const DIPENDENTI_REPORT: readonly DipendenteSalvato[] = [
  dipendente('d1', 'Rossi', 'Mario'),
  dipendente('d2', 'Bianchi', 'Laura'),
  dipendente('d3', 'Verdi', 'Anna'),
];

export const conteggi = (parziale: Partial<ConteggiReport>): ConteggiReport => ({
  turniSvolti: 0,
  notti: 0,
  sabati: 0,
  domenicheEFestivi: 0,
  reperibilitaSvolte: 0,
  chiamate: 0,
  minutiChiamate: 0,
  ...parziale,
});

export function riepilogoReport(
  dipendenteId: string,
  mese: string,
  parziale: Partial<ConteggiReport>,
): RiepilogoPerReport {
  return { dipendenteId, chiaveMese: chiaveMese(mese), ...conteggi(parziale) };
}

export function mesiDel(
  primo: MesiDelBimestre['stato'],
  secondo: MesiDelBimestre['stato'],
  id = '2026-11',
  id2 = '2026-12',
): readonly MesiDelBimestre[] {
  return [
    { chiave: chiaveMese(id), stato: primo },
    { chiave: chiaveMese(id2), stato: secondo },
  ];
}

export function reportSalvato(
  idBimestre: IdBimestre,
  parziale: Partial<ReportSalvato> & Pick<ReportSalvato, 'righe' | 'totali'>,
): ReportSalvato {
  return {
    idBimestre,
    mesiInclusi: [],
    generatoIlMs: null,
    invii: {},
    invioAutomaticoIlMs: null,
    inviato: false,
    ultimoInvioMs: null,
    ...parziale,
  };
}

export interface OpzioniReport {
  readonly ruolo?: Ruolo;
  readonly url?: string;
  readonly reparto?: RepartoConfigurazione | null;
  readonly dipendenti?: readonly DipendenteSalvato[];
  readonly mesi?: (id: IdBimestre) => readonly MesiDelBimestre[];
  readonly report?: (id: IdBimestre) => ReportSalvato | null;
  readonly riepiloghi?: readonly RiepilogoPerReport[];
  readonly riepiloghiAnno?: readonly RiepilogoFestivitaAnno[];
  /** Esiti restituiti da inviaReport; per l'anteprima conta `accodato` (con email) e `senzaEmail`. */
  readonly esiti?: InviaReportOutput['esiti'];
  readonly letturaRiepiloghiFallisce?: boolean;
  readonly dialogoConferma?: boolean;
  /** Per la pagina dell'ADMIN. */
  readonly reparti?: readonly RepartoSintesi[];
  readonly coordinatori?: readonly UtenteElenco[];
  readonly oggi?: string;
}

export async function montaReport(opzioni: OpzioniReport = {}) {
  const funzioni = {
    genera: vi.fn(() =>
      Promise.resolve({
        nomeFile: 'report-2026-B6-radiologia.xlsx',
        contenutoBase64: 'AAAA',
        mesiInclusi: [chiaveMese('2026-11')],
      }),
    ),
    invia: vi.fn((input: InviaReportInput) =>
      Promise.resolve({
        esiti: (opzioni.esiti ?? []).filter(
          (e) => input.dipendenteIds === null || input.dipendenteIds.includes(e.dipendenteId),
        ),
      }),
    ),
    scarica: vi.fn(),
  };
  const reportRepo = {
    leggi: vi.fn((_rid: string, id: IdBimestre) => Promise.resolve(opzioni.report?.(id) ?? null)),
    mesi: vi.fn((_rid: string, id: IdBimestre) =>
      Promise.resolve(opzioni.mesi?.(id) ?? mesiDel(null, null)),
    ),
  };
  const riepiloghiRepo = {
    perReport: vi.fn(() =>
      opzioni.letturaRiepiloghiFallisce === true
        ? Promise.reject(new Error('rete'))
        : Promise.resolve([...(opzioni.riepiloghi ?? [])]),
    ),
    perAnno: vi.fn(() =>
      opzioni.letturaRiepiloghiFallisce === true
        ? Promise.reject(new Error('rete'))
        : Promise.resolve([...(opzioni.riepiloghiAnno ?? [])]),
    ),
  };
  const dialoghi = {
    conferma: vi.fn<(dati: DatiConferma) => Promise<boolean>>(() =>
      Promise.resolve(opzioni.dialogoConferma ?? true),
    ),
  };
  const elenco = elencoFinto(opzioni.reparti ?? [], opzioni.coordinatori ?? []);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reparti/:rid/report', component: Report },
        { path: 'report', component: ReportTutti },
        { path: 'home', component: Report },
      ]),
      { provide: Sessione, useValue: sessioneFinta(opzioni.ruolo ?? 'COORDINATORE') },
      { provide: DATA_OGGI, useValue: () => dataISO(opzioni.oggi ?? '2026-11-19') },
      {
        provide: RepartiRepo,
        useValue: {
          leggiConfigurazione: () =>
            Promise.resolve(opzioni.reparto === undefined ? REPARTO : opzioni.reparto),
        },
      },
      {
        provide: DipendentiRepo,
        useValue: { elenco: () => Promise.resolve([...(opzioni.dipendenti ?? DIPENDENTI_REPORT)]) },
      },
      { provide: ReportRepo, useValue: reportRepo },
      { provide: RiepiloghiRepo, useValue: riepiloghiRepo },
      { provide: FunzioniReport, useValue: funzioni },
      { provide: Dialoghi, useValue: dialoghi },
      { provide: ElencoReparti, useValue: elenco },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(opzioni.url ?? '/reparti/r1/report');
  await assestatiGriglia(harness);
  const radice = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  return {
    harness,
    router: TestBed.inject(Router),
    toast: TestBed.inject(ToastService),
    radice,
    funzioni,
    reportRepo,
    riepiloghiRepo,
    dialoghi,
    assesta: () => assestatiGriglia(harness),
    vai: async (url: string) => {
      await harness.navigateByUrl(url);
      await assestatiGriglia(harness);
    },
  };
}
