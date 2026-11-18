// CIFRATORE LOCALE NON SICURO: solo per l'emulatore. La chiave sta nel codice, quindi chiunque legga il
// repository può decifrare. Serve a provare il percorso completo (cifra, salva, leggi, decifra) senza
// Cloud KMS; `creaCifratore()` lo sceglie solo se `inEmulatore()` (variabile, progetto demo-* e host di Firestore). Il campo `chiaveKms` dei
// documenti vale 'emulatore-non-sicura', così un documento cifrato così si riconosce subito.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { inEmulatore } from './ambiente';
import type { Cifratore, TestoCifrato } from './cifratore';

export const CHIAVE_EMULATORE = 'emulatore-non-sicura';

// 32 byte fissi: AES-256-GCM. Non è un segreto.
const CHIAVE_FISSA = Buffer.from('turni-reparto-emulatore-NON-SICURA'.padEnd(32, '!').slice(0, 32));
const LUNGHEZZA_IV = 12;
const LUNGHEZZA_TAG = 16;

export class CifratoreEmulatore implements Cifratore {
  constructor() {
    // Seconda difesa: anche se qualcuno la istanziasse a mano in produzione, non parte.
    if (!inEmulatore()) {
      throw new Error('CifratoreEmulatore è disponibile solo sull’emulatore.');
    }
  }

  cifra(testo: string, aad: string): Promise<TestoCifrato> {
    const iv = randomBytes(LUNGHEZZA_IV);
    const cifrario = createCipheriv('aes-256-gcm', CHIAVE_FISSA, iv);
    cifrario.setAAD(Buffer.from(aad, 'utf8'));
    const cifrato = Buffer.concat([cifrario.update(testo, 'utf8'), cifrario.final()]);
    const tag = cifrario.getAuthTag();
    return Promise.resolve({
      cifrato: Buffer.concat([iv, tag, cifrato]).toString('base64'),
      chiave: CHIAVE_EMULATORE,
    });
  }

  decifra(cifratoBase64: string, aad: string): Promise<string> {
    const dati = Buffer.from(cifratoBase64, 'base64');
    const iv = dati.subarray(0, LUNGHEZZA_IV);
    const tag = dati.subarray(LUNGHEZZA_IV, LUNGHEZZA_IV + LUNGHEZZA_TAG);
    const cifrato = dati.subarray(LUNGHEZZA_IV + LUNGHEZZA_TAG);
    const decifrario = createDecipheriv('aes-256-gcm', CHIAVE_FISSA, iv);
    decifrario.setAAD(Buffer.from(aad, 'utf8'));
    decifrario.setAuthTag(tag);
    try {
      return Promise.resolve(
        Buffer.concat([decifrario.update(cifrato), decifrario.final()]).toString('utf8'),
      );
    } catch {
      // Nessun dettaglio: il messaggio della libreria non deve finire nei log.
      return Promise.reject(new Error('Decifratura non riuscita.'));
    }
  }
}
