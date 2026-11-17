// Errori delle callable (ARCHITETTURA §8): HttpsError con messaggio in italiano senza dati personali e
// `details: { codice }`, che il browser traduce con apps/web/src/app/testi/it.ts.
import type { CodiceErrore, DettagliErrore } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import {
  HttpsError,
  onCall,
  type CallableFunction,
  type CallableRequest,
  type FunctionsErrorCode,
} from 'firebase-functions/v2/https';

interface DefinizioneErrore {
  readonly https: FunctionsErrorCode;
  readonly messaggio: string;
}

// Un elemento per ogni codice del dominio: il compilatore segnala i codici dimenticati.
const ERRORI: Readonly<Record<CodiceErrore, DefinizioneErrore>> = {
  NON_AUTENTICATO: { https: 'unauthenticated', messaggio: 'Accesso richiesto.' },
  UTENTE_NON_ABILITATO: {
    https: 'permission-denied',
    messaggio: 'Utente non abilitato o disattivato.',
  },
  RUOLO_NON_AUTORIZZATO: {
    https: 'permission-denied',
    messaggio: 'Operazione non consentita per il ruolo.',
  },
  NON_PROPRIETARIO: { https: 'permission-denied', messaggio: 'Reparto non accessibile.' },
  INPUT_NON_VALIDO: { https: 'invalid-argument', messaggio: 'Dati non validi.' },
  NON_TROVATO: { https: 'not-found', messaggio: 'Elemento non trovato.' },
  ERRORE_INTERNO: { https: 'internal', messaggio: 'Errore interno. Riprova più tardi.' },
  EMAIL_GIA_USATA: { https: 'already-exists', messaggio: 'Email già usata da un altro utente.' },
  NON_COORDINATORE: {
    https: 'failed-precondition',
    messaggio: 'L’operazione vale solo per i coordinatori.',
  },
  COORDINATORE_NON_VALIDO: {
    https: 'failed-precondition',
    messaggio: 'Il destinatario non è un coordinatore attivo.',
  },
  CF_NON_VALIDO: { https: 'invalid-argument', messaggio: 'Codice fiscale non valido.' },
  CF_DUPLICATO: { https: 'already-exists', messaggio: 'Codice fiscale già registrato.' },
  EMAIL_NON_VALIDA: { https: 'invalid-argument', messaggio: 'Email non valida.' },
  MESE_GIA_CONVALIDATO: { https: 'failed-precondition', messaggio: 'Mese già convalidato.' },
  MESE_NON_CONCLUSO: { https: 'failed-precondition', messaggio: 'Il mese non è ancora concluso.' },
  RIGHE_NON_VALIDE: {
    https: 'failed-precondition',
    messaggio: 'Il mese contiene righe non valide.',
  },
  NESSUN_MESE_CONVALIDATO: {
    https: 'failed-precondition',
    messaggio: 'Nessun mese convalidato nel bimestre.',
  },
};

export function errore(codice: CodiceErrore): HttpsError {
  const { https, messaggio } = ERRORI[codice];
  const dettagli: DettagliErrore = { codice };
  return new HttpsError(https, messaggio, dettagli);
}

/** Codice di un errore di libreria (es. 'auth/email-already-exists'), mai il messaggio. */
export function codiceDi(e: unknown): string | null {
  if (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string') {
    return e.code;
  }
  return null;
}

/** Descrizione sicura da registrare nei log: codice o nome dell'errore, mai il messaggio. */
function descrizioneSicura(e: unknown): string {
  return codiceDi(e) ?? (e instanceof Error ? e.name : typeof e);
}

/**
 * Callable con la regione delle opzioni globali. Un errore che non è già un HttpsError (bug, servizio
 * non raggiungibile) diventa ERRORE_INTERNO: il browser riceve sempre `details.codice` e nei log finisce
 * solo il codice dell'errore originale, mai il suo messaggio o i dati della richiesta.
 */
export function definisciCallable<Uscita>(
  nome: string,
  gestore: (richiesta: CallableRequest<unknown>) => Promise<Uscita>,
): CallableFunction<unknown, Promise<Uscita>> {
  return onCall<unknown, Promise<Uscita>>(async (richiesta) => {
    try {
      return await gestore(richiesta);
    } catch (e) {
      if (e instanceof HttpsError) {
        throw e;
      }
      logger.error('Errore interno della callable', {
        funzione: nome,
        errore: descrizioneSicura(e),
      });
      throw errore('ERRORE_INTERNO');
    }
  });
}
