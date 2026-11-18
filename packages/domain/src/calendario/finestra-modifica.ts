// Finestra di modifica (D8, L6, L7) e momento della convalida (L5). `oggi` arriva sempre come parametro.
import { dataISO } from '../codici';
import type { ChiaveMese, DataISO } from '../tipi';
import { chiaveMeseDi, spostaMese } from './mesi';

/**
 * Un mese è creabile e modificabile se non va oltre `n` mesi dopo quello di `oggi` (D8: 2 in produzione,
 * di più sugli emulatori). Nessun limite verso il passato (L6). Le regole Firestore non la verificano (L7).
 * `n` deve essere un intero non negativo: un valore diverso è un errore di configurazione e lancia.
 */
export function meseModificabile(mese: ChiaveMese, oggi: DataISO, n: number): boolean {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Finestra di modifica non valida: ${String(n)}`);
  }
  return mese <= spostaMese(chiaveMeseDi(oggi), n);
}

/** Primo giorno in cui il mese si può convalidare: il primo del mese successivo (L5). */
export function primoGiornoConvalida(mese: ChiaveMese): DataISO {
  return dataISO(`${spostaMese(mese, 1)}-01`);
}

/** Il mese si convalida solo quando è concluso, cioè dal primo giorno del mese successivo (L5). */
export function convalidaConsentita(mese: ChiaveMese, oggi: DataISO): boolean {
  return oggi >= primoGiornoConvalida(mese);
}
