// Parametri e segreti delle Functions (ARCHITETTURA §12). I valori non stanno mai nel codice né nel repository:
// il nome della chiave KMS è un parametro di deploy, la chiave HMAC è un secret di Secret Manager.
import { defineBoolean, defineSecret, defineString } from 'firebase-functions/params';

/**
 * Nome completo della chiave KMS dei dati dei dipendenti:
 * `projects/…/locations/europe-west12/keyRings/…/cryptoKeys/…`. Sull'emulatore non si usa
 * (CifratoreEmulatore). Vuoto fuori dall'emulatore = cifratura non configurata: le funzioni falliscono.
 */
export const KMS_CHIAVE_DIPENDENTI = defineString('KMS_CHIAVE_DIPENDENTI', { default: '' });

/**
 * Chiave dell'HMAC-SHA256 del codice fiscale (indice dei doppioni). Sull'emulatore: `functions/.secret.local`
 * (ignorato da git); se manca, una chiave di prova dichiarata non sicura (vedi `dipendenti/cifratura/hmac.ts`).
 */
export const HMAC_CF_CHIAVE = defineSecret('HMAC_CF_CHIAVE');

/** Mittente delle email del report; vuoto = quello configurato nell'estensione Trigger Email (D12). */
export const POSTA_MITTENTE = defineString('POSTA_MITTENTE', { default: '' });

/**
 * `pulisciCessati` elenca senza cancellare finché il valore non è `false` (ARCHITETTURA §12). Default `true`: la
 * cancellazione definitiva si abilita solo con una scelta esplicita al deploy.
 */
export const PULIZIA_MODALITA_PROVA = defineBoolean('PULIZIA_MODALITA_PROVA', { default: true });
