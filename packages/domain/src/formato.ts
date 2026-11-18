// Formattazione italiana per lo schermo (sostituisce DatePipe, che nel browser è vietato).
import { DateTime } from 'luxon';
import { FUSO } from './impostazioni';

const ESPRESSIONE_CHIAVE_MESE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** «Novembre 2026» dalla chiave 'AAAA-MM'; la chiave stessa se non è valida. */
export function formattaMese(chiaveMese: string): string {
  if (!ESPRESSIONE_CHIAVE_MESE.test(chiaveMese)) {
    return chiaveMese;
  }
  const data = DateTime.fromFormat(chiaveMese, 'yyyy-MM', { zone: FUSO, locale: 'it' });
  if (!data.isValid) {
    return chiaveMese;
  }
  const testo = data.toFormat('LLLL yyyy');
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}
