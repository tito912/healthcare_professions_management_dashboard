// Pausa proposta (D5): 30 minuti per i turni diurni, 0 per i notturni e per le reperibilità.
import type { Minuti, OraLocale } from '../tipi';
import { eNotturno } from './notturno';

export const PAUSA_DIURNO_MINUTI: Minuti = 30;
export const PAUSA_MASSIMA_MINUTI: Minuti = 240;

export function pausaProposta(
  tipo: 'turno' | 'reperibilita',
  inizio: OraLocale,
  fine: OraLocale,
): Minuti {
  if (tipo === 'reperibilita' || eNotturno(inizio, fine)) {
    return 0;
  }
  return PAUSA_DIURNO_MINUTI;
}
