import { describe, expect, it } from 'vitest';
import {
  REGEX_CHIAVE_MESE,
  REGEX_DATA_ISO,
  REGEX_ORA_LOCALE,
  eCodiceAssenza,
  eCodiceTurno,
} from './codici';

describe('codici (D9)', () => {
  it.each(['M1', 'N1', 'R2', 'Z9', 'A0'])('%s è un codice di turno', (codice) => {
    expect(eCodiceTurno(codice)).toBe(true);
  });

  it.each(['m1', 'M', 'MM', 'M10', '1M', 'M1 ', '', 'È1'])(
    '«%s» non è un codice di turno',
    (codice) => {
      expect(eCodiceTurno(codice)).toBe(false);
    },
  );

  it.each(['F', 'R', 'MA', 'PS'])('%s è un codice di assenza', (codice) => {
    expect(eCodiceAssenza(codice)).toBe(true);
  });

  it.each(['f', 'ABC', 'A1', '', 'M1'])('«%s» non è un codice di assenza', (codice) => {
    expect(eCodiceAssenza(codice)).toBe(false);
  });

  it('turni e assenze non possono collidere', () => {
    for (const codice of ['M1', 'MA', 'R', 'R2', 'N1', 'F']) {
      expect(eCodiceTurno(codice) && eCodiceAssenza(codice)).toBe(false);
    }
  });
});

describe('formati di primo livello', () => {
  it('ore da 00:00 a 23:59', () => {
    for (const ora of ['00:00', '07:30', '23:59']) expect(REGEX_ORA_LOCALE.test(ora)).toBe(true);
    for (const ora of ['24:00', '7:30', '12:60', '12:5', '']) {
      expect(REGEX_ORA_LOCALE.test(ora)).toBe(false);
    }
  });

  it('date AAAA-MM-GG', () => {
    expect(REGEX_DATA_ISO.test('2026-11-17')).toBe(true);
    for (const data of ['2026-13-01', '2026-00-10', '2026-11-32', '26-11-17', '2026-1-1']) {
      expect(REGEX_DATA_ISO.test(data)).toBe(false);
    }
  });

  it('chiavi di mese AAAA-MM', () => {
    expect(REGEX_CHIAVE_MESE.test('2026-11')).toBe(true);
    for (const chiave of ['2026-13', '2026-1', '2026-11-01', '']) {
      expect(REGEX_CHIAVE_MESE.test(chiave)).toBe(false);
    }
  });
});
