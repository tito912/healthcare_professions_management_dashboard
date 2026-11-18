import { Injectable } from '@angular/core';
import type { ChiaveMese } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';
import { creaMese, leggiMese, type MeseSalvato, type RichiestaCreaMese } from './mesi.firestore';

export type { MeseSalvato, RichiestaCreaMese, RigaNuova } from './mesi.firestore';

/** Documento del mese: lettura e «Aggiungi mese» (le scritture delle righe sono in `RigheRepo`). */
@Injectable({ providedIn: 'root' })
export class MesiRepo {
  leggi(repartoId: string, chiave: ChiaveMese): Promise<MeseSalvato | null> {
    return leggiMese(serviziFirebase().db, repartoId, chiave);
  }

  crea(richiesta: RichiestaCreaMese): Promise<void> {
    return creaMese(serviziFirebase().db, richiesta);
  }
}
