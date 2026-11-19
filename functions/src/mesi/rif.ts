// Percorsi dei documenti dei mesi e dei riepiloghi (ARCHITETTURA §5.8-§5.10).
import type { ChiaveMese } from '@turni/domain';
import type { CollectionReference, DocumentReference } from 'firebase-admin/firestore';
import { rifReparto } from '../comune/admin';

export function rifMese(repartoId: string, chiaveMese: ChiaveMese): DocumentReference {
  return rifReparto(repartoId).collection('mesi').doc(chiaveMese);
}

export function rifRighe(repartoId: string, chiaveMese: ChiaveMese): CollectionReference {
  return rifMese(repartoId, chiaveMese).collection('righe');
}

export function rifRiga(
  repartoId: string,
  chiaveMese: ChiaveMese,
  dipendenteId: string,
): DocumentReference {
  return rifRighe(repartoId, chiaveMese).doc(dipendenteId);
}

/** `riepiloghi/{chiaveMese}_{dipendenteId}`. */
export function rifRiepilogo(
  repartoId: string,
  chiaveMese: ChiaveMese,
  dipendenteId: string,
): DocumentReference {
  return rifReparto(repartoId).collection('riepiloghi').doc(`${chiaveMese}_${dipendenteId}`);
}

/** `bancaOre/{anno}_{dipendenteId}` (§5.11). */
export function rifBancaOre(
  repartoId: string,
  anno: number,
  dipendenteId: string,
): DocumentReference {
  return rifReparto(repartoId).collection('bancaOre').doc(`${anno}_${dipendenteId}`);
}
