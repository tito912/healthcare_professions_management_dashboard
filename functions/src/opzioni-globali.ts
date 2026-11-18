import { REGIONE_FUNZIONI } from '@turni/domain';
import { setGlobalOptions } from 'firebase-functions/v2';

// Deve essere importato per primo da index.ts: le opzioni globali valgono solo per le funzioni
// definite dopo questa chiamata. Un'esportazione di una funzione eseguita prima le fisserebbe in us-central1.
setGlobalOptions({ region: REGIONE_FUNZIONI, maxInstances: 10 });
