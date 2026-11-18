import { describe, expect, it } from 'vitest';
import { d, m } from '../test-utili';
import {
  chiaveGiornoDi,
  chiaveMeseDa,
  chiaveMeseDi,
  dataDelGiorno,
  eChiaveGiorno,
  giorniDelMese,
  giorniMassimiNelMese,
  giorniNelMese,
  giornoDellaSettimana,
  spostaGiorni,
  spostaMese,
} from './mesi';

describe('giorni del mese', () => {
  it.each([
    ['2026-01', 31],
    ['2026-02', 28],
    ['2028-02', 29],
    ['2100-02', 28],
    ['2000-02', 29],
    ['2026-04', 30],
    ['2026-11', 30],
    ['2026-12', 31],
  ])('%s ha %i giorni', (chiave, giorni) => {
    const elenco = giorniDelMese(m(chiave));
    expect(elenco).toHaveLength(giorni);
    expect(elenco[0]).toBe(`${chiave}-01`);
    expect(elenco.at(-1)).toBe(`${chiave}-${String(giorni)}`);
  });

  it('giorniNelMese e giorniMassimiNelMese restano coerenti', () => {
    expect(giorniNelMese(2028, 2)).toBe(29);
    expect(giorniNelMese(2026, 13)).toBe(0);
    expect(giorniMassimiNelMese(2)).toBe(29);
    expect(chiaveMeseDa(2026, 3)).toBe('2026-03');
  });

  it.each([
    ['2026-11', '30', '2026-11-30'],
    ['2026-11', '31', null],
    ['2026-02', '29', null],
    ['2028-02', '29', '2028-02-29'],
    ['2026-12', '01', '2026-12-01'],
  ] as const)('dataDelGiorno(%s, %s) = %s', (chiave, giorno, attesa) => {
    expect(dataDelGiorno(m(chiave), giorno)).toBe(attesa);
  });

  it('chiave del giorno e del mese di una data', () => {
    expect(chiaveGiornoDi(d('2026-11-05'))).toBe('05');
    expect(chiaveGiornoDi(d('2026-12-31'))).toBe('31');
    expect(chiaveMeseDi(d('2026-11-05'))).toBe('2026-11');
  });

  it.each([
    ['07', true],
    ['31', true],
    ['7', false],
    ['00', false],
    ['32', false],
    ['xx', false],
  ])('eChiaveGiorno(%s) = %s', (testo, atteso) => {
    expect(eChiaveGiorno(testo)).toBe(atteso);
  });
});

describe('spostamenti', () => {
  it.each([
    ['2026-11', 0, '2026-11'],
    ['2026-11', 1, '2026-12'],
    ['2026-11', 2, '2027-01'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', -14, '2025-01'],
  ])('spostaMese(%s, %i) = %s', (chiave, mesi, attesa) => {
    expect(spostaMese(m(chiave), mesi)).toBe(attesa);
  });

  it.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-03-28', 1, '2026-03-29'],
    ['2026-10-25', 1, '2026-10-26'],
  ])('spostaGiorni(%s, %i) = %s, anche nei giorni del cambio d’ora', (data, giorni, attesa) => {
    expect(spostaGiorni(d(data), giorni)).toBe(attesa);
  });

  it.each([
    ['2026-11-16', 1],
    ['2026-11-14', 6],
    ['2026-11-01', 7],
    ['2028-02-29', 2],
  ])('giornoDellaSettimana(%s) = %i (1 lunedì, 7 domenica)', (data, atteso) => {
    expect(giornoDellaSettimana(d(data))).toBe(atteso);
  });
});
