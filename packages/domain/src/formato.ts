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

/** Ore settimanali per lo schermo, con la virgola: «36,0», «37,5». Le ore decimali esistono solo qui (CLAUDE.md). */
export function formattaOreSettimanali(ore: number): string {
  return ore.toFixed(1).replace('.', ',');
}

/** Minuti in ore con un decimale e la virgola, per le colonne dei totali: 8640 → «144,0» (D4: 7,2 h = 432 min). */
export function formattaOreDecimali(minuti: number): string {
  return (minuti / 60).toFixed(1).replace('.', ',');
}

/** Saldo con segno («+0,3», «−7,2», «+0,0»): il meno è il vero segno meno (U+2212); un valore che arrotonda a zero è «+0,0». */
export function formattaSaldoOre(minuti: number): string {
  const testo = formattaOreDecimali(Math.abs(minuti));
  return minuti < 0 && testo !== '0,0' ? `−${testo}` : `+${testo}`;
}

/** Ore di riposo nei testi degli avvisi: senza decimali se intere («9»), altrimenti una cifra («9,5»). */
export function formattaOreCompatte(minuti: number): string {
  return minuti % 60 === 0 ? String(minuti / 60) : formattaOreDecimali(minuti);
}

/** «09:14» da un istante in millisecondi, a Europe/Rome. */
export function formattaOraDaMs(ms: number): string {
  return DateTime.fromMillis(ms, { zone: FUSO }).toFormat('HH:mm');
}

/** «03/12/2026» da un istante in millisecondi, a Europe/Rome. */
export function formattaDataDaMs(ms: number): string {
  return DateTime.fromMillis(ms, { zone: FUSO }).toFormat('dd/MM/yyyy');
}

function giornoLuxon(data: string): DateTime | null {
  if (!ESPRESSIONE_DATA.test(data)) {
    return null;
  }
  const giorno = DateTime.fromISO(data, { zone: FUSO, locale: 'it' });
  return giorno.isValid ? giorno : null;
}

/** «martedì 3 novembre 2026»: per le etichette accessibili e i suggerimenti delle colonne. */
export function formattaGiornoCompleto(data: string): string {
  return giornoLuxon(data)?.toFormat('cccc d LLLL yyyy') ?? data;
}

/** «9–15 nov» o, a cavallo di mese, «30 nov – 6 dic»; un solo giorno: «5 nov». */
export function formattaIntervalloGiorni(da: string, a: string): string {
  const primo = giornoLuxon(da);
  const ultimo = giornoLuxon(a);
  if (primo === null || ultimo === null) {
    return `${da} – ${a}`;
  }
  if (da === a) {
    return primo.toFormat('d LLL');
  }
  return primo.month === ultimo.month && primo.year === ultimo.year
    ? `${primo.day}–${ultimo.toFormat('d LLL')}`
    : `${primo.toFormat('d LLL')} – ${ultimo.toFormat('d LLL')}`;
}
