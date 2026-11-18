// Traduzione degli errori delle callable e di Firebase in testi dell'interfaccia (ARCHITETTURA §8).
// Mai dati personali in questi messaggi.
import type { CodiceErrore } from '@turni/domain';
import { testi } from '../testi/it';

function codiceDi(errore: unknown): string | null {
  if (typeof errore === 'object' && errore !== null && 'code' in errore) {
    const codice = errore.code;
    return typeof codice === 'string' ? codice : null;
  }
  return null;
}

// I codici validi sono le chiavi dei testi (`satisfies Record<CodiceErrore, string>` in testi/it.ts):
// non si importa `CODICI_ERRORE` dal dominio per non portare zod nel bundle iniziale.
function eCodiceErrore(valore: unknown): valore is CodiceErrore {
  return typeof valore === 'string' && Object.hasOwn(testi.erroriFunzioni, valore);
}

/** `details.codice` di un errore di callable (`HttpsError`), se presente e valido. */
export function codiceErroreFunzione(errore: unknown): CodiceErrore | null {
  if (typeof errore === 'object' && errore !== null && 'details' in errore) {
    const dettagli = errore.details;
    if (typeof dettagli === 'object' && dettagli !== null && 'codice' in dettagli) {
      const codice = dettagli.codice;
      if (eCodiceErrore(codice)) {
        return codice;
      }
    }
  }
  return null;
}

/** Vero se l'errore indica che la rete non è raggiungibile. */
export function eErroreDiRete(errore: unknown): boolean {
  const codice = codiceDi(errore);
  return (
    codice === 'auth/network-request-failed' ||
    codice === 'functions/unavailable' ||
    codice === 'unavailable'
  );
}

/** Testo da mostrare per un errore di callable. */
export function testoErroreFunzione(errore: unknown): string {
  const codice = codiceErroreFunzione(errore);
  if (codice !== null) {
    return testi.erroriFunzioni[codice];
  }
  return eErroreDiRete(errore) ? testi.erroreRete : testi.erroreSconosciuto;
}

/** Codice di un errore Firebase Auth ('auth/…'), se c'è. */
export function codiceAuth(errore: unknown): string | null {
  const codice = codiceDi(errore);
  return codice !== null && codice.startsWith('auth/') ? codice : null;
}

/** Codice di un errore Firestore ('permission-denied', …), se c'è. */
export function codiceFirestore(errore: unknown): string | null {
  return codiceDi(errore);
}
