// Lettura tollerante dei documenti del mese e delle righe: le regole Firestore controllano solo il primo
// livello (L4), quindi ciò che arriva da Firestore si verifica qui prima di calcolare (mai `as`).
import {
  mappaGiorni,
  schemaCalendarioMese,
  type CalendarioMese,
  type RigaDaValidare,
} from '@turni/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

export interface MeseLetto {
  readonly stato: 'bozza' | 'convalidato';
  readonly calendario: CalendarioMese;
}

/** Il mese, o null se non esiste o non ha stato e calendario leggibili. */
export function leggiMese(snapshot: DocumentSnapshot): MeseLetto | null {
  if (!snapshot.exists) {
    return null;
  }
  const stato: unknown = snapshot.get('stato');
  const calendario = schemaCalendarioMese.safeParse(snapshot.get('calendario'));
  if ((stato !== 'bozza' && stato !== 'convalidato') || !calendario.success) {
    return null;
  }
  return { stato, calendario: calendario.data };
}

/** La riga così com'è: contratto e giorni restano `unknown`, li verifica il dominio. L'ID è quello del documento. */
export function leggiRiga(snapshot: DocumentSnapshot): RigaDaValidare | null {
  return snapshot.exists
    ? {
        dipendenteId: snapshot.id,
        contratto: snapshot.get('contratto'),
        giorni: snapshot.get('giorni'),
      }
    : null;
}

/** La mappa `giorni` di una riga adiacente, o null se la riga non esiste o i giorni non sono una mappa. */
export function giorniDi(snapshot: DocumentSnapshot): Readonly<Record<string, unknown>> | null {
  return snapshot.exists ? mappaGiorni(snapshot.get('giorni')) : null;
}
