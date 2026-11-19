// Lettura dei riepiloghi mensili (ARCHITETTURA §5.10), scritti solo dalle Functions. Come `mesi.firestore.ts`, le
// funzioni prendono `db` e si provano sull'emulatore. Servono lo storico delle festività (U6) e gli «Avvisi
// aperti» della Home (UX §7.2): le query usano gli indici di `firestore.indexes.json`.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  eChiaveGiorno,
  eChiaveMese,
  eCodiceTurno,
  type ChiaveMese,
  type RiepilogoPerStorico,
} from '@turni/domain';

function eMappa(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

/** Convertitore tipizzato: un riepilogo senza i campi dello storico non entra nel conteggio (null). */
export function riepilogoPerStorico(dati: DocumentData): RiepilogoPerStorico | null {
  const dipendenteId: unknown = dati['dipendenteId'];
  const chiaveMese: unknown = dati['chiaveMese'];
  const anno: unknown = dati['anno'];
  const lavorate: unknown = dati['festivitaLavorate'];
  if (
    typeof dipendenteId !== 'string' ||
    typeof chiaveMese !== 'string' ||
    !eChiaveMese(chiaveMese) ||
    typeof anno !== 'number' ||
    !Array.isArray(lavorate)
  ) {
    return null;
  }
  const festivitaLavorate: RiepilogoPerStorico['festivitaLavorate'] = [];
  for (const voce of lavorate) {
    if (
      eMappa(voce) &&
      typeof voce['idFestivita'] === 'string' &&
      typeof voce['giorno'] === 'string' &&
      eChiaveGiorno(voce['giorno']) &&
      typeof voce['codice'] === 'string' &&
      eCodiceTurno(voce['codice'])
    ) {
      festivitaLavorate.push({
        idFestivita: voce['idFestivita'],
        giorno: voce['giorno'],
        codice: voce['codice'],
      });
    }
  }
  return { dipendenteId, chiaveMese, anno, festivitaLavorate };
}

/**
 * I riepiloghi dei mesi tra `da` e `a` (compresi) in cui qualcuno ha lavorato la festività: una query con
 * `array-contains` su `festivitaIds` e un intervallo su `chiaveMese` (indice composto). Fino a 5 anni × dipendenti.
 */
export async function leggiRiepiloghiFestivita(
  db: Firestore,
  repartoId: string,
  idFestivita: string,
  da: ChiaveMese,
  a: ChiaveMese,
): Promise<RiepilogoPerStorico[]> {
  const risultato = await getDocs(
    query(
      collection(db, 'reparti', repartoId, 'riepiloghi'),
      where('festivitaIds', 'array-contains', idFestivita),
      where('chiaveMese', '>=', da),
      where('chiaveMese', '<=', a),
    ),
  );
  return risultato.docs
    .map((documento) => riepilogoPerStorico(documento.data()))
    .filter((r) => r !== null);
}

/** Un mese in bozza con avvisi: il totale dei `numeroAvvisi` dei suoi riepiloghi. Non si somma tra mesi. */
export interface MeseConAvvisi {
  readonly chiaveMese: ChiaveMese;
  readonly avvisi: number;
}

/** I mesi in bozza con almeno un avviso (indice `statoMese` + `numeroAvvisi`), dal più vecchio. */
export async function leggiMesiConAvvisi(
  db: Firestore,
  repartoId: string,
): Promise<MeseConAvvisi[]> {
  const risultato = await getDocs(
    query(
      collection(db, 'reparti', repartoId, 'riepiloghi'),
      where('statoMese', '==', 'bozza'),
      where('numeroAvvisi', '>', 0),
    ),
  );
  const perMese = new Map<ChiaveMese, number>();
  for (const documento of risultato.docs) {
    const chiaveMese: unknown = documento.get('chiaveMese');
    const avvisi: unknown = documento.get('numeroAvvisi');
    if (typeof chiaveMese === 'string' && eChiaveMese(chiaveMese) && typeof avvisi === 'number') {
      perMese.set(chiaveMese, (perMese.get(chiaveMese) ?? 0) + avvisi);
    }
  }
  return [...perMese.entries()]
    .map(([chiaveMese, avvisi]) => ({ chiaveMese, avvisi }))
    .sort((x, y) => x.chiaveMese.localeCompare(y.chiaveMese));
}

/** Il mese è stato creato? (una lettura) */
export async function esisteMese(
  db: Firestore,
  repartoId: string,
  chiave: ChiaveMese,
): Promise<boolean> {
  return (await getDoc(doc(db, 'reparti', repartoId, 'mesi', chiave))).exists();
}
