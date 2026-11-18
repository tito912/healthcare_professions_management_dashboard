// Richieste callable per i test unitari senza emulatori.
import type { CallableRequest } from 'firebase-functions/v2/https';

/** Utente autenticato con il claim `ruolo`, o nessuno (`null`). */
export function richiesta(
  data: unknown,
  utente: { readonly uid: string; readonly ruolo: string } | null,
): CallableRequest<unknown> {
  // Nessuna callable legge la richiesta HTTP grezza: basta un oggetto vuoto.
  const rawRequest: CallableRequest['rawRequest'] = Object.create(null);
  if (utente === null) {
    return { data, rawRequest, acceptsStreaming: false };
  }
  return {
    data,
    rawRequest,
    acceptsStreaming: false,
    auth: {
      uid: utente.uid,
      rawToken: 'token-di-prova',
      token: {
        aud: 'demo-turni',
        auth_time: 0,
        exp: 0,
        firebase: { identities: {}, sign_in_provider: 'password' },
        iat: 0,
        iss: 'https://securetoken.google.com/demo-turni',
        sub: utente.uid,
        uid: utente.uid,
        ruolo: utente.ruolo,
      },
    },
  };
}
