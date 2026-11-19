import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import {
  chiaveMese,
  dataISO,
  formattaMese,
  meseCorrente,
  spostaMese,
  type IdBimestre,
  type Ruolo,
  type StatoReportBimestre,
} from '@turni/domain';
import { DATA_OGGI } from '../../core/ambiente';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { ReportRepo } from '../../dati/report.repo';
import { RiepiloghiRepo } from '../../dati/riepiloghi.repo';
import type { RepartoSintesi } from '../../dati/reparti.repo';
import type { UtenteElenco } from '../../dati/utenti.repo';
import { coordinatoreDiProva, elencoFinto, repartoDiProva, sessioneFinta } from '../../test/finti';
import { Home } from './home';

interface RepoFinto {
  readonly mesiConAvvisi: (repartoId: string) => Promise<{ chiaveMese: string; avvisi: number }[]>;
  readonly esisteMese: (repartoId: string, chiave: string) => Promise<boolean>;
}

/** Il report dovuto (6 gennaio 2027 → 2026-B6) è già inviato: nessun avviso, salvo i test che lo cambiano. */
type StatoReportFinto = (repartoId: string, idBimestre: IdBimestre) => Promise<StatoReportBimestre>;
const REPORT_INVIATO: StatoReportFinto = (_id, idBimestre) =>
  Promise.resolve({
    idBimestre,
    inviato: true,
    mesi: [],
  });

const REPO_VUOTO: RepoFinto = {
  mesiConAvvisi: () => Promise.resolve([]),
  esisteMese: () => Promise.resolve(true),
};

function monta(
  ruolo: Ruolo,
  reparti: RepartoSintesi[],
  utenti: UtenteElenco[] = [],
  repo: RepoFinto = REPO_VUOTO,
  statoReport: StatoReportFinto = REPORT_INVIATO,
) {
  const elenco = elencoFinto(reparti, utenti);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Sessione, useValue: sessioneFinta(ruolo) },
      { provide: ElencoReparti, useValue: elenco },
      { provide: RiepiloghiRepo, useValue: repo },
      { provide: ReportRepo, useValue: { statoBimestre: statoReport } },
      { provide: DATA_OGGI, useValue: () => dataISO('2027-01-08') },
    ],
  });
  const fixture = TestBed.createComponent(Home);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  return { fixture, radice, elenco };
}

/** Lascia correre le letture asincrone degli avvisi e i ridisegni. */
async function assesta(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  for (let giro = 0; giro < 5; giro++) {
    await fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
    fixture.detectChanges();
  }
}

