import { describe, expect, it } from 'vitest';
import { formattaData, formattaDurata, formattaMese } from './formato';

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
