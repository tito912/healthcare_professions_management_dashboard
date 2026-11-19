import { Injectable } from '@angular/core';
import type { ChiaveMese } from '@turni/domain';
import { serviziFirebase } from '../core/firebase';
import {
  leggiRighe,
  salvaRighe,
  type RichiestaSalvaRighe,
  type RigaSalvata,
  type VersioniSalvate,
} from './righe.firestore';

export {
  ErroreSalvataggio,
  type RigaDaSalvare,
  type RigaSalvata,
  type RichiestaSalvaRighe,
  type VersioniSalvate,
} from './righe.firestore';

/** Righe di un mese: lettura e «Salva bozza» in transazione. */
@Injectable({ providedIn: 'root' })
export class RigheRepo {
  leggi(repartoId: string, chiave: ChiaveMese): Promise<RigaSalvata[]> {
    return leggiRighe(serviziFirebase().db, repartoId, chiave);
  }

  salva(richiesta: RichiestaSalvaRighe): Promise<VersioniSalvate> {
    return salvaRighe(serviziFirebase().db, richiesta);
  }
}
