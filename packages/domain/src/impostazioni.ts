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

/** Riposo minimo tra la fine di un periodo di lavoro e l'inizio del turno successivo: 11 ore. */
export const RIPOSO_MINIMO_MINUTI = 660;

/** Reperibilità al massimo in un giorno per dipendente (oltre è un blocco). */
export const MAX_REPERIBILITA_GIORNO = 2;

/** Unità di reperibilità al massimo nel mese per dipendente (oltre è un avviso). */
export const MAX_UNITA_REPERIBILITA_MESE = 7;

/** Minuti di un'unità di reperibilità: le fasce più brevi si sommano (4 + 4 + 4 ore = 1). */
export const MINUTI_UNITA_REPERIBILITA = 720;

/** Chiamate al massimo in una reperibilità (L21). */
export const MAX_CHIAMATE_PER_REPERIBILITA = 1;

/** Anni dello storico delle festività (U6): i 5 anni prima di quello mostrato. */
export const ANNI_STORICO_FESTIVITA = 5;

/**
 * Versione del calcolo dei riepiloghi (ARCHITETTURA §5.10). Lo step 2.3 scrive la 1 (senza ore lavorate, saldo e
 * variazioni); lo step 3.1b la alza quando completa `calcolaRiepilogo()`, così un riepilogo vecchio si riconosce.
 */
export const VERSIONE_CALCOLO = 1;
