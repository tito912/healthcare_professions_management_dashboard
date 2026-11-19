import { Injectable } from '@angular/core';
import type { ChiaveMese, RiepilogoPerStorico } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';
import {
  esisteMese,
  leggiMesiConAvvisi,
  leggiRiepiloghiFestivita,
  type MeseConAvvisi,
} from './riepiloghi.firestore';

export type { MeseConAvvisi } from './riepiloghi.firestore';

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
}
