// Regole dell'anagrafica dei dipendenti (ARCHITETTURA §5.5, L35, L39): ore settimanali, email, data di
// nascita, periodo di servizio e stato a una data. Solo funzioni pure: `oggi` arriva come parametro.
import { z } from 'zod';
import type { DataISO } from '../tipi';

/** Ore settimanali proposte per un nuovo dipendente (L39). */
export const ORE_SETTIMANALI_PREDEFINITE = 36;
export const ORE_SETTIMANALI_MINIME = 1;
export const ORE_SETTIMANALI_MASSIME = 48;
/** Le ore settimanali sono multipli di mezz'ora, così le ore dovute giornaliere restano in minuti interi. */
export const PASSO_ORE_SETTIMANALI = 0.5;

/** Da 1 a 48 a passi di 0,5 (L39). */
export function eOreSettimanaliValide(valore: number): boolean {
  return (
    Number.isFinite(valore) &&
    valore >= ORE_SETTIMANALI_MINIME &&
    valore <= ORE_SETTIMANALI_MASSIME &&
    Number.isInteger(valore / PASSO_ORE_SETTIMANALI)
  );
}

/**
 * Legge le ore scritte a mano («36», «37,5», «37.5»). Restituisce null se il testo non è un numero valido
 * (L39): il campo dell'interfaccia mostra allora l'errore.
 */
export function leggiOreSettimanali(testo: string): number | null {
  const pulito = testo.trim().replace(',', '.');
  if (!/^\d{1,2}(\.\d{1,2})?$/u.test(pulito)) {
    return null;
  }
  const valore = Number(pulito);
  return eOreSettimanaliValide(valore) ? valore : null;
}

export const LUNGHEZZA_MASSIMA_EMAIL = 254;

export type EsitoEmail =
  | { readonly valido: true; readonly email: string }
  | { readonly valido: false; readonly motivo: 'vuota' | 'formato' };

const schemaEmail = z.email().max(LUNGHEZZA_MASSIMA_EMAIL);

/** Email del dipendente: senza spazi ai lati e in minuscolo. Il motivo `vuota` serve a chi la considera facoltativa. */
export function validaEmail(valore: string): EsitoEmail {
  const email = valore.trim().toLowerCase();
  if (email === '') {
    return { valido: false, motivo: 'vuota' };
  }
  return schemaEmail.safeParse(email).success
    ? { valido: true, email }
    : { valido: false, motivo: 'formato' };
}

/** Prima data di nascita ammessa: oltre non si va per distinguere un refuso da una data vera. */
export const DATA_NASCITA_MINIMA = '1900-01-01';

/** La data di nascita esiste (`DataISO`), non è anteriore al 1900 e non è nel futuro rispetto a `oggi`. */
export function dataNascitaPlausibile(dataNascita: string, oggi: string): boolean {
  return dataNascita >= DATA_NASCITA_MINIMA && dataNascita <= oggi;
}

/** Il periodo di servizio è coerente: l'assunzione non segue la cessazione. */
export function periodoServizioValido(
  dataAssunzione: DataISO | null,
  dataCessazione: DataISO | null,
): boolean {
  return dataAssunzione === null || dataCessazione === null || dataAssunzione <= dataCessazione;
}

/** Dati che bastano a stabilire lo stato di un dipendente. */
export interface DatiServizio {
  readonly attivo: boolean;
  readonly dataAssunzione: DataISO | null;
  readonly dataCessazione: DataISO | null;
}

/**
 * Stato a una data (`oggi`), L35:
 * - `cessato`: disattivato, oppure con l'ultimo giorno di servizio già passato;
 * - `cessaIl`: in servizio, con un ultimo giorno oggi o più avanti (`dataCessazione`);
 * - `daAssumere`: l'assunzione è nel futuro;
 * - `inServizio`: tutto il resto.
 */
export type StatoDipendente = 'inServizio' | 'cessaIl' | 'cessato' | 'daAssumere';

export function statoDipendente(dati: DatiServizio, oggi: string): StatoDipendente {
  if (!dati.attivo || (dati.dataCessazione !== null && dati.dataCessazione < oggi)) {
    return 'cessato';
  }
  if (dati.dataCessazione !== null) {
    return 'cessaIl';
  }
  if (dati.dataAssunzione !== null && dati.dataAssunzione > oggi) {
    return 'daAssumere';
  }
  return 'inServizio';
}

/** Chi non è cessato: «In servizio» nel filtro dell'elenco. */
export function eInServizioOCessaDopo(dati: DatiServizio, oggi: string): boolean {
  return statoDipendente(dati, oggi) !== 'cessato';
}
