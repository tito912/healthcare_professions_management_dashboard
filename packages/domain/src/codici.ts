// Formati dei codici e dei valori di primo livello (D9, ARCHITETTURA §4 e §7).
// Le espressioni sono ripetute identiche in firestore.rules: tests/regole/codici.test.ts lo verifica.
// La validazione con il motivo (messaggi del modulo) arriva con lo step 1.3.
import type { CodiceAssenza, CodiceTurno } from './tipi';

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
