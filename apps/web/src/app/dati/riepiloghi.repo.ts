import { Injectable } from '@angular/core';
import type {
  ChiaveMese,
  RiepilogoPerClassifica,
  RiepilogoPerReport,
  RiepilogoPerStorico,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';
import {
  esisteMese,
  leggiMesiConAvvisi,
  leggiRigaDipendente,
  leggiRiepiloghiAnno,
  leggiRiepiloghiDipendente,
  leggiRiepiloghiFestivita,
  leggiRiepiloghiPerClassifica,
  leggiRiepiloghiPerReport,
  type MeseConAvvisi,
  type RiepilogoFestivitaAnno,
  type RiepilogoDelDipendente,
} from './riepiloghi.firestore';
import type { RigaSalvata } from './righe.firestore';

export type {
  MeseConAvvisi,
  RiepilogoDelDipendente,
  RiepilogoFestivitaAnno,
} from './riepiloghi.firestore';

/** Riepiloghi mensili (sola lettura): storico delle festività e avvisi aperti della Home. */
@Injectable({ providedIn: 'root' })
export class RiepiloghiRepo {
  festivita(
    repartoId: string,
    idFestivita: string,
    da: ChiaveMese,
    a: ChiaveMese,
  ): Promise<RiepilogoPerStorico[]> {
    return leggiRiepiloghiFestivita(serviziFirebase().db, repartoId, idFestivita, da, a);
  }

  mesiConAvvisi(repartoId: string): Promise<MeseConAvvisi[]> {
    return leggiMesiConAvvisi(serviziFirebase().db, repartoId);
  }

  esisteMese(repartoId: string, chiave: ChiaveMese): Promise<boolean> {
    return esisteMese(serviziFirebase().db, repartoId, chiave);
  }

  /** I riepiloghi dei mesi tra `da` e `a` (compresi) per la classifica dei sostituti (U8). */
  perClassifica(
    repartoId: string,
    da: ChiaveMese,
    a: ChiaveMese,
  ): Promise<RiepilogoPerClassifica[]> {
    return leggiRiepiloghiPerClassifica(serviziFirebase().db, repartoId, da, a);
  }

  /** I riepiloghi di un dipendente nell'anno, in ordine di mese (dettaglio del dipendente, UX §7.9). */
  delDipendente(
    repartoId: string,
    dipendenteId: string,
    anno: number,
  ): Promise<RiepilogoDelDipendente[]> {
    return leggiRiepiloghiDipendente(serviziFirebase().db, repartoId, dipendenteId, anno);
  }

  /** La riga del dipendente in un mese; null se il mese o la riga non esistono. */
  rigaDelDipendente(
    repartoId: string,
    chiave: ChiaveMese,
    dipendenteId: string,
  ): Promise<RigaSalvata | null> {
    return leggiRigaDipendente(serviziFirebase().db, repartoId, chiave, dipendenteId);
  }

  /** I riepiloghi dei mesi tra `da` e `a` (compresi) per il report bimestrale provvisorio. */
  perReport(repartoId: string, da: ChiaveMese, a: ChiaveMese): Promise<RiepilogoPerReport[]> {
    return leggiRiepiloghiPerReport(serviziFirebase().db, repartoId, da, a);
  }

  /** Tutti i riepiloghi dell'anno, per il report «Festività dell'anno». */
  perAnno(repartoId: string, anno: number): Promise<RiepilogoFestivitaAnno[]> {
    return leggiRiepiloghiAnno(serviziFirebase().db, repartoId, anno);
  }
}
