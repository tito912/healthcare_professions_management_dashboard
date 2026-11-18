// Cifratura dei dati riservati dei dipendenti (ARCHITETTURA §5.6, §8). Un campo si cifra con un contesto
// autenticato (AAD) che lo lega al dipendente e al campo: un testo cifrato copiato in un altro documento
// o in un altro campo non si decifra.
import * as logger from 'firebase-functions/logger';
import { KMS_CHIAVE_DIPENDENTI } from '../../comune/parametri';
import { avvisaCifraturaNonSicura, ConfigurazioneMancanteError, inEmulatore } from './ambiente';
import { CifratoreEmulatore } from './cifratore-emulatore';
import { CifratoreKms } from './cifratore-kms';

export interface TestoCifrato {
  /** Testo cifrato in base64. */
  readonly cifrato: string;
  /** Chiave (o versione) usata: finisce in `DatiPrivatiDoc.chiaveKms`. */
  readonly chiave: string;
}

export interface Cifratore {
  cifra(testo: string, aad: string): Promise<TestoCifrato>;
  decifra(cifratoBase64: string, aad: string): Promise<string>;
}

/** AAD del codice fiscale e della data di nascita di un dipendente (ARCHITETTURA §5.6). */
export function aadCodiceFiscale(dipendenteId: string): string {
  return `${dipendenteId}:codiceFiscale`;
}

export function aadDataNascita(dipendenteId: string): string {
  return `${dipendenteId}:dataNascita`;
}

export interface AmbienteCifratura {
  readonly emulatore: boolean;
  /** Nome completo della chiave KMS; vuoto se non configurata. */
  readonly chiaveKms: string;
}

/**
 * Sceglie l'implementazione. Sull'emulatore (vedi `inEmulatore`: variabile, progetto `demo-*` e host di Firestore) la cifratura locale non sicura;
 * altrove Cloud KMS. Senza KMS configurato fuori dall'emulatore: errore, mai una cifratura finta.
 */
export function creaCifratore(ambiente: AmbienteCifratura): Cifratore {
  if (ambiente.emulatore) {
    avvisaCifraturaNonSicura();
    return new CifratoreEmulatore();
  }
  if (ambiente.chiaveKms.trim() === '') {
    logger.error('Cifratura non configurata: manca il parametro', {
      parametro: 'KMS_CHIAVE_DIPENDENTI',
    });
    throw new ConfigurazioneMancanteError('KMS_CHIAVE_DIPENDENTI');
  }
  return new CifratoreKms(ambiente.chiaveKms.trim());
}

/** Il cifratore dell'ambiente corrente (emulatore o produzione). */
export function cifratoreCorrente(): Cifratore {
  return creaCifratore({ emulatore: inEmulatore(), chiaveKms: KMS_CHIAVE_DIPENDENTI.value() });
}
