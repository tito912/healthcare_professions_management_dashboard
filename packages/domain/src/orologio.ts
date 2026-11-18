// Unico punto del dominio che legge l'ora corrente. Le funzioni di regola ricevono `oggi` come parametro.
import { DateTime } from 'luxon';
import { FUSO } from './impostazioni';

/** Istante corrente nel fuso di riferimento. */
export function adesso(): DateTime {
  return DateTime.now().setZone(FUSO);
}

/** Giorno corrente nel fuso di riferimento, formato AAAA-MM-GG. */
export function oggi(): string {
  return adesso().toFormat('yyyy-LL-dd');
}

/** Mese corrente nel fuso di riferimento, formato AAAA-MM (chiave del documento del mese). */
export function meseCorrente(): string {
  return adesso().toFormat('yyyy-LL');
}

/** Istante corrente in millisecondi dall'epoca: per misurare intervalli (inattività) senza usare Date altrove. */
export function adessoMs(): number {
  return Date.now();
}
