// Ambiente di esecuzione delle Functions: serve a decidere se è lecito usare le implementazioni «non sicure»
// pensate solo per l'emulatore (cifratura locale, chiave HMAC di prova).
import * as logger from 'firebase-functions/logger';

/**
 * Vero solo sull'emulatore. `FUNCTIONS_EMULATOR` da solo non basta: la CLI Firebase non la riserva, quindi una
 * riga in `functions/.env` arriverebbe anche in produzione. Si chiedono perciò tre segnali insieme:
 * - `FUNCTIONS_EMULATOR === 'true'`;
 * - progetto `demo-*` (`GCLOUD_PROJECT` è riservata: in produzione non si può impostare e il progetto è quello vero);
 * - `FIRESTORE_EMULATOR_HOST` presente (lo imposta l'emulatore; in produzione bloccherebbe ogni scrittura).
 */
export function inEmulatore(): boolean {
  const progetto = process.env['GCLOUD_PROJECT'] ?? '';
  const emulatoreFirestore = process.env['FIRESTORE_EMULATOR_HOST'] ?? '';
  return (
    process.env['FUNCTIONS_EMULATOR'] === 'true' &&
    progetto.startsWith('demo-') &&
    emulatoreFirestore !== ''
  );
}

let avvisoEmesso = false;

/** Una sola volta per processo: segnala nei log (senza dati) che si usano cifratura e chiave HMAC di prova. */
export function avvisaCifraturaNonSicura(): void {
  if (avvisoEmesso) {
    return;
  }
  avvisoEmesso = true;
  logger.warn('Cifratura locale non sicura e chiave HMAC di prova attive: solo emulatore.');
}

/**
 * Cifratura o chiave non configurate fuori dall'emulatore. Non si ripiega mai su una cifratura finta:
 * la callable fallisce con ERRORE_INTERNO e nei log finisce il nome dell'errore (e il parametro mancante,
 * che non è un dato personale).
 */
export class ConfigurazioneMancanteError extends Error {
  constructor(readonly parametro: string) {
    super(`Configurazione mancante: ${parametro}`);
    this.name = 'ConfigurazioneMancanteError';
  }
}
