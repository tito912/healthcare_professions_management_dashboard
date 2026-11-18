import { Injectable } from '@angular/core';
import { doc, collection, serverTimestamp, writeBatch } from 'firebase/firestore';
import type {
  ConfigurazioneFestivita,
  IdColoreTurno,
  CodiceAssenza,
  CodiceTurno,
  OraLocale,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

/** I campi di un turno o di una fascia che il browser scrive (senza codice e istanti: li aggiunge il repository). */
export interface CampiTurno {
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

export interface CampiAssenza {
  readonly descrizione: string;
  readonly effetto: 'comeRiposo' | 'neutra';
  readonly attivo: boolean;
  readonly ordine: number;
}

/** Una scrittura della configurazione; l'elenco è il piano calcolato dalla differenza tra bozza e dati salvati. */
export type Operazione =
  | { readonly tipo: 'creaTurno'; readonly codice: CodiceTurno; readonly campi: CampiTurno }
  | {
      readonly tipo: 'aggiornaTurno';
      readonly codice: CodiceTurno;
      readonly campi: Omit<CampiTurno, 'tipo'>;
    }
  | { readonly tipo: 'eliminaTurno'; readonly codice: CodiceTurno }
  | { readonly tipo: 'creaAssenza'; readonly codice: CodiceAssenza; readonly campi: CampiAssenza }
  | {
      readonly tipo: 'aggiornaAssenza';
      readonly codice: CodiceAssenza;
      readonly campi: CampiAssenza;
    }
  | { readonly tipo: 'eliminaAssenza'; readonly codice: CodiceAssenza };

/** Parte del documento del reparto che la configurazione modifica. */
export interface CampiReparto {
  readonly nome: string;
  readonly attribuzioneNotte: 'inizio' | 'fine';
  readonly festivita: ConfigurazioneFestivita;
  /** Presente solo se il passo avanza (mai indietro: lo vietano le regole). */
  readonly passo?: 'dipendenti';
}

/** Le assenze predefinite create nel passo 1 (ARCHITETTURA §5.4): R come riposo, MA neutra. */
const PREDEFINITE = [
  { codice: 'R', descrizione: 'Riposo', effetto: 'comeRiposo', malattia: false, ordine: 0 },
  { codice: 'MA', descrizione: 'Malattia', effetto: 'neutra', malattia: true, ordine: 1 },
] as const;

/**
 * Scritture della creazione guidata e della configurazione. Sono sempre un solo batch: o tutto o niente.
 * Le regole (proprietà, forma, codici, `notturno`) verificano ogni documento anche se il client viene forzato.
 */
@Injectable({ providedIn: 'root' })
export class ConfigurazioneRepo {
  /** Passo 1: il reparto (`passo: 'turni'`) con R e MA in un batch. Restituisce l'ID del reparto. */
  async creaReparto(uid: string, nome: string): Promise<string> {
    const { db } = serviziFirebase();
    const riferimento = doc(collection(db, 'reparti'));
    const batch = writeBatch(db);
    batch.set(riferimento, {
      nome,
      coordinatoreUid: uid,
      configurazione: { passo: 'turni' },
      impostazioni: { attribuzioneNotte: 'inizio' },
      festivita: { nazionaliEscluse: [], locali: [] },
      creatoIl: serverTimestamp(),
      creatoDa: uid,
      aggiornatoIl: serverTimestamp(),
      aggiornatoDa: uid,
    });
    for (const assenza of PREDEFINITE) {
      batch.set(doc(riferimento, 'assenze', assenza.codice), {
        codice: assenza.codice,
        descrizione: assenza.descrizione,
        effetto: assenza.effetto,
        malattia: assenza.malattia,
        predefinita: true,
        attivo: true,
        ordine: assenza.ordine,
        creatoIl: serverTimestamp(),
        aggiornatoIl: serverTimestamp(),
      });
    }
    await batch.commit();
    return riferimento.id;
  }

  /** Salva la configurazione: le operazioni e il documento del reparto in un unico batch. */
  async salva(
    repartoId: string,
    uid: string,
    reparto: CampiReparto,
    operazioni: readonly Operazione[],
  ): Promise<void> {
    const { db } = serviziFirebase();
    const riferimento = doc(db, 'reparti', repartoId);
    const batch = writeBatch(db);
    batch.update(riferimento, {
      nome: reparto.nome,
      impostazioni: { attribuzioneNotte: reparto.attribuzioneNotte },
      festivita: {
        nazionaliEscluse: [...reparto.festivita.nazionaliEscluse],
        locali: reparto.festivita.locali.map((l) => ({
          id: l.id,
          nome: l.nome,
          giorno: l.giorno,
          mese: l.mese,
        })),
      },
      ...(reparto.passo !== undefined ? { configurazione: { passo: reparto.passo } } : {}),
      aggiornatoIl: serverTimestamp(),
      aggiornatoDa: uid,
    });
    for (const operazione of operazioni) {
      switch (operazione.tipo) {
        case 'creaTurno':
          batch.set(doc(riferimento, 'turni', operazione.codice), {
            codice: operazione.codice,
            ...operazione.campi,
            creatoIl: serverTimestamp(),
            aggiornatoIl: serverTimestamp(),
          });
          break;
        case 'aggiornaTurno':
          batch.update(doc(riferimento, 'turni', operazione.codice), {
            ...operazione.campi,
            aggiornatoIl: serverTimestamp(),
          });
          break;
        case 'eliminaTurno':
          batch.delete(doc(riferimento, 'turni', operazione.codice));
          break;
        case 'creaAssenza':
          batch.set(doc(riferimento, 'assenze', operazione.codice), {
            codice: operazione.codice,
            ...operazione.campi,
            malattia: false,
            predefinita: false,
            creatoIl: serverTimestamp(),
            aggiornatoIl: serverTimestamp(),
          });
          break;
        case 'aggiornaAssenza':
          batch.update(doc(riferimento, 'assenze', operazione.codice), {
            ...operazione.campi,
            aggiornatoIl: serverTimestamp(),
          });
          break;
        case 'eliminaAssenza':
          batch.delete(doc(riferimento, 'assenze', operazione.codice));
          break;
      }
    }
    await batch.commit();
  }
}
