import { describe, expect, it } from 'vitest';
import { formattaMese } from './formato';

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
