// Durata di un turno (ARCHITETTURA §5.3): sempre in minuti interi, mai ore decimali.
import { DateTime } from 'luxon';
import { FUSO } from '../impostazioni';
import type { DataISO, Minuti, OraLocale } from '../tipi';

const MINUTI_GIORNO = 24 * 60;

function minutiDallaMezzanotte(ora: OraLocale): Minuti {
  const [ore = '0', minuti = '0'] = ora.split(':');
  return Number(ore) * 60 + Number(minuti);
}

/**
 * Durata nominale, senza pausa e senza cambio d'ora: se la fine non segue l'inizio il turno termina il giorno
 * dopo (22:00-00:00 = 2 ore); inizio e fine uguali sono 24 ore (L8).
 */
export function durataNominale(inizio: OraLocale, fine: OraLocale): Minuti {
  const da = minutiDallaMezzanotte(inizio);
  const a = minutiDallaMezzanotte(fine);
  return a > da ? a - da : a - da + MINUTI_GIORNO;
}

/** Durata nominale meno la pausa (D5), mai negativa. */
export function durataConPausa(inizio: OraLocale, fine: OraLocale, pausaMinuti: Minuti): Minuti {
  return Math.max(0, durataNominale(inizio, fine) - pausaMinuti);
}

/**
 * Durata reale di un turno che inizia nel giorno dato, a Europe/Rome: nella notte del cambio d'ora è un'ora
 * più lunga o più corta della nominale. Con la pausa già sottratta.
 */
export function durataEffettiva(
  giorno: DataISO,
  inizio: OraLocale,
  fine: OraLocale,
  pausaMinuti: Minuti,
): Minuti {
  const partenza = DateTime.fromISO(`${giorno}T${inizio}`, { zone: FUSO });
  const [oreFine = '0', minutiFine = '0'] = fine.split(':');
  const giorniDopo = fine > inizio ? 0 : 1;
  const arrivo = partenza
    .plus({ days: giorniDopo })
    .set({ hour: Number(oreFine), minute: Number(minutiFine) });
  return Math.max(0, Math.round(arrivo.diff(partenza, 'minutes').minutes) - pausaMinuti);
}
