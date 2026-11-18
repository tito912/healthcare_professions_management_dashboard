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

/** Durata in minuti per lo schermo: «6 h 30», «9 h», «45 min». Le ore decimali non esistono fuori da qui. */
export function formattaDurata(minuti: number): string {
  const interi = Math.max(0, Math.round(minuti));
  const ore = Math.floor(interi / 60);
  const resto = interi % 60;
  if (ore === 0) {
    return `${resto} min`;
  }
  return resto === 0 ? `${ore} h` : `${ore} h ${resto}`;
}

const ESPRESSIONE_DATA = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** «18/11/2026» dalla data 'AAAA-MM-GG'; il testo stesso se non è una data. */
export function formattaData(data: string): string {
  const parti = ESPRESSIONE_DATA.exec(data);
  return parti === null ? data : `${parti[3]}/${parti[2]}/${parti[1]}`;
}
