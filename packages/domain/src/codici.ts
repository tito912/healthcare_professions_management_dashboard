// Formati dei codici e dei valori di primo livello (D9, ARCHITETTURA §4 e §7).
// Le espressioni sono ripetute identiche in firestore.rules: tests/regole/codici.test.ts lo verifica.
import { DateTime } from 'luxon';
import type { ChiaveMese, CodiceAssenza, CodiceTurno, DataISO, OraLocale } from './tipi';

/** Turni e reperibilità: una lettera maiuscola e una cifra (M1, N1, R2). */
export const REGEX_CODICE_TURNO = /^[A-Z][0-9]$/;
/** Assenze: una o due lettere maiuscole (F, R, MA). Non collide con i turni. */
export const REGEX_CODICE_ASSENZA = /^[A-Z]{1,2}$/;
/** Ora locale 'HH:mm' da 00:00 a 23:59. */
export const REGEX_ORA_LOCALE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
/** Data 'AAAA-MM-GG' (forma; l'esistenza del giorno la verifica il dominio con Luxon). */
export const REGEX_DATA_ISO = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
/** Mese 'AAAA-MM': ID del documento del mese. */
export const REGEX_CHIAVE_MESE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

export function eCodiceTurno(valore: string): valore is CodiceTurno {
  return REGEX_CODICE_TURNO.test(valore);
}

export function eCodiceAssenza(valore: string): valore is CodiceAssenza {
  return REGEX_CODICE_ASSENZA.test(valore);
}

export function eOraLocale(valore: string): valore is OraLocale {
  return REGEX_ORA_LOCALE.test(valore);
}

/** Forma 'AAAA-MM-GG' e giorno esistente nel calendario (2026-02-30 non lo è). */
export function eDataISO(valore: string): valore is DataISO {
  return REGEX_DATA_ISO.test(valore) && DateTime.fromISO(valore, { zone: 'utc' }).isValid;
}

/** Costruttori dei tipi marcati (ARCHITETTURA §4): lanciano un errore se il formato non è valido. */
export function codiceTurno(valore: string): CodiceTurno {
  if (!eCodiceTurno(valore)) {
    throw new Error(`Codice di turno non valido: ${valore}`);
  }
  return valore;
}

export function codiceAssenza(valore: string): CodiceAssenza {
  if (!eCodiceAssenza(valore)) {
    throw new Error(`Codice di assenza non valido: ${valore}`);
  }
  return valore;
}

export function oraLocale(valore: string): OraLocale {
  if (!eOraLocale(valore)) {
    throw new Error(`Ora non valida: ${valore}`);
  }
  return valore;
}

export function dataISO(valore: string): DataISO {
  if (!eDataISO(valore)) {
    throw new Error(`Data non valida: ${valore}`);
  }
  return valore;
}

export function eChiaveMese(valore: string): valore is ChiaveMese {
  return REGEX_CHIAVE_MESE.test(valore);
}

export function chiaveMese(valore: string): ChiaveMese {
  if (!eChiaveMese(valore)) {
    throw new Error(`Chiave di mese non valida: ${valore}`);
  }
  return valore;
}

/** Maiuscolo e senza spazi ai bordi: come il campo del codice si normalizza mentre si digita. */
export function normalizzaCodice(testo: string): string {
  return testo.trim().toUpperCase();
}

export type TipoCodice = 'turno' | 'assenza';

/**
 * Perché un codice non è accettabile:
 * - `vuoto`: nessun codice;
 * - `formato`: non rispetta il formato del suo gruppo (D9);
 * - `altroGruppo`: è un codice valido ma dell'altro gruppo (un codice da turno scritto in un'assenza o viceversa);
 * - `duplicato`: è già usato da un turno, una fascia o un'assenza (`usatoDa`).
 */
export type MotivoCodiceNonValido = 'vuoto' | 'formato' | 'altroGruppo' | 'duplicato';

/** Un codice già presente nella configurazione, con il nome o la descrizione per il messaggio. */
export interface CodiceUsato {
  readonly codice: string;
  readonly nome: string;
}

export type EsitoCodice =
  | { readonly valido: true; readonly codice: string }
  | {
      readonly valido: false;
      readonly motivo: MotivoCodiceNonValido;
      /** Solo per `duplicato`: chi lo usa già. */
      readonly usatoDa?: CodiceUsato;
    };

/**
 * Valida un codice (D9): formato del gruppo e assenza di collisioni con gli altri codici di turni,
 * reperibilità e assenze (`usati` li comprende tutti, esclusa la riga che si sta modificando).
 */
export function validaCodice(
  valore: string,
  tipo: TipoCodice,
  usati: readonly CodiceUsato[],
): EsitoCodice {
  const codice = normalizzaCodice(valore);
  if (codice === '') {
    return { valido: false, motivo: 'vuoto' };
  }
  const formatoGiusto = tipo === 'turno' ? eCodiceTurno(codice) : eCodiceAssenza(codice);
  if (!formatoGiusto) {
    const dellAltroGruppo = tipo === 'turno' ? eCodiceAssenza(codice) : eCodiceTurno(codice);
    return { valido: false, motivo: dellAltroGruppo ? 'altroGruppo' : 'formato' };
  }
  const gia = usati.find((u) => u.codice === codice);
  if (gia !== undefined) {
    return { valido: false, motivo: 'duplicato', usatoDa: gia };
  }
  return { valido: true, codice };
}
