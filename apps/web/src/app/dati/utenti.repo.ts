import { Injectable } from '@angular/core';
import { collection, getDocs, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { eRuolo, type Ruolo } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

/** Utente come compare nell'elenco (solo ADMIN: ARCHITETTURA §5.1). */
export interface UtenteElenco {
  readonly uid: string;
  readonly nome: string;
  readonly cognome: string;
  readonly email: string;
  readonly ruolo: Ruolo;
  readonly attivo: boolean;
}

export function nomeCompletoDi(utente: Pick<UtenteElenco, 'nome' | 'cognome'>): string {
  return `${utente.nome} ${utente.cognome}`;
}

export function utenteDaDocumento(documento: QueryDocumentSnapshot<DocumentData>): UtenteElenco | null {
  const dati = documento.data();
  const nome: unknown = dati['nome'];
  const cognome: unknown = dati['cognome'];
  const email: unknown = dati['email'];
  const ruolo: unknown = dati['ruolo'];
  const attivo: unknown = dati['attivo'];
  if (
    typeof nome !== 'string' ||
    typeof cognome !== 'string' ||
    typeof email !== 'string' ||
    !eRuolo(ruolo) ||
    typeof attivo !== 'boolean'
  ) {
    return null;
  }
  return { uid: documento.id, nome, cognome, email, ruolo, attivo };
}

@Injectable({ providedIn: 'root' })
export class UtentiRepo {
  /** Tutti gli utenti, per cognome e nome. Le regole lo permettono solo all'ADMIN. */
  async tutti(): Promise<UtenteElenco[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(collection(db, 'utenti'));
    return risultato.docs
      .map(utenteDaDocumento)
      .filter((utente): utente is UtenteElenco => utente !== null)
      .sort((a, b) => nomeCompletoOrdinabile(a).localeCompare(nomeCompletoOrdinabile(b), 'it'));
  }
}

function nomeCompletoOrdinabile(utente: UtenteElenco): string {
  return `${utente.cognome} ${utente.nome}`;
}
