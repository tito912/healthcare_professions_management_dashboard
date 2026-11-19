// Errori non gestiti e errori di navigazione (UX §7.13). Nessun dato personale nei messaggi: nei log finiscono solo
// il tipo e il codice dell'errore, mai il testo, che per le librerie può contenere percorsi, ID o dati dell'utente.
import { ErrorHandler, inject, Injectable } from '@angular/core';
import { RedirectCommand, Router, type NavigationError } from '@angular/router';

const PERCORSO_ERRORE = '/errore';

/** Tipo e codice di un errore, senza il messaggio. */
export function descriviErrore(errore: unknown): string {
  if (errore instanceof Error) {
    const codice = 'code' in errore && typeof errore.code === 'string' ? ` (${errore.code})` : '';
    return `${errore.name}${codice}`;
  }
  return typeof errore;
}

@Injectable()
export class GestoreErrori implements ErrorHandler {
  handleError(errore: unknown): void {
    console.error('Errore non gestito:', descriviErrore(errore));
  }
}

/**
 * Una navigazione che fallisce (per esempio il file di una pagina non si scarica) porta alla pagina d'errore; se a
 * fallire è la pagina d'errore stessa non si riprova, per non entrare in un ciclo.
 */
export function gestisciErroreNavigazione(errore: NavigationError): RedirectCommand | undefined {
  console.error('Navigazione non riuscita:', descriviErrore(errore.error));
  const router = inject(Router);
  return errore.url.split(/[?#]/, 1)[0] === PERCORSO_ERRORE
    ? undefined
    : new RedirectCommand(router.parseUrl(PERCORSO_ERRORE));
}
