import { Injectable } from '@angular/core';
import { serviziFirebase } from '../core/firebase';
import { leggiBancaOreAnno, type BancaOreSalvata } from './banca-ore.firestore';

export type { BancaOreSalvata } from './banca-ore.firestore';

/** Banca ore del reparto (sola lettura: la scrive il trigger, ARCHITETTURA §5.11). */
@Injectable({ providedIn: 'root' })
export class BancaOreRepo {
  anno(repartoId: string, anno: number): Promise<BancaOreSalvata[]> {
    return leggiBancaOreAnno(serviziFirebase().db, repartoId, anno);
  }
}
