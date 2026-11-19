import { describe, expect, it } from 'vitest';
import { dataISO } from './codici';
import {
  daEliminare,
  dataEliminazione,
  dataLimiteCessazione,
  fileReportScaduto,
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
