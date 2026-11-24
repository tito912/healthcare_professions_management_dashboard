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
  type RiepilogoMensileDoc,
  type RiepilogoPerClassifica,
  type RiepilogoPerReport,
  type RiepilogoPerStorico,
} from '@turni/domain';
import { rigaDaDati, type RigaSalvata } from './righe.firestore';

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

function contiPerCodice(valore: unknown): Record<string, number> | null {
  if (!eMappa(valore)) {
    return null;
  }
  const conti: Record<string, number> = {};
  for (const [codice, n] of Object.entries(valore)) {
    if (typeof n !== 'number') {
      return null;
    }
    conti[codice] = n;
  }
  return conti;
}

/** Convertitore: un riepilogo senza i conteggi per codice non entra nella classifica dei sostituti (null). */
export function riepilogoPerClassifica(dati: DocumentData): RiepilogoPerClassifica | null {
  const dipendenteId: unknown = dati['dipendenteId'];
  const chiaveMese: unknown = dati['chiaveMese'];
  const conteggiPerCodice = contiPerCodice(dati['conteggiPerCodice']);
  if (
    typeof dipendenteId !== 'string' ||
    typeof chiaveMese !== 'string' ||
    !eChiaveMese(chiaveMese) ||
    conteggiPerCodice === null
  ) {
    return null;
  }
  return { dipendenteId, chiaveMese, conteggiPerCodice };
}

/**
 * I riepiloghi dei mesi tra `da` e `a` (compresi), per le volte in cui ogni collega ha fatto un turno (U8): una query
 * con un solo intervallo su `chiaveMese` (indice automatico). Si legge solo quando si apre «Trova sostituto».
 */
export async function leggiRiepiloghiPerClassifica(
  db: Firestore,
  repartoId: string,
  da: ChiaveMese,
  a: ChiaveMese,
): Promise<RiepilogoPerClassifica[]> {
  const risultato = await getDocs(
    query(
      collection(db, 'reparti', repartoId, 'riepiloghi'),
      where('chiaveMese', '>=', da),
      where('chiaveMese', '<=', a),
    ),
  );
  return risultato.docs
    .map((documento) => riepilogoPerClassifica(documento.data()))
    .filter((r): r is RiepilogoPerClassifica => r !== null);
}

/** Ciò che il dettaglio del dipendente legge di un riepilogo mensile (UX §7.9). */
export type RiepilogoDelDipendente = Pick<
  RiepilogoMensileDoc,
  | 'dipendenteId'
  | 'chiaveMese'
  | 'statoMese'
  | 'valida'
  | 'variazioni'
  | 'minutiVariazioni'
  | 'assenzePerCodice'
>;

export function riepilogoDelDipendente(dati: DocumentData): RiepilogoDelDipendente | null {
  const dipendenteId: unknown = dati['dipendenteId'];
  const chiaveMese: unknown = dati['chiaveMese'];
  const statoMese: unknown = dati['statoMese'];
  const valida: unknown = dati['valida'];
  const variazioni: unknown = dati['variazioni'];
  const minutiVariazioni: unknown = dati['minutiVariazioni'];
  const assenzePerCodice = contiPerCodice(dati['assenzePerCodice']);
  if (
    typeof dipendenteId !== 'string' ||
    typeof chiaveMese !== 'string' ||
    !eChiaveMese(chiaveMese) ||
    (statoMese !== 'bozza' && statoMese !== 'convalidato') ||
    typeof valida !== 'boolean' ||
    typeof variazioni !== 'number' ||
    typeof minutiVariazioni !== 'number' ||
    assenzePerCodice === null
  ) {
    return null;
  }
  return {
    dipendenteId,
    chiaveMese,
    statoMese,
    valida,
    variazioni,
    minutiVariazioni,
    assenzePerCodice,
  };
}

/** I riepiloghi di un dipendente nell'anno: due uguaglianze (`dipendenteId`, `anno`), nessun indice composto. */
export async function leggiRiepiloghiDipendente(
  db: Firestore,
  repartoId: string,
  dipendenteId: string,
  anno: number,
): Promise<RiepilogoDelDipendente[]> {
  const risultato = await getDocs(
    query(
      collection(db, 'reparti', repartoId, 'riepiloghi'),
      where('dipendenteId', '==', dipendenteId),
      where('anno', '==', anno),
    ),
  );
  return risultato.docs
    .map((documento) => riepilogoDelDipendente(documento.data()))
    .filter((r): r is RiepilogoDelDipendente => r !== null)
    .sort((x, y) => x.chiaveMese.localeCompare(y.chiaveMese));
}

