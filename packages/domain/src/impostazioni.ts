// Costanti del dominio (ARCHITETTURA §12). Modificarle richiede di aggiornare la documentazione.

/** Fuso orario di tutte le regole di calcolo. */
export const FUSO = 'Europe/Rome';

/** Regione unica di Cloud Functions e Firestore. */
export const REGIONE_FUNZIONI = 'europe-west12';

/** Mesi modificabili dal coordinatore in produzione (con gli emulatori il valore è più ampio). */
export const FINESTRA_MESI_PRODUZIONE = 2;

/**
 * Righe al massimo in una transazione di «Salva bozza» o in un batch di «Aggiungi mese».
 * Lo step 1.1 lo verifica sull'emulatore con le regole vere (tests/regole/limiti.test.ts): con questo
 * valore la transazione resta entro il limite di accessi a documenti e di espressioni delle regole.
 */
export const MAX_RIGHE_PER_TRANSAZIONE = 500;
