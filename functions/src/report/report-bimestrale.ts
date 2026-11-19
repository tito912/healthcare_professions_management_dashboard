// reportBimestrale (ARCHITETTURA §8, D7, L15): alle 08:00 Europe/Rome del giorno 6 di gennaio, marzo, maggio, luglio,
// settembre e novembre, per ogni reparto con la configurazione completata: se il bimestre appena chiuso non è già stato
// inviato e i suoi due mesi sono convalidati, lo genera e lo invia; altrimenti lascia `report.invioRimandato`.
// Idempotente: `invioAutomaticoIl` si imposta in una transazione prima di accodare e le email hanno ID deterministico,
// quindi una seconda esecuzione non rispedisce nulla. Un errore in un reparto non ferma gli altri.
import {
  bimestreDaInviare,
  copreIlBimestre,
  dataISO,
  eChiaveMese,
  FUSO,
  mesiDelBimestre,
  oggi,
  type ChiaveMese,
  type DataISO,
  type IdBimestre,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, oraServer, rifReparto } from '../comune/admin';
import { datiErroreSicuri } from '../comune/errori';
import { voceRegistro } from '../comune/registro';
import { rifMese } from '../mesi/rif';
import { generaEArchivia } from './genera-report';
import { inviaEmailReport, postaPredefinita } from './invia-report';
import type { ServizioPosta } from './posta/servizio-posta';
import { rifReport } from './rif';

/** Pianificazione dell'invio automatico (D7): il giorno 6 dei mesi dispari alle 08:00. */
export const PIANIFICAZIONE_REPORT = '0 8 6 1,3,5,7,9,11 *';

const CODICE_GIA_ESISTENTE = 6;

export type EsitoReparto =
  'inviato' | 'giaInviato' | 'rimandato' | 'senzaMesi' | 'nonConfigurato' | 'errore';

export interface RisultatoReparto {
  readonly repartoId: string;
  readonly esito: EsitoReparto;
}

function eGiaEsistente(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === CODICE_GIA_ESISTENTE;
}

function eMappa(valore: unknown): valore is object {
  return typeof valore === 'object' && valore !== null;
}

/** I mesi dichiarati da un invio registrato in `invii`; vuoto se manca (invio non verificabile = da rifare). */
function mesiDellInvio(voce: unknown): readonly ChiaveMese[] {
  const mesi: unknown = eMappa(voce) && 'mesiInclusi' in voce ? voce.mesiInclusi : null;
  return Array.isArray(mesi)
    ? mesi.filter((m): m is ChiaveMese => typeof m === 'string' && eChiaveMese(m))
    : [];
}

/**
 * Un dipendente è servito se ha già un invio `accodato` (o `senzaEmail`, se `ancheSenzaEmail`) che comprendeva
 * entrambi i mesi del bimestre: un invio a mano con un mese in bozza non chiude il bimestre, uno in errore va rifatto.
 */
function eServito(
  invii: unknown,
  dipendenteId: string,
  idBimestre: IdBimestre,
  ancheSenzaEmail: boolean,
): boolean {
  if (!eMappa(invii)) {
    return false;
  }
  const voce: unknown = Object.entries(invii).find(([chiave]) => chiave === dipendenteId)?.[1];
  const esito: unknown = eMappa(voce) && 'esito' in voce ? voce.esito : null;
  return (
    (esito === 'accodato' || (ancheSenzaEmail && esito === 'senzaEmail')) &&
    copreIlBimestre(mesiDellInvio(voce), idBimestre)
  );
}

/** I dipendenti del report che non hanno ancora ricevuto il report completo (a mano o in automatico). */
function daServire(
  ids: readonly string[],
  invii: unknown,
  idBimestre: IdBimestre,
): readonly string[] {
  return ids.filter((id) => !eServito(invii, id, idBimestre, false));
}

/**
 * L'invio automatico è già partito (e non è stato rilasciato per errori), oppure ogni dipendente ha già un esito
 * `accodato` o `senzaEmail` per il bimestre completo.
 */
function giaInviato(
  invioAutomatico: unknown,
  righe: unknown,
  invii: unknown,
  idBimestre: IdBimestre,
): boolean {
  if (invioAutomatico !== null && invioAutomatico !== undefined) {
    return true;
  }
  if (!eMappa(righe)) {
    return false;
  }
  const ids = Object.keys(righe);
  return ids.length > 0 && ids.every((id) => eServito(invii, id, idBimestre, true));
}

/** Imposta `invioAutomaticoIl` in transazione: vero solo a chi lo imposta per primo. */
async function riservaInvio(repartoId: string, idBimestre: IdBimestre): Promise<boolean> {
  const riferimento = rifReport(repartoId, idBimestre);
  return db().runTransaction(async (transazione) => {
    const snapshot = await transazione.get(riferimento);
    if (
      !snapshot.exists ||
      giaInviato(
        snapshot.get('invioAutomaticoIl'),
        snapshot.get('righe'),
        snapshot.get('invii'),
        idBimestre,
      )
    ) {
      return false;
    }
    transazione.update(riferimento, { invioAutomaticoIl: oraServer() });
    return true;
  });
}

