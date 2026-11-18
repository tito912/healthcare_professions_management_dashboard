// Percorsi dei documenti dell'anagrafica (ARCHITETTURA §5.5-§5.7).
import type { DocumentReference } from 'firebase-admin/firestore';
import { db, rifReparto } from '../comune/admin';

export function rifDipendenti(repartoId: string) {
  return rifReparto(repartoId).collection('dipendenti');
}

export function rifPrivato(dipendente: DocumentReference): DocumentReference {
  return dipendente.collection('privato').doc('dati');
}

/** `indiceCodiciFiscali/{hmac}`: l'ID è l'HMAC del codice fiscale normalizzato. */
export function rifIndiceCodiceFiscale(hmac: string): DocumentReference {
  return db().collection('indiceCodiciFiscali').doc(hmac);
}
