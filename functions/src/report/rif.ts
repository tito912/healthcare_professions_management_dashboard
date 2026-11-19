// Percorsi dei documenti del report e della coda delle email (ARCHITETTURA §5.12, §5.14).
import type { IdBimestre } from '@turni/domain';
import type { CollectionReference, DocumentReference } from 'firebase-admin/firestore';
import { db, rifReparto } from '../comune/admin';

export function rifReport(repartoId: string, idBimestre: IdBimestre): DocumentReference {
  return rifReparto(repartoId).collection('report').doc(idBimestre);
}

export function rifRiepiloghi(repartoId: string): CollectionReference {
  return rifReparto(repartoId).collection('riepiloghi');
}

export function rifCodaMail(): CollectionReference {
  return db().collection('mail');
}

/** ID deterministico della email dell'invio automatico: non si crea due volte (idempotenza di `reportBimestrale`). */
export function idMailAutomatica(
  repartoId: string,
  idBimestre: IdBimestre,
  dipendenteId: string,
): string {
  return `auto_${repartoId}_${idBimestre}_${dipendenteId}`;
}
