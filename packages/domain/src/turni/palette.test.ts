import { describe, expect, it } from 'vitest';
import { ID_COLORI_TURNO } from '../tipi';
import { PALETTE_TURNI, coloreTurno, contrasto } from './palette';

describe('PALETTE_TURNI', () => {
  it('ha i dodici colori nell’ordine di ID_COLORI_TURNO', () => {
    expect(PALETTE_TURNI.map((c) => c.id)).toEqual([...ID_COLORI_TURNO]);
  });

  it.each(PALETTE_TURNI.map((c) => [c.id, c] as const))(
    '%s: contrasto testo/sfondo almeno 4,5:1',
    (_id, colore) => {
      expect(contrasto(colore.testo, colore.sfondo)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(PALETTE_TURNI.map((c) => [c.id, c] as const))(
    '%s: il bordo stacca dal fondo bianco o dallo sfondo (almeno 3:1)',
    (_id, colore) => {
      const contro = Math.max(
        contrasto(colore.bordo, '#FFFFFF'),
        contrasto(colore.bordo, colore.sfondo),
      );
      expect(contro).toBeGreaterThanOrEqual(3);
    },
  );

  it('i valori calcolati coincidono con la tabella di UX §5.1', () => {
    const atteso: Record<string, number> = {
      arancio: 10.52,
      ambra: 12.3,
      sabbia: 12.12,
      lime: 13.58,
      verde: 12.63,
      acqua: 11.99,
      azzurro: 10.64,
      lavanda: 9.61,
      rosa: 9.78,
      corallo: 9.35,
      'blu-notte': 10.36,
      ardesia: 7.58,
    };
    for (const colore of PALETTE_TURNI) {
      expect(contrasto(colore.testo, colore.sfondo)).toBeCloseTo(atteso[colore.id] ?? NaN, 1);
    }
  });

  it('gli sfondi sono tutti distinti', () => {
    expect(new Set(PALETTE_TURNI.map((c) => c.sfondo)).size).toBe(PALETTE_TURNI.length);
  });

  it('coloreTurno trova per ID', () => {
    expect(coloreTurno('ardesia')?.sfondo).toBe('#475569');
    expect(coloreTurno('inesistente')).toBeUndefined();
  });
});
