import { Injectable } from '@angular/core';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { eCodiceAssenza, type CodiceAssenza } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

/** Una tipologia di assenza come è salvata (ARCHITETTURA §5.4), senza gli istanti. */
export interface AssenzaSalvata {
  readonly codice: CodiceAssenza;
  readonly descrizione: string;
  readonly effetto: 'comeRiposo' | 'neutra';
  readonly malattia: boolean;
  readonly predefinita: boolean;
  readonly attivo: boolean;
  readonly ordine: number;
}

export function assenzaDaDati(id: string, dati: DocumentData): AssenzaSalvata | null {
  const descrizione: unknown = dati['descrizione'];
  const effetto: unknown = dati['effetto'];
  const malattia: unknown = dati['malattia'];
  const predefinita: unknown = dati['predefinita'];
  const attivo: unknown = dati['attivo'];
  const ordine: unknown = dati['ordine'];
  if (
    !eCodiceAssenza(id) ||
    typeof descrizione !== 'string' ||
    (effetto !== 'comeRiposo' && effetto !== 'neutra') ||
    typeof malattia !== 'boolean' ||
    typeof predefinita !== 'boolean' ||
    typeof attivo !== 'boolean' ||
    typeof ordine !== 'number'
  ) {
    return null;
  }
  return { codice: id, descrizione, effetto, malattia, predefinita, attivo, ordine };
}

@Injectable({ providedIn: 'root' })
export class AssenzeRepo {
  /** Tipologie del reparto in ordine di `ordine` (anche le disattivate). */
  async elenco(repartoId: string): Promise<AssenzaSalvata[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(collection(db, 'reparti', repartoId, 'assenze'));
    return risultato.docs
      .map((documento) => assenzaDaDati(documento.id, documento.data()))
      .filter((assenza): assenza is AssenzaSalvata => assenza !== null)
      .sort((a, b) => a.ordine - b.ordine || a.codice.localeCompare(b.codice));
  }
}
