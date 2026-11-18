// Controlli comuni delle callable (ARCHITETTURA §8). Stessa logica delle Security Rules (`abilitato()`):
// claim `ruolo` valido nel token, confermato dal documento utenti/{uid} (stesso ruolo, attivo == true).
// Il documento si legge a ogni chiamata: la disattivazione ha effetto subito, senza aspettare la
// scadenza del token (fino a un'ora).
import { eRuolo, type Ruolo } from '@turni/domain';
import { rifReparto, rifUtente } from './admin';
import { errore } from './errori';

/** Parte della richiesta di una callable che serve qui (CallableRequest la soddisfa). */
export interface RichiestaAutenticata {
  readonly auth?: { readonly uid: string; readonly token: Readonly<Record<string, unknown>> };
}

export interface UtenteAbilitato {
  readonly uid: string;
  readonly ruolo: Ruolo;
  /** «Nome Cognome», per `autoreNome` del registro. */
  readonly nomeCompleto: string | null;
}

export async function richiediUtente(richiesta: RichiestaAutenticata): Promise<UtenteAbilitato> {
  const autenticazione = richiesta.auth;
  if (autenticazione === undefined) {
    throw errore('NON_AUTENTICATO');
  }
  const ruolo = autenticazione.token['ruolo'];
  if (!eRuolo(ruolo)) {
    throw errore('UTENTE_NON_ABILITATO');
  }
  const documento = await rifUtente(autenticazione.uid).get();
  const ruoloSalvato: unknown = documento.get('ruolo');
  const attivo: unknown = documento.get('attivo');
  if (!documento.exists || ruoloSalvato !== ruolo || attivo !== true) {
    throw errore('UTENTE_NON_ABILITATO');
  }
  return {
    uid: autenticazione.uid,
    ruolo,
    nomeCompleto: nomeCompleto(documento.get('nome'), documento.get('cognome')),
  };
}

export async function richiediAdmin(richiesta: RichiestaAutenticata): Promise<UtenteAbilitato> {
  const utente = await richiediUtente(richiesta);
  if (utente.ruolo !== 'ADMIN') {
    throw errore('RUOLO_NON_AUTORIZZATO');
  }
  return utente;
}

/**
 * Coordinatore proprietario del reparto. Reparto inesistente o altrui danno lo stesso errore
 * (NON_PROPRIETARIO): non si scopre se un reparto esiste.
 */
export async function richiediCoordinatoreDi(
  richiesta: RichiestaAutenticata,
  repartoId: string,
): Promise<UtenteAbilitato> {
  const utente = await richiediUtente(richiesta);
  if (utente.ruolo !== 'COORDINATORE') {
    throw errore('RUOLO_NON_AUTORIZZATO');
  }
  await verificaProprieta(utente, repartoId);
  return utente;
}

/** ADMIN, oppure coordinatore proprietario del reparto. */
export async function richiediLettoreDi(
  richiesta: RichiestaAutenticata,
  repartoId: string,
): Promise<UtenteAbilitato> {
  const utente = await richiediUtente(richiesta);
  if (utente.ruolo !== 'ADMIN') {
    await verificaProprieta(utente, repartoId);
  }
  return utente;
}

async function verificaProprieta(utente: UtenteAbilitato, repartoId: string): Promise<void> {
  const reparto = await rifReparto(repartoId).get();
  const coordinatoreUid: unknown = reparto.get('coordinatoreUid');
  if (!reparto.exists || coordinatoreUid !== utente.uid) {
    throw errore('NON_PROPRIETARIO');
  }
}

function nomeCompleto(nome: unknown, cognome: unknown): string | null {
  return typeof nome === 'string' && typeof cognome === 'string' ? `${nome} ${cognome}` : null;
}
