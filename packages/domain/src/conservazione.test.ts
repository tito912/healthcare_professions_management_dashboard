import { describe, expect, it } from 'vitest';
import { dataISO } from './codici';
import {
  cessazioneDaConfermare,
  daEliminare,
  dataEliminazione,
  dataLimiteCessazione,
  fileReportScaduto,
  graziaPuliziaTrascorsa,
} from './conservazione';

const d = dataISO;

describe('daEliminare (L3: 5 anni dalla cessazione)', () => {
  it('4 anni e 11 mesi: no', () => {
    expect(daEliminare(d('2021-12-15'), d('2026-11-15'))).toBe(false);
  });

  it('un giorno prima dei 5 anni: no', () => {
    expect(daEliminare(d('2021-11-20'), d('2026-11-19'))).toBe(false);
  });

  it('5 anni esatti: sì', () => {
    expect(daEliminare(d('2021-11-19'), d('2026-11-19'))).toBe(true);
  });

  it('6 anni: sì', () => {
    expect(daEliminare(d('2020-11-19'), d('2026-11-19'))).toBe(true);
  });

  it('cessazione il 29 febbraio: scade il 28 febbraio di cinque anni dopo', () => {
    expect(dataEliminazione(d('2020-02-29'))).toBe('2025-02-28');
    expect(daEliminare(d('2020-02-29'), d('2025-02-27'))).toBe(false);
    expect(daEliminare(d('2020-02-29'), d('2025-02-28'))).toBe(true);
  });

  it('una cessazione futura o di oggi non si elimina', () => {
    expect(daEliminare(d('2026-11-19'), d('2026-11-19'))).toBe(false);
    expect(daEliminare(d('2027-01-01'), d('2026-11-19'))).toBe(false);
  });
});

describe('dataLimiteCessazione', () => {
  it('lascia un giorno di margine per il 29 febbraio', () => {
    expect(dataLimiteCessazione(d('2025-02-28'))).toBe('2020-02-29');
    expect(daEliminare(d('2020-02-29'), d('2025-02-28'))).toBe(true);
  });

  it('ogni cessazione da eliminare sta entro il limite', () => {
    const oggi = d('2026-11-19');
    const limite = dataLimiteCessazione(oggi);
    for (const cessazione of ['2021-11-19', '2021-11-18', '2019-01-01']) {
      expect(daEliminare(d(cessazione), oggi)).toBe(true);
      expect(cessazione <= limite).toBe(true);
    }
  });
});

describe('fileReportScaduto (L16: 365 giorni)', () => {
  it('364 giorni: no; 365 giorni: sì', () => {
    expect(fileReportScaduto('2025-11-20T10:00:00Z', d('2026-11-19'))).toBe(false);
    expect(fileReportScaduto('2025-11-19T10:00:00Z', d('2026-11-19'))).toBe(true);
  });

  it("conta il giorno di calendario a Roma, non l'ora", () => {
    // 18/11/2025 23:30 UTC = 19/11/2025 00:30 a Roma
    expect(fileReportScaduto('2025-11-18T23:30:00Z', d('2026-11-19'))).toBe(true);
  });

  it('una data non valida non scade', () => {
    expect(fileReportScaduto('non una data', d('2026-11-19'))).toBe(false);
  });
});

describe('cessazioneDaConfermare (audit 4.4, I1: un refuso nell’anno non deve cancellare un dipendente)', () => {
  const oggi = d('2026-11-19');

  it('una cessazione di oggi, futura o fino a un anno fa non chiede conferma', () => {
    expect(cessazioneDaConfermare(d('2026-11-19'), oggi)).toBe(false);
    expect(cessazioneDaConfermare(d('2027-03-31'), oggi)).toBe(false);
    expect(cessazioneDaConfermare(d('2026-03-31'), oggi)).toBe(false);
    expect(cessazioneDaConfermare(d('2025-11-19'), oggi)).toBe(false);
  });

  it('più vecchia di un anno chiede conferma', () => {
    expect(cessazioneDaConfermare(d('2025-11-18'), oggi)).toBe(true);
    expect(cessazioneDaConfermare(d('2016-03-31'), oggi)).toBe(true);
  });

  it('il refuso 2016 invece di 2026 è proprio il caso da fermare', () => {
    expect(cessazioneDaConfermare(d('2016-03-31'), oggi)).toBe(true);
    expect(daEliminare(d('2016-03-31'), oggi)).toBe(true);
  });

  it('ogni data già da eliminare chiede conferma', () => {
    for (const cessazione of ['2021-11-19', '2021-11-18', '2019-01-01', '2000-01-01']) {
      expect(daEliminare(d(cessazione), oggi)).toBe(true);
      expect(cessazioneDaConfermare(d(cessazione), oggi)).toBe(true);
    }
  });

  it('il 29 febbraio non rompe il calcolo di un anno prima', () => {
    expect(cessazioneDaConfermare(d('2023-02-28'), d('2024-02-29'))).toBe(false);
    expect(cessazioneDaConfermare(d('2023-02-27'), d('2024-02-29'))).toBe(true);
  });
});

describe('graziaPuliziaTrascorsa (audit 4.4, I1: periodo di grazia di 30 giorni dall’ultimo salvataggio)', () => {
  const oggi = d('2026-11-19');
  // Istante di metà giornata a Roma del giorno indicato.
  const ms = (iso: string): number => Date.parse(`${iso}T11:00:00Z`);

  it('29 giorni: ancora in grazia; 30 giorni: trascorsa', () => {
    expect(graziaPuliziaTrascorsa(ms('2026-10-21'), oggi)).toBe(false);
    expect(graziaPuliziaTrascorsa(ms('2026-10-20'), oggi)).toBe(true);
  });

  it('salvato oggi o nel futuro: in grazia', () => {
    expect(graziaPuliziaTrascorsa(ms('2026-11-19'), oggi)).toBe(false);
    expect(graziaPuliziaTrascorsa(ms('2027-01-01'), oggi)).toBe(false);
  });

  it('conta il giorno di calendario a Roma, non l’ora', () => {
    // 19/10/2026 23:30 UTC = 20/10/2026 01:30 a Roma (ora legale): 30 giorni di calendario al 19/11.
    expect(graziaPuliziaTrascorsa(Date.parse('2026-10-19T23:30:00Z'), oggi)).toBe(true);
    // 20/10/2026 21:30 UTC = 20/10/2026 23:30 a Roma: sempre il 20, quindi trascorsa il 19/11.
    expect(graziaPuliziaTrascorsa(Date.parse('2026-10-20T21:30:00Z'), oggi)).toBe(true);
    // 20/10/2026 22:30 UTC = 21/10/2026 00:30 a Roma: il 21, ancora in grazia.
    expect(graziaPuliziaTrascorsa(Date.parse('2026-10-20T22:30:00Z'), oggi)).toBe(false);
  });

  it('un istante non valido non è mai trascorso (prudenza)', () => {
    expect(graziaPuliziaTrascorsa(Number.NaN, oggi)).toBe(false);
  });
});
