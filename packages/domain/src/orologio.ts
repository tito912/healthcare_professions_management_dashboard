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
