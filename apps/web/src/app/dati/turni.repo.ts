import { Injectable } from '@angular/core';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import {
  eCodiceTurno,
  eOraLocale,
  ID_COLORI_TURNO,
  type CodiceTurno,
  type IdColoreTurno,
  type OraLocale,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

/** Un turno o una fascia di reperibilità come è salvato (ARCHITETTURA §5.3), senza gli istanti. */
export interface TurnoSalvato {
  readonly codice: CodiceTurno;
  readonly tipo: 'turno' | 'reperibilita';
  readonly nome: string;
  readonly colore: IdColoreTurno | null;
  readonly inizio: OraLocale;
  readonly fine: OraLocale;
  readonly pausaMinuti: number;
  readonly notturno: boolean;
  readonly attivo: boolean;
  readonly ordine: number;
}

function coloreDa(valore: unknown): IdColoreTurno | null | undefined {
  if (valore === null) {
    return null;
  }
  return ID_COLORI_TURNO.find((id) => id === valore);
}

/** Convertitore tipizzato: un documento che non ha la forma attesa non entra nell'elenco. */
export function turnoDaDati(id: string, dati: DocumentData): TurnoSalvato | null {
  const tipo: unknown = dati['tipo'];
  const nome: unknown = dati['nome'];
  const inizio: unknown = dati['inizio'];
  const fine: unknown = dati['fine'];
  const pausaMinuti: unknown = dati['pausaMinuti'];
  const notturno: unknown = dati['notturno'];
  const attivo: unknown = dati['attivo'];
  const ordine: unknown = dati['ordine'];
  const colore = coloreDa(dati['colore']);
  if (
    !eCodiceTurno(id) ||
    (tipo !== 'turno' && tipo !== 'reperibilita') ||
    typeof nome !== 'string' ||
    typeof inizio !== 'string' ||
    !eOraLocale(inizio) ||
    typeof fine !== 'string' ||
    !eOraLocale(fine) ||
    typeof pausaMinuti !== 'number' ||
    typeof notturno !== 'boolean' ||
    typeof attivo !== 'boolean' ||
    typeof ordine !== 'number' ||
    colore === undefined
  ) {
    return null;
  }
  return { codice: id, tipo, nome, colore, inizio, fine, pausaMinuti, notturno, attivo, ordine };
}

@Injectable({ providedIn: 'root' })
export class TurniRepo {
  /** Turni e fasce del reparto in ordine di `ordine` (anche i disattivati: la configurazione li mostra). */
  async elenco(repartoId: string): Promise<TurnoSalvato[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(collection(db, 'reparti', repartoId, 'turni'));
    return risultato.docs
      .map((documento) => turnoDaDati(documento.id, documento.data()))
      .filter((turno): turno is TurnoSalvato => turno !== null)
      .sort((a, b) => a.ordine - b.ordine || a.codice.localeCompare(b.codice));
  }
}
