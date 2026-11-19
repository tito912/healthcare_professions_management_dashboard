// Test di componente di «Report di tutti i reparti» (ADMIN, UX §7.10): reparti raggruppati per coordinatore con lo
// stato del report, «Apri» e «Scarica Excel»; nessuna azione di invio.
import { idBimestre } from '@turni/domain';
import { coordinatoreDiProva, repartoDiProva } from '../../test/finti';
import { testoDi } from '../../test/monta-griglia';
import { conteggi, montaReport, reportSalvato } from '../../test/monta-report';

/** 6 gennaio 2027, 07:00 UTC (08:00 a Roma). */
const ISTANTE_INVIO = 1799218800000;

const maria = coordinatoreDiProva('c1', 'Maria', 'Rossi');
const paolo = coordinatoreDiProva('c2', 'Paolo', 'Neri', false);

const REPARTI = [
  repartoDiProva('r1', 'Radiologia', 'c1'),
  repartoDiProva('r2', 'Ortopedia', 'c2'),
  repartoDiProva('r3', 'Cardiologia', 'c1'),
  repartoDiProva('r4', 'Nuovo', 'c1', 'turni'),
];

const ULTIMO = ISTANTE_INVIO;
const BIMESTRE = idBimestre('2026-B6');

const opzioni = {
  ruolo: 'ADMIN' as const,
  url: '/report?bimestre=2026-B6',
  oggi: '2027-01-08',
  reparti: REPARTI,
  coordinatori: [maria, paolo],
};

describe('Report di tutti i reparti (ADMIN)', () => {
  it('raggruppa per coordinatore (anche disattivato), ordina i reparti e lascia fuori quelli da configurare', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    expect(testoDi(radice.querySelector('h1') as Element)).toBe('Report di tutti i reparti');
    const gruppi = Array.from(radice.querySelectorAll('h2')).map(testoDi);
    expect(gruppi).toEqual(['Maria Rossi · 2 reparti', 'Paolo Neri · 1 reparto Disattivato']);
    const reparti = Array.from(radice.querySelectorAll('li[data-reparto]')).map((l) =>
      l.getAttribute('data-reparto'),
    );
    expect(reparti).toEqual(['r3', 'r1', 'r2']);
    expect(radice.querySelector('[data-reparto="r4"]')).toBeNull();
    expect(testoDi(radice.querySelector('[data-bimestre]') as Element)).toBe('nov–dic 2026');
  });

  it('per ogni reparto lo stato: inviato il …, generato il …, non generato, non leggibile', async () => {
    const t = await montaReport({
      ...opzioni,
      report: () => null,
    });
    t.reportRepo.leggi.mockImplementation((rid: string) => {
      if (rid === 'r1') {
        return Promise.resolve(
          reportSalvato(BIMESTRE, {
            righe: {},
            totali: conteggi({}),
            inviato: true,
            ultimoInvioMs: ULTIMO,
          }),
        );
      }
      if (rid === 'r2') {
        return Promise.resolve(
          reportSalvato(BIMESTRE, { righe: {}, totali: conteggi({}), generatoIlMs: ULTIMO }),
        );
      }
      return rid === 'r3' ? Promise.resolve(null) : Promise.reject(new Error('rete'));
    });
    await t.vai('/report?bimestre=2026-B5');
    await t.vai('/report?bimestre=2026-B6');
    const stato = (id: string): string =>
      testoDi(t.radice().querySelector(`[data-reparto="${id}"] [data-stato]`) as Element);
    expect(stato('r1')).toBe('inviato il 06/01/2027');
    expect(stato('r2')).toBe('generato il 06/01/2027, non inviato');
    expect(stato('r3')).toBe('non generato');
  });

  it('«Apri» porta al report del reparto per quel bimestre', async () => {
    const t = await montaReport(opzioni);
    const apri = t.radice().querySelector('[data-reparto="r1"] a') as HTMLAnchorElement;
    expect(apri.getAttribute('href')).toBe('/reparti/r1/report?bimestre=2026-B6');
    expect(apri.getAttribute('aria-label')).toBe('Apri il report di Radiologia');
  });

  it('«Scarica Excel» genera il file del reparto e rilegge gli stati; non c’è nessuna azione di invio', async () => {
    const t = await montaReport(opzioni);
    expect(testoDi(t.radice())).not.toContain('Invia');
    expect(testoDi(t.radice())).not.toContain('Reinvia');
    const prima = t.reportRepo.leggi.mock.calls.length;
    (t.radice().querySelector('[data-reparto="r1"] button') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.funzioni.genera).toHaveBeenCalledWith({ repartoId: 'r1', idBimestre: BIMESTRE });
    expect(t.funzioni.scarica).toHaveBeenCalledWith('report-2026-B6-radiologia.xlsx', 'AAAA');
    expect(t.funzioni.invia).not.toHaveBeenCalled();
    expect(t.reportRepo.leggi.mock.calls.length).toBeGreaterThan(prima);
  });

  it('un errore del file lo dice con un messaggio', async () => {
    const t = await montaReport(opzioni);
    t.funzioni.genera.mockRejectedValueOnce(new Error('boom'));
    (t.radice().querySelector('[data-reparto="r3"] button') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.funzioni.scarica).not.toHaveBeenCalled();
    expect(t.toast.messaggi().map((m) => m.testo)).toContain('Impossibile generare il file.');
  });

  it('senza indicazione nell’URL parte dall’ultimo bimestre dovuto; le frecce cambiano l’URL', async () => {
    const t = await montaReport({ ...opzioni, url: '/report' });
    expect(testoDi(t.radice().querySelector('[data-bimestre]') as Element)).toBe('nov–dic 2026');
    (t.radice().querySelector('[aria-label="Bimestre precedente"]') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.router.url).toContain('bimestre=2026-B5');
    expect(testoDi(t.radice().querySelector('[data-bimestre]') as Element)).toBe('set–ott 2026');
  });

  it('nessun reparto: stato vuoto', async () => {
    const t = await montaReport({ ...opzioni, reparti: [] });
    expect(testoDi(t.radice())).toContain('Nessun reparto ancora creato dai coordinatori');
  });
});
