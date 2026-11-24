// Lettura del report bimestrale (ARCHITETTURA §5.12), scritto solo dalle Functions. Come `banca-ore.firestore.ts`, le
// funzioni prendono `db` e si provano sull'emulatore. Un documento senza la forma attesa non entra nella schermata.
import { doc, getDoc, type DocumentData, type Firestore } from 'firebase/firestore';
import {
  eChiaveMese,
  eIdBimestre,
  reportInviatoPerBimestre,
  type ChiaveMese,
  type ConteggiReport,
  type EsitoInvio,
  type IdBimestre,
} from '@turni/domain';

export interface EsitoInvioSalvato {
  readonly esito: EsitoInvio['esito'];
  /** Millisecondi dall'epoca dell'ultimo invio a questo dipendente. */
  readonly ilMs: number;
  readonly mailId: string | null;
  /** I mesi che comprendeva l'invio (vuoto se il documento non lo dice). */
  readonly mesiInclusi: readonly ChiaveMese[];
}

/** Il report come lo mostra la schermata: i soli ID dei dipendenti (mai nomi) e gli istanti in millisecondi. */
export interface ReportSalvato {
  readonly idBimestre: IdBimestre;
  readonly mesiInclusi: readonly ChiaveMese[];
  readonly righe: Readonly<Record<string, ConteggiReport>>;
  readonly totali: ConteggiReport;
  readonly generatoIlMs: number | null;
  readonly invii: Readonly<Record<string, EsitoInvioSalvato>>;
  readonly invioAutomaticoIlMs: number | null;
  /** Report completo evaso: invio automatico partito o invii a mano senza errori (`reportInviatoPerBimestre()`). */
  readonly inviato: boolean;
  /** L'ultimo istante di invio (automatico o a mano), per «inviato il …». */
  readonly ultimoInvioMs: number | null;
}

function eMappa(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

function millisecondi(valore: unknown): number | null {
  return typeof valore === 'object' &&
    valore !== null &&
    'toMillis' in valore &&
    typeof valore.toMillis === 'function'
    ? Number(valore.toMillis())
    : null;
}

function intero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) ? valore : null;
}

function conteggi(valore: unknown): ConteggiReport | null {
  if (!eMappa(valore)) {
    return null;
  }
  const turniSvolti = intero(valore['turniSvolti']);
  const notti = intero(valore['notti']);
  const sabati = intero(valore['sabati']);
  const domenicheEFestivi = intero(valore['domenicheEFestivi']);
  const reperibilitaSvolte = intero(valore['reperibilitaSvolte']);
  const chiamate = intero(valore['chiamate']);
  const minutiChiamate = intero(valore['minutiChiamate']);
  const minutiDovuti = intero(valore['minutiDovuti']);
  const minutiLavorati = intero(valore['minutiLavorati']);
  const saldoMinuti = intero(valore['saldoMinuti']);
  if (
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

function esito(valore: unknown): EsitoInvio['esito'] | null {
  return valore === 'accodato' || valore === 'senzaEmail' || valore === 'errore' ? valore : null;
}

/** Convertitore tipizzato del documento `report/{idBimestre}`; null se non ha la forma attesa. */
export function reportDaDati(dati: DocumentData): ReportSalvato | null {
  const idBimestre: unknown = dati['idBimestre'];
  const mesi: unknown = dati['mesiInclusi'];
  const righeGrezze: unknown = dati['righe'];
  const invoiGrezzi: unknown = dati['invii'];
  const totali = conteggi(dati['totali']);
  if (
    typeof idBimestre !== 'string' ||
    !eIdBimestre(idBimestre) ||
    !Array.isArray(mesi) ||
    !eMappa(righeGrezze) ||
    !eMappa(invoiGrezzi) ||
    totali === null
  ) {
    return null;
  }
  const mesiInclusi: ChiaveMese[] = [];
  for (const mese of mesi) {
    if (typeof mese !== 'string' || !eChiaveMese(mese)) {
      return null;
    }
    mesiInclusi.push(mese);
  }
  const righe: Record<string, ConteggiReport> = {};
  for (const [id, valore] of Object.entries(righeGrezze)) {
    const riga = conteggi(valore);
    if (riga === null) {
      return null;
    }
    righe[id] = riga;
  }
  const invii: Record<string, EsitoInvioSalvato> = {};
  for (const [id, valore] of Object.entries(invoiGrezzi)) {
    if (!eMappa(valore)) {
      return null;
    }
    const tipo = esito(valore['esito']);
    const ilMs = millisecondi(valore['il']);
    const mailId: unknown = valore['mailId'];
    if (tipo === null || ilMs === null || (mailId !== null && typeof mailId !== 'string')) {
      return null;
    }
    const mesiGrezzi: unknown = valore['mesiInclusi'];
    const mesiInvio = Array.isArray(mesiGrezzi)
      ? mesiGrezzi.filter((m): m is ChiaveMese => typeof m === 'string' && eChiaveMese(m))
      : [];
    invii[id] = { esito: tipo, ilMs, mailId, mesiInclusi: mesiInvio };
  }
  const invioAutomaticoIlMs = millisecondi(dati['invioAutomaticoIl']);
  const istantiAccodati = Object.values(invii)
    .filter((e) => e.esito === 'accodato')
    .map((e) => e.ilMs);
  const ultimoInvioMs =
    invioAutomaticoIlMs === null && istantiAccodati.length === 0
      ? null
      : Math.max(invioAutomaticoIlMs ?? 0, ...istantiAccodati);
  return {
    idBimestre,
    mesiInclusi,
    righe,
    totali,
    generatoIlMs: millisecondi(dati['generatoIl']),
    invii,
    invioAutomaticoIlMs,
    inviato: reportInviatoPerBimestre(
      invioAutomaticoIlMs !== null,
      idBimestre,
      Object.values(invii),
    ),
    ultimoInvioMs,
  };
}

/** Il report di un bimestre (una lettura); null se non è mai stato generato o non è leggibile. */
export async function leggiReport(
  db: Firestore,
  repartoId: string,
  idBimestre: IdBimestre,
): Promise<ReportSalvato | null> {
  const documento = await getDoc(doc(db, 'reparti', repartoId, 'report', idBimestre));
  const dati = documento.data();
  return dati === undefined ? null : reportDaDati(dati);
}
