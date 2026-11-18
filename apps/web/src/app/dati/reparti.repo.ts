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
import {
  ID_FESTIVITA_NAZIONALI,
  validaFestivitaLocale,
  type ConfigurazioneFestivita,
  type FestivitaLocale,
  type IdFestivitaNazionale,
} from '@turni/domain';
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

/** Il documento del reparto con ciò che serve alla configurazione (ARCHITETTURA §5.2). */
export interface RepartoConfigurazione extends RepartoSintesi {
  readonly attribuzioneNotte: 'inizio' | 'fine';
  readonly festivita: ConfigurazioneFestivita;
}

function eMappa(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

function nazionaleDa(valore: unknown): IdFestivitaNazionale | undefined {
  return ID_FESTIVITA_NAZIONALI.find((id) => id === valore);
}

function localeDa(valore: unknown): FestivitaLocale | null {
  if (!eMappa(valore)) {
    return null;
  }
  const { id, nome, giorno, mese } = valore;
  if (
    typeof id !== 'string' ||
    typeof nome !== 'string' ||
    typeof giorno !== 'number' ||
    typeof mese !== 'number'
  ) {
    return null;
  }
  const locale = { id, nome, giorno, mese };
  return validaFestivitaLocale(locale) === null ? locale : null;
}

/** Convertitore del documento completo; null se manca un campo essenziale. Le festività malformate si scartano. */
export function configurazioneDaDocumento(
  documento: DocumentSnapshot<DocumentData>,
): RepartoConfigurazione | null {
  const sintesi = repartoDaDocumento(documento);
  const dati = documento.data();
  if (sintesi === null || dati === undefined) {
    return null;
  }
  const impostazioni: unknown = dati['impostazioni'];
  const festivita: unknown = dati['festivita'];
  const attribuzione = eMappa(impostazioni) ? impostazioni['attribuzioneNotte'] : undefined;
  const escluse = eMappa(festivita) ? festivita['nazionaliEscluse'] : undefined;
  const locali = eMappa(festivita) ? festivita['locali'] : undefined;
  return {
    ...sintesi,
    attribuzioneNotte: attribuzione === 'fine' ? 'fine' : 'inizio',
    festivita: {
      nazionaliEscluse: Array.isArray(escluse)
        ? escluse.map(nazionaleDa).filter((id): id is IdFestivitaNazionale => id !== undefined)
        : [],
      locali: Array.isArray(locali)
        ? locali.map(localeDa).filter((l): l is FestivitaLocale => l !== null)
        : [],
    },
  };
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

  /**
   * Il reparto con la sua configurazione. null se non esiste o non è leggibile da chi chiede
   * (permessi negati); gli altri errori (rete) si propagano, perché non vogliono dire «non disponibile».
   */
  async leggiConfigurazione(id: string): Promise<RepartoConfigurazione | null> {
    const { db } = serviziFirebase();
    try {
      const documento = await getDoc(doc(db, 'reparti', id));
      return documento.exists() ? configurazioneDaDocumento(documento) : null;
    } catch (errore) {
      if (typeof errore === 'object' && errore !== null && 'code' in errore) {
        if (errore.code === 'permission-denied') {
          return null;
        }
      }
      throw errore;
    }
  }
}
