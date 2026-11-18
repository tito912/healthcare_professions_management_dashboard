// Modello di partenza della tabella dei turni (U11, orari di docs/img/griglia.png): modificabile e rimovibile.
import { codiceTurno, oraLocale } from '../codici';
import type { CodiceTurno, IdColoreTurno, Minuti, OraLocale } from '../tipi';
import { eNotturno } from './notturno';

export interface TurnoModello {
  readonly codice: CodiceTurno;
  readonly nome: string;
  readonly colore: IdColoreTurno;
  readonly inizio: OraLocale;
  readonly fine: OraLocale;
  readonly pausaMinuti: Minuti;
  readonly notturno: boolean;
}

function turnoModello(
  codice: string,
  nome: string,
  colore: IdColoreTurno,
  inizio: string,
  fine: string,
  pausaMinuti: Minuti,
): TurnoModello {
  const da = oraLocale(inizio);
  const a = oraLocale(fine);
  return {
    codice: codiceTurno(codice),
    nome,
    colore,
    inizio: da,
    fine: a,
    pausaMinuti,
    notturno: eNotturno(da, a),
  };
}

/** M1 Mattina 07:00-14:00, P1 Pomeriggio 14:00-22:00 (pausa 30), N1 Notte 22:00-07:00 (pausa 0). */
export const TURNI_MODELLO: readonly TurnoModello[] = [
  turnoModello('M1', 'Mattina', 'arancio', '07:00', '14:00', 30),
  turnoModello('P1', 'Pomeriggio', 'verde', '14:00', '22:00', 30),
  turnoModello('N1', 'Notte', 'ardesia', '22:00', '07:00', 0),
];
