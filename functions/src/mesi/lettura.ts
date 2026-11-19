// Lettura tollerante dei documenti del mese e delle righe: le regole Firestore controllano solo il primo
// livello (L4), quindi ciò che arriva da Firestore si verifica qui prima di calcolare (mai `as`).
import {
  mappaGiorni,
  riportoDa,
  schemaCalendarioMese,
  type CalendarioMese,
  type ChiaveMese,
  type RiepilogoPerBancaOre,
  type RigaDaValidare,
  type Riporto,
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

function numeroIntero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) ? valore : null;
}

/**
 * Il riepilogo di un mese per la banca ore. Il riepilogo lo scrive solo il trigger, ma ciò che arriva da Firestore si
 * verifica comunque: un documento illeggibile vale come riga non valida (escluso dalla banca ore, che diventa
 * provvisoria). Null se il documento non esiste.
 */
export function leggiRiepilogoPerBancaOre(
  snapshot: DocumentSnapshot,
  chiaveMese: ChiaveMese,
  dipendenteId: string,
): RiepilogoPerBancaOre | null {
  if (!snapshot.exists) {
    return null;
  }
  const lavorati = numeroIntero(snapshot.get('minutiLavorati'));
  const dovuti = numeroIntero(snapshot.get('minutiDovuti'));
  const saldo = numeroIntero(snapshot.get('saldoMinuti'));
  const stato: unknown = snapshot.get('statoMese');
  const valida: unknown = snapshot.get('valida');
  if (
    lavorati === null ||
    dovuti === null ||
    saldo === null ||
    (stato !== 'bozza' && stato !== 'convalidato') ||
    typeof valida !== 'boolean'
  ) {
    return {
      dipendenteId,
      chiaveMese,
      minutiLavorati: 0,
      minutiDovuti: 0,
      saldoMinuti: 0,
      statoMese: 'bozza',
      valida: false,
    };
  }
  return {
    dipendenteId,
    chiaveMese,
    minutiLavorati: lavorati,
    minutiDovuti: dovuti,
    saldoMinuti: saldo,
    statoMese: stato,
    valida,
  };
}

/**
 * Il riporto che dà la banca ore dell'anno precedente. Senza documento è zero e definitivo (L13); un documento
 * illeggibile dà zero provvisorio, così il totale non si presenta come definitivo.
 */
export function leggiRiporto(snapshot: DocumentSnapshot): Riporto {
  if (!snapshot.exists) {
    return riportoDa(null);
  }
  const saldo = numeroIntero(snapshot.get('saldoAnnoMinuti'));
  const provvisorio: unknown = snapshot.get('provvisorio');
  return saldo === null || typeof provvisorio !== 'boolean'
    ? { minuti: 0, provvisorio: true }
    : riportoDa({ saldoAnnoMinuti: saldo, provvisorio });
}
