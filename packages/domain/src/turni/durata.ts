// Durata di un turno (ARCHITETTURA §5.3): sempre in minuti interi, mai ore decimali.
// Due misure: la nominale (orologio da parete, per la configurazione) e la reale (minuti trascorsi a
// Europe/Rome, per griglia, riposo e banca ore: nella notte del cambio d'ora è un'ora più corta o più lunga).
import { DateTime } from 'luxon';
import { spostaGiorni } from '../calendario/mesi';
import { FUSO } from '../impostazioni';
import type { DataISO, Minuti, OraLocale } from '../tipi';

const MINUTI_GIORNO = 24 * 60;
const MS_MINUTO = 60_000;

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
 * Intervallo reale, in millisecondi dall'epoca: un numero confrontabile e sommabile senza fusi. Resta un dato
 * del dominio: fuori da qui non si converte in `Date`.
 */
export interface IntervalloReale {
  readonly inizioMs: number;
  readonly fineMs: number;
}

/** L'istante di un'ora locale di un giorno, a Europe/Rome. */
export function istanteLocale(giorno: DataISO, ora: OraLocale): number {
  return DateTime.fromISO(`${giorno}T${ora}`, { zone: FUSO }).toMillis();
}

/**
 * Intervallo reale di un turno che inizia nel giorno dato. `fine <= inizio` vuol dire che termina il giorno
 * dopo (22:00-06:00, 18:00-00:00; 08:00-08:00 = 24 ore). Le ore che non esistono (02:30 del giorno in cui le
 * lancette vanno avanti) si spostano avanti di un'ora; quelle ripetute (02:30 del giorno in cui tornano
 * indietro) valgono la seconda volta, nell'ora solare: è il comportamento di Luxon, scritto nei test.
 */
export function intervalloReale(
  giorno: DataISO,
  inizio: OraLocale,
  fine: OraLocale,
): IntervalloReale {
  const giornoFine = fine <= inizio ? spostaGiorni(giorno, 1) : giorno;
  return { inizioMs: istanteLocale(giorno, inizio), fineMs: istanteLocale(giornoFine, fine) };
}

/** Minuti interi di un intervallo reale. */
export function minutiDi(intervallo: IntervalloReale): Minuti {
  return Math.round((intervallo.fineMs - intervallo.inizioMs) / MS_MINUTO);
}

/** Durata reale in minuti: il 22:00-06:00 che termina il 29/03/2026 dura 420, quello che termina il 25/10/2026 540. */
export function durataReale(giorno: DataISO, inizio: OraLocale, fine: OraLocale): Minuti {
  return minutiDi(intervalloReale(giorno, inizio, fine));
}

/** Durata lavorata: durata reale meno la pausa (D5), mai negativa. */
export function durataLavorata(
  giorno: DataISO,
  inizio: OraLocale,
  fine: OraLocale,
  pausaMinuti: Minuti,
): Minuti {
  return Math.max(0, durataReale(giorno, inizio, fine) - pausaMinuti);
}

/** Nome precedente di `durataLavorata` (step 1.3), mantenuto per chi lo usa già. */
export const durataEffettiva = durataLavorata;
