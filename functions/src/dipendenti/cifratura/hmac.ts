// HMAC-SHA256 del codice fiscale normalizzato (ARCHITETTURA §5.6, §5.7): è l'ID del documento
// `indiceCodiciFiscali/{hmac}`, che impedisce i doppioni senza conservare il codice in chiaro nell'indice.
import { createHmac } from 'node:crypto';
import { normalizzaCodiceFiscale } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import type { SecretParam } from 'firebase-functions/params';
import { HMAC_CF_CHIAVE } from '../../comune/parametri';
import { ConfigurazioneMancanteError, inEmulatore } from './ambiente';

/** CHIAVE DI PROVA NON SICURA: solo sull'emulatore, quando `functions/.secret.local` non c'è. */
export const CHIAVE_HMAC_EMULATORE = 'hmac-emulatore-NON-SICURA-chiave-di-prova';
/** Lunghezza minima di una chiave vera: 32 caratteri (almeno 128 bit con una chiave casuale esadecimale). */
export const LUNGHEZZA_MINIMA_CHIAVE_HMAC = 32;

/** HMAC-SHA256 esadecimale del codice fiscale (normalizzato qui: maiuscolo e senza spazi). */
export function hmacCodiceFiscale(chiave: string, codiceFiscale: string): string {
  return createHmac('sha256', chiave).update(normalizzaCodiceFiscale(codiceFiscale)).digest('hex');
}

/**
 * Chiave da usare: il secret; sull'emulatore, se è vuoto, quella di prova. Fuori dall'emulatore un secret
 * vuoto o troppo corto è un errore (mai una chiave di ripiego).
 */
export function sceltaChiaveHmac(secret: string, emulatore: boolean): string {
  if (emulatore) {
    return secret === '' ? CHIAVE_HMAC_EMULATORE : secret;
  }
  if (secret.length < LUNGHEZZA_MINIMA_CHIAVE_HMAC) {
    logger.error('Chiave HMAC non configurata o troppo corta', { parametro: 'HMAC_CF_CHIAVE' });
    throw new ConfigurazioneMancanteError('HMAC_CF_CHIAVE');
  }
  return secret;
}

export function chiaveHmacCorrente(): string {
  const emulatore = inEmulatore();
  // Sull'emulatore il secret non è dichiarato alla funzione (vedi `segretiDellaFunzione`): `.value()` darebbe
  // un avviso a ogni chiamata. Se esiste `functions/.secret.local`, l'emulatore ne mette i valori nell'ambiente.
  const secret = emulatore ? (process.env['HMAC_CF_CHIAVE'] ?? '') : HMAC_CF_CHIAVE.value();
  return sceltaChiaveHmac(secret, emulatore);
}

/**
 * Secret da dichiarare alla callable. Fuori dall'emulatore: `HMAC_CF_CHIAVE`. Sull'emulatore nessuno: se un
 * secret è dichiarato e manca in `functions/.secret.local`, l'emulatore lo cerca in Secret Manager (un servizio
 * reale) e resta in attesa. Con un `.secret.local` presente il valore arriva comunque nell'ambiente.
 */
export function segretiDellaFunzione(): SecretParam[] {
  return inEmulatore() ? [] : [HMAC_CF_CHIAVE];
}
