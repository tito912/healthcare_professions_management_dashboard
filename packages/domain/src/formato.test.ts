import { describe, expect, it } from 'vitest';
import {
  formattaData,
  formattaDataDaMs,
  formattaDurata,
  formattaGiornoCompleto,
  formattaIntervalloGiorni,
  formattaMese,
  formattaNomeMese,
  formattaOraDaMs,
  formattaOreCompatte,
  formattaOreDecimali,
  formattaOreSettimanali,
  formattaSaldoOre,
} from './formato';

describe('formattaMese', () => {
  it.each([
    ['2026-11', 'Novembre 2026'],
    ['2027-01', 'Gennaio 2027'],
    ['2026-08', 'Agosto 2026'],
  ])('%s → %s', (chiave, atteso) => {
    expect(formattaMese(chiave)).toBe(atteso);
  });

  it.each(['', '2026-13', '2026-1', 'abc'])('restituisce %j invariato se non è una chiave', (v) => {
    expect(formattaMese(v)).toBe(v);
  });
});

describe('formattaNomeMese', () => {
  it('dà il nome del mese in minuscolo, senza anno', () => {
    expect(formattaNomeMese('2026-12')).toBe('dicembre');
    expect(formattaNomeMese('2026-03')).toBe('marzo');
  });

  it('restituisce il testo invariato se non è una chiave di mese', () => {
    expect(formattaNomeMese('boh')).toBe('boh');
  });
});

describe('formattaDurata e formattaData', () => {
  it('durata in ore e minuti', () => {
    expect(formattaDurata(390)).toBe('6 h 30');
    expect(formattaDurata(540)).toBe('9 h');
    expect(formattaDurata(45)).toBe('45 min');
    expect(formattaDurata(1440)).toBe('24 h');
  });

  it('data italiana', () => {
    expect(formattaData('2026-01-01')).toBe('01/01/2026');
    expect(formattaData('boh')).toBe('boh');
  });
});

describe('formattaOreSettimanali', () => {
  it.each([
    [36, '36,0'],
    [37.5, '37,5'],
    [1, '1,0'],
    [48, '48,0'],
  ])('%s → %s', (ore, atteso) => {
    expect(formattaOreSettimanali(ore)).toBe(atteso);
  });
});

describe('formattazioni della griglia (step 2.2)', () => {
  it('ore decimali con un decimale e la virgola (D4: 36 h → 7,2 h al giorno)', () => {
    expect(formattaOreDecimali(8640)).toBe('144,0');
    expect(formattaOreDecimali(432)).toBe('7,2');
    expect(formattaOreDecimali(0)).toBe('0,0');
    expect(formattaOreDecimali(435)).toBe('7,3');
  });

  it('saldo con segno: più, meno vero (U+2212) e zero con il più', () => {
    expect(formattaSaldoOre(18)).toBe('+0,3');
    expect(formattaSaldoOre(-432)).toBe('−7,2');
    expect(formattaSaldoOre(0)).toBe('+0,0');
    // −0,04 h arrotonda a zero: nessun «−0,0».
    expect(formattaSaldoOre(-2)).toBe('+0,0');
  });

  it('ore di riposo: intere senza decimali, altrimenti una cifra', () => {
    expect(formattaOreCompatte(540)).toBe('9');
    expect(formattaOreCompatte(570)).toBe('9,5');
    expect(formattaOreCompatte(480)).toBe('8');
    expect(formattaOreCompatte(659)).toBe('11,0');
  });

  it('ora e data da un istante, a Europe/Rome (con il cambio d’ora)', () => {
    // 2026-12-03 08:14 UTC = 09:14 a Roma (CET); 2026-07-01 12:00 UTC = 14:00 (CEST).
    expect(formattaOraDaMs(Date.UTC(2026, 11, 3, 8, 14))).toBe('09:14');
    expect(formattaOraDaMs(Date.UTC(2026, 6, 1, 12, 0))).toBe('14:00');
    expect(formattaDataDaMs(Date.UTC(2026, 11, 3, 8, 14))).toBe('03/12/2026');
    // Mezzanotte di Roma è ancora il giorno prima in UTC.
    expect(formattaDataDaMs(Date.UTC(2026, 11, 2, 23, 30))).toBe('03/12/2026');
  });

  it('giorno completo e intervallo di giorni', () => {
    expect(formattaGiornoCompleto('2026-11-03')).toBe('martedì 3 novembre 2026');
    expect(formattaGiornoCompleto('2026-11-01')).toBe('domenica 1 novembre 2026');
    expect(formattaGiornoCompleto('boh')).toBe('boh');
    expect(formattaIntervalloGiorni('2026-11-09', '2026-11-15')).toBe('9–15 nov');
    expect(formattaIntervalloGiorni('2026-11-30', '2026-12-06')).toBe('30 nov – 6 dic');
    expect(formattaIntervalloGiorni('2026-11-05', '2026-11-05')).toBe('5 nov');
  });
});
