import { Injectable } from '@angular/core';
import { collection, getDocs, type DocumentData } from 'firebase/firestore';
import { eCodiceTurno, eDataISO, type CodiceTurno, type DataISO } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

/**
 * Un dipendente come è salvato (ARCHITETTURA §5.5), senza gli istanti. Contiene solo dati non riservati:
 * codice fiscale, data di nascita ed email non sono nel documento pubblico (stanno in `privato/dati`,
 * illeggibile dal browser) e si chiedono al server con `leggiDatiPrivati`.
 */
export interface DipendenteSalvato {
  readonly id: string;
  readonly nome: string;
  readonly cognome: string;
  readonly oreSettimanali: number;
  readonly turniEsclusi: readonly CodiceTurno[];
  readonly dataAssunzione: DataISO | null;
  readonly dataCessazione: DataISO | null;
  readonly attivo: boolean;
}

function dataOpzionale(valore: unknown): DataISO | null | undefined {
  if (valore === null) {
    return null;
  }
  return typeof valore === 'string' && eDataISO(valore) ? valore : undefined;
}

/** Convertitore tipizzato: un documento che non ha la forma attesa non entra nell'elenco. */
export function dipendenteDaDati(id: string, dati: DocumentData): DipendenteSalvato | null {
  const nome: unknown = dati['nome'];
  const cognome: unknown = dati['cognome'];
  const oreSettimanali: unknown = dati['oreSettimanali'];
  const turniEsclusi: unknown = dati['turniEsclusi'];
  const attivo: unknown = dati['attivo'];
  const dataAssunzione = dataOpzionale(dati['dataAssunzione']);
  const dataCessazione = dataOpzionale(dati['dataCessazione']);
  if (
    typeof nome !== 'string' ||
    typeof cognome !== 'string' ||
    typeof oreSettimanali !== 'number' ||
    !Array.isArray(turniEsclusi) ||
    typeof attivo !== 'boolean' ||
    dataAssunzione === undefined ||
    dataCessazione === undefined
  ) {
    return null;
  }
  const codici: CodiceTurno[] = [];
  for (const codice of turniEsclusi) {
    if (typeof codice !== 'string' || !eCodiceTurno(codice)) {
      return null;
    }
    codici.push(codice);
  }
  return {
    id,
    nome,
    cognome,
    oreSettimanali,
    turniEsclusi: codici,
    dataAssunzione,
    dataCessazione,
    attivo,
  };
}

@Injectable({ providedIn: 'root' })
export class DipendentiRepo {
  /** Tutti i dipendenti del reparto, in servizio e cessati: il filtro dell'elenco è nel browser (35 letture circa). */
  async elenco(repartoId: string): Promise<DipendenteSalvato[]> {
    const { db } = serviziFirebase();
    const risultato = await getDocs(collection(db, 'reparti', repartoId, 'dipendenti'));
    return risultato.docs
      .map((documento) => dipendenteDaDati(documento.id, documento.data()))
      .filter((dipendente): dipendente is DipendenteSalvato => dipendente !== null);
  }
}
