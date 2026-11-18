// Ambiente di esecuzione delle Functions: serve a decidere se è lecito usare le implementazioni «non sicure»
// pensate solo per l'emulatore (cifratura locale, chiave HMAC di prova).

/** Vero solo sull'emulatore delle Functions (`FUNCTIONS_EMULATOR` vale 'true'); mai in produzione. */
export function inEmulatore(): boolean {
  return process.env['FUNCTIONS_EMULATOR'] === 'true';
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