/** La riga di un dipendente in un mese (una lettura), per l'elenco delle variazioni di orario. */
export async function leggiRigaDipendente(
  db: Firestore,
  repartoId: string,
  chiave: ChiaveMese,
  dipendenteId: string,
): Promise<RigaSalvata | null> {
  const documento = await getDoc(
    doc(db, 'reparti', repartoId, 'mesi', chiave, 'righe', dipendenteId),
  );
  return documento.exists() ? rigaDaDati(documento.id, documento.data()) : null;
}

function interoNonNegativo(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) && valore >= 0 ? valore : null;
}

/** Convertitore: un riepilogo senza i conteggi del report non entra nella somma (null). */
export function riepilogoPerReport(dati: DocumentData): RiepilogoPerReport | null {
  const dipendenteId: unknown = dati['dipendenteId'];
  const chiaveMese: unknown = dati['chiaveMese'];
  const turniSvolti = interoNonNegativo(dati['turniSvolti']);
  const notti = interoNonNegativo(dati['notti']);
  const sabati = interoNonNegativo(dati['sabati']);
  const domenicheEFestivi = interoNonNegativo(dati['domenicheEFestivi']);
  const reperibilitaSvolte = interoNonNegativo(dati['reperibilitaSvolte']);
  const chiamate = interoNonNegativo(dati['chiamate']);
  const minutiChiamate = interoNonNegativo(dati['minutiChiamate']);
  const minutiDovuti = interoNonNegativo(dati['minutiDovuti']);
  const minutiLavorati = interoNonNegativo(dati['minutiLavorati']);
  const saldoGrezzo: unknown = dati['saldoMinuti'];
  const saldoMinuti =
    typeof saldoGrezzo === 'number' && Number.isSafeInteger(saldoGrezzo) ? saldoGrezzo : null;
  if (
    typeof dipendenteId !== 'string' ||
    typeof chiaveMese !== 'string' ||
    !eChiaveMese(chiaveMese) ||
    turniSvolti === null ||
    notti === null ||
    sabati === null ||
    domenicheEFestivi === null ||
    reperibilitaSvolte === null ||
    chiamate === null ||
    minutiChiamate === null ||
    minutiDovuti === null ||
    minutiLavorati === null ||
    saldoMinuti === null
  ) {
    return null;
  }
  return {
    dipendenteId,
    chiaveMese,
    turniSvolti,
    notti,
    sabati,
    domenicheEFestivi,
    reperibilitaSvolte,
    chiamate,
    minutiChiamate,
    minutiDovuti,
    minutiLavorati,
    saldoMinuti,
  };
}

/**
 * I riepiloghi dei mesi tra `da` e `a` (compresi) per la vista provvisoria del report bimestrale: una query con un solo
 * intervallo su `chiaveMese` (indice automatico), al più 2 × dipendenti documenti.
 */
export async function leggiRiepiloghiPerReport(
  db: Firestore,
  repartoId: string,
  da: ChiaveMese,
  a: ChiaveMese,
): Promise<RiepilogoPerReport[]> {
  const risultato = await getDocs(
    query(
      collection(db, 'reparti', repartoId, 'riepiloghi'),
      where('chiaveMese', '>=', da),
      where('chiaveMese', '<=', a),
    ),
  );
  return risultato.docs
    .map((documento) => riepilogoPerReport(documento.data()))
    .filter((r): r is RiepilogoPerReport => r !== null);
}

/** Le festività lavorate in un mese e se il mese è ancora in bozza (report «Festività dell'anno»). */
export interface RiepilogoFestivitaAnno extends RiepilogoPerStorico {
  readonly statoMese: 'bozza' | 'convalidato';
}

export function riepilogoFestivitaAnno(dati: DocumentData): RiepilogoFestivitaAnno | null {
  const base = riepilogoPerStorico(dati);
  const statoMese: unknown = dati['statoMese'];
  return base === null || (statoMese !== 'bozza' && statoMese !== 'convalidato')
    ? null
    : { ...base, statoMese };
}

/** Tutti i riepiloghi dell'anno (`anno ==`, indice automatico): fino a 12 × dipendenti documenti, una volta per anno. */
export async function leggiRiepiloghiAnno(
  db: Firestore,
  repartoId: string,
  anno: number,
): Promise<RiepilogoFestivitaAnno[]> {
  const risultato = await getDocs(
    query(collection(db, 'reparti', repartoId, 'riepiloghi'), where('anno', '==', anno)),
  );
  return risultato.docs
    .map((documento) => riepilogoFestivitaAnno(documento.data()))
    .filter((r): r is RiepilogoFestivitaAnno => r !== null);
}
