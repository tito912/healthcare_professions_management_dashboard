// Finestra di modifica (D8, L6) e convalida dal primo giorno del mese successivo (L5).
import { describe, expect, it } from 'vitest';
import { d, m } from '../test-utili';
import { convalidaConsentita, meseModificabile, primoGiornoConvalida } from './finestra-modifica';

describe('meseModificabile (D8)', () => {
  it.each([
    // mese, oggi, n, atteso
    ['2026-11', '2026-11-18', 2, true],
    ['2026-12', '2026-11-18', 2, true],
    ['2027-01', '2026-11-18', 2, true], // 2 mesi dopo quello corrente, a cavallo d'anno
    ['2027-02', '2026-11-18', 2, false],
    ['2020-01', '2026-11-18', 2, true], // nessun limite verso il passato (L6)
    ['2027-02', '2026-12-31', 2, true],
    ['2027-03', '2026-12-31', 2, false],
    ['2026-11', '2026-11-18', 0, true],
    ['2026-12', '2026-11-18', 0, false],
    ['2028-11', '2026-11-18', 24, true], // finestra degli emulatori
    ['2028-12', '2026-11-18', 24, false],
    ['2026-03', '2026-01-31', 2, true],
    ['2026-04', '2026-01-31', 2, false],
  ])('%s con oggi %s e n = %i: %s', (mese, oggi, n, atteso) => {
    expect(meseModificabile(m(mese), d(oggi), n)).toBe(atteso);
  });

  it.each([-1, 1.5, Number.NaN])('rifiuta una finestra non valida (%s)', (n) => {
    expect(() => meseModificabile(m('2026-11'), d('2026-11-18'), n)).toThrow();
  });
});

describe('convalidaConsentita (L5)', () => {
  it.each([
    ['2026-11', '2026-11-30', false],
    ['2026-11', '2026-12-01', true],
    ['2026-12', '2026-12-31', false],
    ['2026-12', '2027-01-01', true],
    ['2025-01', '2026-11-18', true],
    ['2027-01', '2026-11-18', false],
    ['2028-02', '2028-02-29', false],
    ['2028-02', '2028-03-01', true],
  ])('%s con oggi %s: %s', (mese, oggi, atteso) => {
    expect(convalidaConsentita(m(mese), d(oggi))).toBe(atteso);
  });

  it.each([
    ['2026-11', '2026-12-01'],
    ['2026-12', '2027-01-01'],
    ['2028-02', '2028-03-01'],
  ])('primoGiornoConvalida(%s) = %s', (mese, atteso) => {
    expect(primoGiornoConvalida(m(mese))).toBe(atteso);
  });
});