const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Home', () => {
  beforeEach(() => localStorage.clear());

  it('senza avvisi l’area «Avvisi aperti» dice che non ce ne sono (per tutti i ruoli)', async () => {
    for (const ruolo of ['ADMIN', 'COORDINATORE'] as const) {
      TestBed.resetTestingModule();
      const { fixture, radice } = monta(ruolo, []);
      await assesta(fixture);
      expect(testoDi(radice)).toContain('Avvisi aperti');
      expect(testoDi(radice)).toContain('Nessun avviso aperto');
    }
  });

  describe('COORDINATORE', () => {
    it('senza reparti: stato vuoto con «Crea il primo reparto» verso /reparti/nuovo', () => {
      const { radice } = monta('COORDINATORE', []);
      expect(testoDi(radice)).toContain('Non hai ancora reparti');
      const link = Array.from(radice.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Crea il primo reparto'),
      );
      expect(link?.getAttribute('href')).toBe('/reparti/nuovo');
    });

    it('con reparti: elenco con «Aggiungi reparto» e «Apri» verso il mese corrente', () => {
      const { radice } = monta('COORDINATORE', [
        repartoDiProva('r1', 'Radiologia'),
        repartoDiProva('r2', 'Cardiologia'),
      ]);
      const link = Array.from(radice.querySelectorAll('a'));
      const aggiungi = link.find((a) => a.textContent?.includes('Aggiungi reparto'));
      expect(aggiungi?.getAttribute('href')).toBe('/reparti/nuovo');
      const apri = link.filter((a) => a.textContent?.trim() === 'Apri');
      expect(apri.length).toBe(2);
      expect(apri[0]?.getAttribute('href')).toMatch(/^\/reparti\/r1\/mesi\/\d{4}-\d{2}$/);
    });

    it('un reparto da completare mostra «Riprendi» e il passo', () => {
      const { radice } = monta('COORDINATORE', [
        repartoDiProva('r1', 'Radiologia', 'u1', 'dipendenti'),
      ]);
      expect(testoDi(radice)).toContain('Configurazione da completare');
      expect(testoDi(radice)).toContain('passo 3 di 3');
      const riprendi = Array.from(radice.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Riprendi',
      );
      expect(riprendi?.getAttribute('href')).toBe('/reparti/r1/dipendenti');
    });

    it('errore di caricamento: messaggio con «Riprova» che ricarica', () => {
      const { fixture, radice, elenco } = monta('COORDINATORE', []);
      elenco.impostaStato('errore');
      fixture.detectChanges();
      expect(testoDi(radice)).toContain('Impossibile caricare i reparti.');
      const riprova = Array.from(radice.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Riprova'),
      );
      riprova?.click();
      expect(elenco.carica).toHaveBeenLastCalledWith(true);
    });
  });

  describe('ADMIN', () => {
    const maria = coordinatoreDiProva('c1', 'Maria', 'Rossi');
    const paolo = coordinatoreDiProva('c2', 'Paolo', 'Neri', false);
    const reparti = [
      repartoDiProva('r1', 'Radiologia', 'c1'),
      repartoDiProva('r2', 'Cardiologia', 'c1'),
      repartoDiProva('r3', 'Ortopedia', 'c2'),
    ];

    it('mostra i reparti raggruppati per coordinatore, con «Disattivato» dove serve', () => {
      const { radice } = monta('ADMIN', reparti, [maria, paolo]);
      const titoli = Array.from(radice.querySelectorAll('h3')).map(testoDi);
      expect(titoli).toEqual(['Maria Rossi · 2 reparti', 'Paolo Neri · 1 reparto Disattivato']);
    });

    it('non ha azioni di modifica né pulsanti disabilitati: solo «Apri»', () => {
      const { radice } = monta('ADMIN', reparti, [maria, paolo]);
      expect(radice.querySelector('button')).toBeNull();
      expect(radice.querySelector('[disabled], [aria-disabled="true"]')).toBeNull();
      const testi = Array.from(radice.querySelectorAll('a')).map((a) => a.textContent?.trim());
      expect(testi).toEqual(['Apri', 'Apri', 'Apri']);
      expect(testoDi(radice)).not.toContain('Aggiungi reparto');
      expect(testoDi(radice)).not.toContain('Riprendi');
    });

    it('senza reparti: «Nessun reparto ancora creato dai coordinatori»', () => {
      const { radice } = monta('ADMIN', [], [maria]);
      expect(testoDi(radice)).toContain('Nessun reparto ancora creato dai coordinatori');
    });
  });

  describe('Avvisi aperti (UX §7.2, step 2.3)', () => {
    const prossimo = spostaMese(chiaveMese(meseCorrente()), 1);

    it('elenca per reparto i mesi in bozza con avvisi e il mese prossimo non creato, con «Apri»', async () => {
      const repo: RepoFinto = {
        mesiConAvvisi: (id) =>
          Promise.resolve(id === 'r1' ? [{ chiaveMese: '2026-11', avvisi: 3 }] : []),
        esisteMese: (id) => Promise.resolve(id !== 'r1'),
      };
      const { fixture, radice } = monta(
        'COORDINATORE',
        [repartoDiProva('r1', 'Radiologia'), repartoDiProva('r2', 'Cardiologia')],
        [],
        repo,
      );
      await assesta(fixture);
      const area = radice.querySelector('[aria-labelledby="titolo-avvisi"]') as HTMLElement;
      const voci = Array.from(area.querySelectorAll('li')).map(testoDi);
      expect(voci).toEqual([
        'Radiologia · Novembre 2026 (bozza): 3 avvisiApri',
        `Radiologia · ${formattaMese(prossimo)} non ancora creatoApri`,
      ]);
      const link = Array.from(area.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(link).toEqual(['/reparti/r1/mesi/2026-11', `/reparti/r1/mesi/${prossimo}`]);
      expect(testoDi(area)).toContain('non comprende i turni esclusi già assegnati');
    });

    it('i reparti con la configurazione da completare non hanno avvisi dei mesi', async () => {
      const esisteMese = vi.fn(() => Promise.resolve(false));
      const { fixture, radice } = monta(
        'COORDINATORE',
        [repartoDiProva('r1', 'Nuovo', 'u1', 'turni')],
        [],
        {
          mesiConAvvisi: () => Promise.resolve([{ chiaveMese: '2026-11', avvisi: 1 }]),
          esisteMese,
        },
      );
      await assesta(fixture);
      expect(esisteMese).not.toHaveBeenCalled();
      expect(testoDi(radice)).toContain('Nessun avviso aperto');
    });

    it('l’ADMIN vede gli avvisi di tutti i reparti', async () => {
      const { fixture, radice } = monta('ADMIN', [repartoDiProva('r1', 'Radiologia', 'u1')], [], {
        mesiConAvvisi: () => Promise.resolve([{ chiaveMese: '2026-10', avvisi: 1 }]),
        esisteMese: () => Promise.resolve(true),
      });
      await assesta(fixture);
      expect(testoDi(radice)).toContain('Radiologia · Ottobre 2026 (bozza): 1 avviso');
    });

    it('un errore di lettura lo dice e non nasconde gli avvisi trovati', async () => {
      const { fixture, radice } = monta(
        'COORDINATORE',
        [repartoDiProva('r1', 'Radiologia'), repartoDiProva('r2', 'Cardiologia')],
        [],
        {
          mesiConAvvisi: (id) =>
            id === 'r1'
              ? Promise.resolve([{ chiaveMese: '2026-11', avvisi: 2 }])
              : Promise.reject(new Error('rete')),
          esisteMese: () => Promise.resolve(true),
        },
      );
      await assesta(fixture);
      expect(testoDi(radice)).toContain('Radiologia · Novembre 2026 (bozza): 2 avvisi');
      expect(testoDi(radice)).toContain('Impossibile controllare gli avvisi dei mesi');
    });

    describe('report del bimestre chiuso non inviato (step 4.1, L15)', () => {
      const stato =
        (
          inviato: boolean,
          primo: 'bozza' | 'convalidato' | null,
          secondo: 'bozza' | 'convalidato' | null,
        ): StatoReportFinto =>
        (_id, idBimestre) =>
          Promise.resolve({
            idBimestre,
            inviato,
            mesi: [
              { chiave: chiaveMese('2026-11'), stato: primo },
              { chiave: chiaveMese('2026-12'), stato: secondo },
            ],
          });

      it('un mese non convalidato: avviso con i mesi che mancano e «Apri» sul report di quel bimestre', async () => {
        const { fixture, radice } = monta(
          'COORDINATORE',
          [repartoDiProva('r1', 'Cardiologia')],
          [],
          REPO_VUOTO,
          stato(false, 'convalidato', 'bozza'),
        );
        await assesta(fixture);
        const area = radice.querySelector('[aria-labelledby="titolo-avvisi"]') as HTMLElement;
        const voce = Array.from(area.querySelectorAll('li')).find((li) =>
          testoDi(li).includes('Report'),
        );
        expect(testoDi(voce as Element)).toBe(
          'Cardiologia · Report nov–dic 2026 non inviato: dicembre non convalidatoApri',
        );
        const link = (voce as Element).querySelector('a');
        expect(link?.getAttribute('href')).toBe('/reparti/r1/report?bimestre=2026-B6');
        expect(link?.getAttribute('aria-label')).toBe('Apri il report nov–dic 2026 di Cardiologia');
      });

      it('entrambi i mesi convalidati ma nessun invio: «non inviato»; con più mesi mancanti il plurale', async () => {
        const uno = monta(
          'COORDINATORE',
          [repartoDiProva('r1', 'Cardiologia')],
          [],
          REPO_VUOTO,
          stato(false, 'convalidato', 'convalidato'),
        );
        await assesta(uno.fixture);
        expect(testoDi(uno.radice)).toContain('Cardiologia · Report nov–dic 2026 non inviato');
        expect(testoDi(uno.radice)).not.toContain('non convalidat');
        TestBed.resetTestingModule();
        const due = monta(
          'COORDINATORE',
          [repartoDiProva('r1', 'Cardiologia')],
          [],
          REPO_VUOTO,
          stato(false, 'bozza', null),
        );
        await assesta(due.fixture);
        expect(testoDi(due.radice)).toContain('novembre e dicembre non convalidati');
      });

      it('già inviato, o nessun mese creato: nessun avviso del report', async () => {
        for (const s of [stato(true, 'convalidato', 'convalidato'), stato(false, null, null)]) {
          TestBed.resetTestingModule();
          const { fixture, radice } = monta(
            'COORDINATORE',
            [repartoDiProva('r1', 'Cardiologia')],
            [],
            REPO_VUOTO,
            s,
          );
          await assesta(fixture);
          expect(testoDi(radice)).not.toContain('Report nov–dic');
        }
      });

      it('l’ADMIN lo vede per ogni reparto; gli avvisi dei mesi vengono prima, quelli sul mese non creato dopo', async () => {
        const { fixture, radice } = monta(
          'ADMIN',
          [repartoDiProva('r1', 'Radiologia', 'u1')],
          [],
          {
            mesiConAvvisi: () => Promise.resolve([{ chiaveMese: '2026-12', avvisi: 2 }]),
            esisteMese: () => Promise.resolve(false),
          },
          stato(false, 'convalidato', 'convalidato'),
        );
        await assesta(fixture);
        const area = radice.querySelector('[aria-labelledby="titolo-avvisi"]') as HTMLElement;
        const voci = Array.from(area.querySelectorAll('li')).map((li) =>
          testoDi(li).replace('Apri', ''),
        );
        expect(voci[0]).toContain('(bozza): 2 avvisi');
        expect(voci[1]).toContain('Report nov–dic 2026 non inviato');
        expect(voci[2]).toContain('non ancora creato');
      });

      it('un errore di lettura dello stato lo dice come per gli altri avvisi', async () => {
        const { fixture, radice } = monta(
          'COORDINATORE',
          [repartoDiProva('r1', 'Cardiologia')],
          [],
          REPO_VUOTO,
          () => Promise.reject(new Error('rete')),
        );
        await assesta(fixture);
        expect(testoDi(radice)).toContain('Impossibile controllare gli avvisi dei mesi');
      });
    });
  });
});
