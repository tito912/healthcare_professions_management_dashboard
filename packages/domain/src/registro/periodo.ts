// Filtro per periodo del registro attività (UX §7.12): da `dal` incluso ad `al` incluso, a Europe/Rome.
import { DateTime } from 'luxon';
import { FUSO } from '../impostazioni';
import type { DataISO } from '../tipi';

export interface LimitiPeriodo {
  /** Millisecondi dell'inizio del primo giorno (incluso), o null se il filtro non c'è. */
  readonly daMs: number | null;
  /** Millisecondi dell'inizio del giorno dopo l'ultimo (escluso), o null se il filtro non c'è. */
  readonly aMs: number | null;
}

/** Limiti in millisecondi del periodo; il giorno del cambio d'ora dura 23 o 25 ore e va comunque preso per intero. */
export function limitiPeriodo(dal: DataISO | null, al: DataISO | null): LimitiPeriodo {
  return {
    daMs: dal === null ? null : DateTime.fromISO(dal, { zone: FUSO }).startOf('day').toMillis(),
    aMs:
      al === null
        ? null
        : DateTime.fromISO(al, { zone: FUSO }).plus({ days: 1 }).startOf('day').toMillis(),
  };
}
