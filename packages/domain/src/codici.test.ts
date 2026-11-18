import { describe, expect, it } from 'vitest';
import {
  REGEX_CHIAVE_MESE,
  REGEX_DATA_ISO,
  REGEX_ORA_LOCALE,
  codiceAssenza,
  codiceTurno,
  dataISO,
  eCodiceAssenza,
  eCodiceTurno,
  oraLocale,
  validaCodice,
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

describe('validaCodice (D9)', () => {
  const usati = [
    { codice: 'N1', nome: 'Notte' },
    { codice: 'R', nome: 'Riposo' },
  ];

  it('normalizza in maiuscolo e accetta un codice libero', () => {
    expect(validaCodice(' m1 ', 'turno', usati)).toEqual({ valido: true, codice: 'M1' });
    expect(validaCodice('f', 'assenza', usati)).toEqual({ valido: true, codice: 'F' });
  });

  it('segnala vuoto e formato sbagliato', () => {
    expect(validaCodice('  ', 'turno', usati)).toEqual({ valido: false, motivo: 'vuoto' });
    expect(validaCodice('M-1', 'turno', usati)).toEqual({ valido: false, motivo: 'formato' });
    expect(validaCodice('M10', 'turno', usati)).toEqual({ valido: false, motivo: 'formato' });
    expect(validaCodice('ABC', 'assenza', usati)).toEqual({ valido: false, motivo: 'formato' });
  });

  it('segnala un codice dell’altro gruppo', () => {
    expect(validaCodice('M1', 'assenza', usati)).toEqual({ valido: false, motivo: 'altroGruppo' });
    expect(validaCodice('MA', 'turno', usati)).toEqual({ valido: false, motivo: 'altroGruppo' });
  });

  it('segnala la collisione e chi usa già il codice', () => {
    expect(validaCodice('n1', 'turno', usati)).toEqual({
      valido: false,
      motivo: 'duplicato',
      usatoDa: { codice: 'N1', nome: 'Notte' },
    });
    expect(validaCodice('R', 'assenza', usati)).toMatchObject({ motivo: 'duplicato' });
  });
});

describe('costruttori dei tipi marcati', () => {
  it('accettano i formati validi e lanciano su quelli non validi', () => {
    expect(codiceTurno('M1')).toBe('M1');
    expect(codiceAssenza('MA')).toBe('MA');
    expect(oraLocale('07:30')).toBe('07:30');
    expect(dataISO('2026-11-18')).toBe('2026-11-18');
    expect(() => codiceTurno('M')).toThrow();
    expect(() => codiceAssenza('M1')).toThrow();
    expect(() => oraLocale('24:00')).toThrow();
    expect(() => dataISO('2026-13-01')).toThrow();
    expect(() => dataISO('2026-02-30')).toThrow();
  });
});