async function registraRimando(
  repartoId: string,
  idBimestre: IdBimestre,
  mesiMancanti: readonly string[],
): Promise<void> {
  try {
    // ID fisso: una seconda esecuzione non duplica la voce.
    await rifReparto(repartoId)
      .collection('registroAttivita')
      .doc(`rimandato_${idBimestre}`)
      .create(
        voceRegistro(null, {
          tipo: 'report.invioRimandato',
          repartoId,
          dettagli: { idBimestre, motivo: 'meseNonConvalidato', mesi: mesiMancanti.join(',') },
        }),
      );
  } catch (e) {
    if (!eGiaEsistente(e)) {
      throw e;
    }
  }
}

async function elaboraReparto(
  repartoId: string,
  idBimestre: IdBimestre,
  posta: ServizioPosta,
): Promise<EsitoReparto> {
  const mesi = mesiDelBimestre(idBimestre);
  const [esistente, documentiMesi] = await Promise.all([
    rifReport(repartoId, idBimestre).get(),
    Promise.all(mesi.map((mese) => rifMese(repartoId, mese).get())),
  ]);
  if (
    esistente.exists &&
    giaInviato(
      esistente.get('invioAutomaticoIl'),
      esistente.get('righe'),
      esistente.get('invii'),
      idBimestre,
    )
  ) {
    return 'giaInviato';
  }
  if (documentiMesi.every((documento) => !documento.exists)) {
    return 'senzaMesi';
  }
  const nonConvalidati = mesi.filter((_, i) => documentiMesi[i]?.get('stato') !== 'convalidato');
  if (nonConvalidati.length > 0) {
    await registraRimando(repartoId, idBimestre, nonConvalidati);
    return 'rimandato';
  }

  const { dati } = await generaEArchivia(repartoId, idBimestre, null);
  if (!(await riservaInvio(repartoId, idBimestre))) {
    return 'giaInviato';
  }
  let esiti: Awaited<ReturnType<typeof inviaEmailReport>>;
  try {
    // Chi ha già ricevuto a mano il report completo non lo riceve una seconda volta.
    const riservato = await rifReport(repartoId, idBimestre).get();
    const dipendenteIds = daServire(
      Object.keys(dati.conteggi.righe),
      riservato.get('invii'),
      idBimestre,
    );
    esiti = await inviaEmailReport(
      { dati, dipendenteIds, anteprima: false, automatico: true, posta },
      null,
    );
  } catch (e) {
    // L'invio non è partito: si rilascia il blocco, così l'esecuzione successiva (o l'invio a mano) può riprovare.
    await rifReport(repartoId, idBimestre).update({ invioAutomaticoIl: null });
    throw e;
  }
  const errori = esiti.filter((e) => e.esito === 'errore').length;
  if (errori > 0) {
    // Almeno un'email non è stata accodata: si rilascia il blocco, l'avviso della Home resta e una nuova esecuzione
    // (o il reinvio a mano) rispedisce solo a chi non l'ha ricevuta.
    await rifReport(repartoId, idBimestre).update({ invioAutomaticoIl: null });
    logger.error('Report bimestrale: invii non riusciti', {
      repartoId,
      idBimestre,
      errori,
      dipendenti: esiti.length,
    });
    return 'errore';
  }
  return 'inviato';
}

/**
 * Esegue l'invio automatico per ogni reparto. `oggiData` decide il bimestre (`bimestreDaInviare`); `posta` è il
 * servizio di invio (i test ne passano uno finto o quello su emulatore).
 */
export async function eseguiReportBimestrale(
  oggiData: DataISO,
  posta: ServizioPosta,
): Promise<readonly RisultatoReparto[]> {
  const idBimestre = bimestreDaInviare(oggiData);
  const reparti = await db().collection('reparti').select('configurazione').get();
  const risultati: RisultatoReparto[] = [];
  for (const reparto of reparti.docs) {
    const configurazione: unknown = reparto.get('configurazione');
    const completata =
      typeof configurazione === 'object' &&
      configurazione !== null &&
      'passo' in configurazione &&
      configurazione.passo === 'completata';
    if (!completata) {
      risultati.push({ repartoId: reparto.id, esito: 'nonConfigurato' });
      continue;
    }
    try {
      risultati.push({
        repartoId: reparto.id,
        esito: await elaboraReparto(reparto.id, idBimestre, posta),
      });
    } catch (e) {
      logger.error('Report bimestrale non riuscito per un reparto', {
        repartoId: reparto.id,
        idBimestre,
        ...datiErroreSicuri(e),
      });
      risultati.push({ repartoId: reparto.id, esito: 'errore' });
    }
  }
  logger.info('Report bimestrale eseguito', {
    idBimestre,
    reparti: risultati.length,
    inviati: risultati.filter((r) => r.esito === 'inviato').length,
    rimandati: risultati.filter((r) => r.esito === 'rimandato').length,
    errori: risultati.filter((r) => r.esito === 'errore').length,
  });
  return risultati;
}

export const reportBimestrale = onSchedule(
  {
    schedule: PIANIFICAZIONE_REPORT,
    timeZone: FUSO,
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    await eseguiReportBimestrale(dataISO(oggi()), postaPredefinita());
  },
);
