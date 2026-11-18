import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { serviziFirebase } from '../core/firebase';
import type { PassoConfigurazione } from '../core/atterraggio';

/** Dati di un reparto che servono a Home, selettore e menu (il documento completo è in ARCHITETTURA §5.2). */
export interface RepartoSintesi {
  readonly id: string;
  readonly nome: string;
  readonly coordinatoreUid: string;
  readonly passo: PassoConfigurazione;
}

function passoDa(valore: unknown): PassoConfigurazione | null {
  return valore === 'turni' || valore === 'dipendenti' || valore === 'completata' ? valore : null;
}

/** Convertitore tipizzato: un documento che non ha la forma attesa non entra nell'elenco. */
export function repartoDaDocumento(
  documento: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
): RepartoSintesi | null {
  const dati = documento.data();
  if (dati === undefined) {
    return null;
  }
  const nome: unknown = dati['nome'];
  const coordinatoreUid: unknown = dati['coordinatoreUid'];
  const configurazione: unknown = dati['configurazione'];
  const passo =
    typeof configurazione === 'object' && configurazione !== null && 'passo' in configurazione
      ? passoDa(configurazione.passo)
      : null;
  if (typeof nome !== 'string' || typeof coordinatoreUid !== 'string' || passo === null) {
    return null;
  }
  return { id: documento.id, nome, coordinatoreUid, passo };
}

function conOrdineDeiNomi(elenco: (RepartoSintesi | null)[]): RepartoSintesi[] {
  return elenco
    .filter((reparto): reparto is RepartoSintesi => reparto !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

@Injectable({ providedIn: 'root' })
export class RepartiRepo {
  /** Reparti del coordinatore: la query filtra per `coordinatoreUid`, come richiedono le regole. */
  async delCoordinatore(uid: string): Promise<RepartoSintesi[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(
      query(collection(db, 'reparti'), where('coordinatoreUid', '==', uid), orderBy('nome')),
    );
    return conOrdineDeiNomi(risultato.docs.map(repartoDaDocumento));
  }

  /** Tutti i reparti (solo ADMIN: per gli altri le regole negano la lettura). */
  async tutti(): Promise<RepartoSintesi[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(query(collection(db, 'reparti'), orderBy('nome')));
    return conOrdineDeiNomi(risultato.docs.map(repartoDaDocumento));
  }

  /** Un reparto, o null se non esiste o non è leggibile da chi chiede. */
  async leggi(id: string): Promise<RepartoSintesi | null> {
    const { db } = serviziFirebase();
    try {
      const documento = await getDoc(doc(db, 'reparti', id));
      return documento.exists() ? repartoDaDocumento(documento) : null;
    } catch {
      return null;
    }
  }
}
