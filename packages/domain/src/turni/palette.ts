// Palette dei turni (UX §5.1): costante unica, usata da browser e dal report Excel.
// Gli ID e il loro ordine sono quelli di ID_COLORI_TURNO (ripetuti in firestore.rules, `coloriTurno()`).
import type { IdColoreTurno } from '../tipi';

export interface ColoreTurno {
  readonly id: IdColoreTurno;
  readonly nome: string;
  /** Sfondo del chip, '#RRGGBB'. */
  readonly sfondo: string;
  /** Colore del testo (e dei segni negli angoli del chip). */
  readonly testo: string;
  /** Bordo del chip: stacca dal fondo bianco i chip chiari. */
  readonly bordo: string;
}

export const PALETTE_TURNI: readonly ColoreTurno[] = [
  { id: 'arancio', nome: 'Arancio', sfondo: '#FDBA74', testo: '#111827', bordo: '#C2410C' },
  { id: 'ambra', nome: 'Ambra', sfondo: '#FCD34D', testo: '#111827', bordo: '#B45309' },
  { id: 'sabbia', nome: 'Sabbia', sfondo: '#E7D3B0', testo: '#111827', bordo: '#92400E' },
  { id: 'lime', nome: 'Lime', sfondo: '#BEF264', testo: '#111827', bordo: '#4D7C0F' },
  { id: 'verde', nome: 'Verde', sfondo: '#86EFAC', testo: '#111827', bordo: '#15803D' },
  { id: 'acqua', nome: 'Acqua', sfondo: '#5EEAD4', testo: '#111827', bordo: '#0F766E' },
  { id: 'azzurro', nome: 'Azzurro', sfondo: '#7DD3FC', testo: '#111827', bordo: '#0369A1' },
  { id: 'lavanda', nome: 'Lavanda', sfondo: '#C4B5FD', testo: '#111827', bordo: '#6D28D9' },
  { id: 'rosa', nome: 'Rosa', sfondo: '#F9A8D4', testo: '#111827', bordo: '#BE185D' },
  { id: 'corallo', nome: 'Corallo', sfondo: '#FCA5A5', testo: '#111827', bordo: '#B91C1C' },
  { id: 'blu-notte', nome: 'Blu notte', sfondo: '#1E3A8A', testo: '#FFFFFF', bordo: '#172554' },
  { id: 'ardesia', nome: 'Ardesia', sfondo: '#475569', testo: '#FFFFFF', bordo: '#1E293B' },
];

/** Colore della palette dato l'ID; undefined se non esiste. */
export function coloreTurno(id: string): ColoreTurno | undefined {
  return PALETTE_TURNI.find((colore) => colore.id === id);
}

function canale(esadecimale: string): number {
  const c = parseInt(esadecimale, 16) / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Luminanza relativa WCAG 2.x di un colore '#RRGGBB'. */
export function luminanzaRelativa(colore: string): number {
  const r = canale(colore.slice(1, 3));
  const g = canale(colore.slice(3, 5));
  const b = canale(colore.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapporto di contrasto WCAG 2.x tra due colori '#RRGGBB' (da 1 a 21). */
export function contrasto(a: string, b: string): number {
  const la = luminanzaRelativa(a);
  const lb = luminanzaRelativa(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
