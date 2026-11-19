// Scadenza dei documenti della coda `mail` (L17): la politica TTL di Firestore li elimina dopo `GIORNI_SCADENZA_MAIL`
// giorni. Il calcolo sta nel dominio perché fuori da qui non si usano date (CLAUDE.md).
import { DateTime } from 'luxon';
import { FUSO, GIORNI_SCADENZA_MAIL } from '../impostazioni';

/** Istante di scadenza (millisecondi dall'epoca) di una email accodata all'istante `adessoMs`, in giorni di calendario. */
export function scadenzaMail(adessoMs: number, giorni: number = GIORNI_SCADENZA_MAIL): number {
  return DateTime.fromMillis(adessoMs, { zone: FUSO }).plus({ days: giorni }).toMillis();
}
