import { REGIONE_FUNZIONI } from '@turni/domain';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

// Callable di prova: risponde solo a utenti autenticati. Nessun dato personale in risposta o nei log.
export const ping = onCall((request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Accesso richiesto.');
  }
  return { esito: 'ok', regione: REGIONE_FUNZIONI };
});
