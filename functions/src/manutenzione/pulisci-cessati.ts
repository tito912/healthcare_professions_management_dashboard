// pulisciCessati (ARCHITETTURA §8, L3, L16): ogni notte alle 03:00 Europe/Rome elimina in modo definitivo i dipendenti
// cessati da almeno 5 anni (documento, `privato/dati` e indice HMAC del codice fiscale) e i file Excel dei report più
// vecchi di `CONSERVAZIONE_FILE_REPORT_GIORNI`. Righe, riepiloghi, banca ore e report contengono solo l'ID del
// dipendente: restano com'erano (mese convalidato = sola lettura, D2) e diventano anonimi da soli («Dipendente
// rimosso»). Nel registro va una voce con soli conteggi; nei log solo ID. Con `modalitaProva` elenca senza cancellare.
// Audit 4.4, I1: si elimina solo se il documento non è stato salvato negli ultimi 30 giorni (periodo di grazia) e, prima
// di cancellare, una transazione rilegge il dipendente e ricontrolla data e grazia: una correzione appena fatta vince.
import {
  daEliminare,
  dataISO,
  dataLimiteCessazione,
  eDataISO,
  eIdBimestre,
  FUSO,
  fileReportScaduto,
  graziaPuliziaTrascorsa,
  oggi,
  type DataISO,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import { app, db } from '../comune/admin';
import { datiErroreSicuri } from '../comune/errori';
import { PULIZIA_MODALITA_PROVA } from '../comune/parametri';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { rifIndiceCodiceFiscale, rifPrivato } from '../dipendenti/rif';
import { rifReport } from '../report/rif';

/** File di Storage visti dalla pulizia: percorso e istante di creazione (ISO 8601). */
export interface FileArchiviato {
  readonly percorso: string;
  readonly creatoIl: string;
}

/** Accesso a Cloud Storage, sostituibile nei test. */
export interface ArchivioFile {
  elenca(prefisso: string): Promise<readonly FileArchiviato[]>;
  elimina(percorso: string): Promise<void>;
}

export function archivioPredefinito(nomeBucket?: string): ArchivioFile {
  const bucket = () => getStorage(app()).bucket(nomeBucket);
  return {
    async elenca(prefisso) {
      const [file] = await bucket().getFiles({ prefix: prefisso });
      return file.flatMap((f) => {
        const creatoIl: unknown = f.metadata.timeCreated;
        return typeof creatoIl === 'string' ? [{ percorso: f.name, creatoIl }] : [];
      });
    },
    async elimina(percorso) {
      await bucket().file(percorso).delete({ ignoreNotFound: true });
    },
  };
}

export interface OpzioniPulizia {
  /** Se vero elenca (log) e conta senza cancellare nulla. */
  readonly modalitaProva: boolean;
  readonly archivio: ArchivioFile;
}

export interface RisultatoPulizia {
  readonly modalitaProva: boolean;
  /** Cessati da almeno 5 anni trovati. */
  readonly dipendentiTrovati: number;
  readonly dipendentiEliminati: number;
  readonly fileScaduti: number;
  readonly fileEliminati: number;
  readonly errori: number;
}

export interface Cessato {
  readonly repartoId: string;
  readonly dipendenteId: string;
}

const PERCORSO_FILE_REPORT = /^report\/([^/]+)\/([^/]+)\/reparto\.xlsx$/;

/** Millisecondi dell'ultimo salvataggio del documento, o null se manca o non è un istante. */
function aggiornatoIlMs(documento: DocumentSnapshot): number | null {
  const aggiornato: unknown = documento.get('aggiornatoIl');
  return aggiornato instanceof Timestamp ? aggiornato.toMillis() : null;
}

/** Vero se il documento è un cessato da 5 anni e fuori dal periodo di grazia. Nel dubbio, falso. */
function eliminabile(documento: DocumentSnapshot, oggiData: DataISO): boolean {
  const cessazione: unknown = documento.get('dataCessazione');
  const aggiornato = aggiornatoIlMs(documento);
  return (
    documento.exists &&
    typeof cessazione === 'string' &&
    eDataISO(cessazione) &&
    daEliminare(dataISO(cessazione), oggiData) &&
    aggiornato !== null &&
    graziaPuliziaTrascorsa(aggiornato, oggiData)
  );
}

async function cessatiDaEliminare(oggiData: DataISO): Promise<readonly Cessato[]> {
  const risultato = await db()
    .collectionGroup('dipendenti')
    .where('dataCessazione', '<=', dataLimiteCessazione(oggiData))
    .select('dataCessazione', 'aggiornatoIl')
    .get();
  return risultato.docs.flatMap((documento) => {
    const repartoId = documento.ref.parent.parent?.id;
    return repartoId !== undefined && eliminabile(documento, oggiData)
      ? [{ repartoId, dipendenteId: documento.id }]
      : [];
  });
}

/**
 * Elimina il cessato in una transazione che rilegge il dipendente e ricontrolla data di cessazione e periodo di
 * grazia (audit 4.4, I1). Restituisce false, senza cancellare nulla, se nel frattempo non è più da eliminare.
 */
export async function eliminaCessato(cessato: Cessato, oggiData: DataISO): Promise<boolean> {
  const riferimento = db()
    .collection('reparti')
    .doc(cessato.repartoId)
    .collection('dipendenti')
    .doc(cessato.dipendenteId);
  const privato = rifPrivato(riferimento);
  return db().runTransaction(async (transazione) => {
    const documento = await transazione.get(riferimento);
    if (!eliminabile(documento, oggiData)) {
      return false;
    }
    const hmac: unknown = (await transazione.get(privato)).get('hmacCodiceFiscale');
    let indice: DocumentReference | null = null;
    if (typeof hmac === 'string' && hmac !== '') {
      const rifIndice = rifIndiceCodiceFiscale(hmac);
      // L'indice si elimina solo se è davvero di questo dipendente.
      if ((await transazione.get(rifIndice)).get('dipendenteId') === cessato.dipendenteId) {
        indice = rifIndice;
      }
    }
    if (indice !== null) {
      transazione.delete(indice);
    }
    transazione.delete(privato);
    transazione.delete(riferimento);
    return true;
  });
}

/** Segna `file: null` nel report del file eliminato, se il documento esiste ancora. */
async function annullaRiferimentoFile(percorso: string): Promise<void> {
  const trovato = PERCORSO_FILE_REPORT.exec(percorso);
  const repartoId = trovato?.[1];
  const idBimestre = trovato?.[2];
  if (repartoId === undefined || idBimestre === undefined || !eIdBimestre(idBimestre)) {
    return;
  }
  const riferimento = rifReport(repartoId, idBimestre);
  if ((await riferimento.get()).exists) {
    await riferimento.update({ file: null });
  }
}

/**
 * Esegue la pulizia alla data `oggiData`. Un errore su un dipendente o su un file non ferma gli altri: si conta e si
 * registra solo l'ID.
 */
export async function eseguiPulizia(
  oggiData: DataISO,
  opzioni: OpzioniPulizia,
): Promise<RisultatoPulizia> {
  const { modalitaProva, archivio } = opzioni;
  let errori = 0;
  let dipendentiEliminati = 0;
  let fileEliminati = 0;

  const cessati = await cessatiDaEliminare(oggiData);
  for (const cessato of cessati) {
    if (modalitaProva) {
      logger.info('Pulizia in prova: dipendente da eliminare', { ...cessato });
      continue;
    }
    try {
      if (await eliminaCessato(cessato, oggiData)) {
        dipendentiEliminati += 1;
      } else {
        logger.info('Pulizia: dipendente non più da eliminare, saltato', { ...cessato });
      }
    } catch (e) {
      errori += 1;
      logger.error('Pulizia: eliminazione del dipendente non riuscita', {
        ...cessato,
        ...datiErroreSicuri(e),
      });
    }
  }

  let scaduti: readonly FileArchiviato[] = [];
  try {
    scaduti = (await archivio.elenca('report/')).filter(
      (f) => PERCORSO_FILE_REPORT.test(f.percorso) && fileReportScaduto(f.creatoIl, oggiData),
    );
  } catch (e) {
    errori += 1;
    logger.error('Pulizia: elenco dei file dei report non riuscito', datiErroreSicuri(e));
  }
  for (const file of scaduti) {
    if (modalitaProva) {
      logger.info('Pulizia in prova: file di report da eliminare', { percorso: file.percorso });
      continue;
    }
    try {
      await archivio.elimina(file.percorso);
      fileEliminati += 1;
      await annullaRiferimentoFile(file.percorso);
    } catch (e) {
      errori += 1;
      logger.error('Pulizia: eliminazione del file non riuscita', {
        percorso: file.percorso,
        ...datiErroreSicuri(e),
      });
    }
  }

  const risultato: RisultatoPulizia = {
    modalitaProva,
    dipendentiTrovati: cessati.length,
    dipendentiEliminati,
    fileScaduti: scaduti.length,
    fileEliminati,
    errori,
  };
  // Solo conteggi: nessun nome, codice fiscale o email. Nessuna voce se non c'era nulla da fare (review 4.2, rilievo 3):
  // il registro non ha scadenza e una voce «0 e 0» ogni notte coprirebbe quelle utili.
  if (risultato.dipendentiTrovati + risultato.fileScaduti + risultato.errori > 0) {
    await rifNuovaVoce(null).set(
      voceRegistro(null, {
        tipo: 'pulizia.eseguita',
        repartoId: null,
        dettagli: { ...risultato },
      }),
    );
  }
  logger.info('Pulizia eseguita', { ...risultato });
  return risultato;
}

export const pulisciCessati = onSchedule(
  { schedule: '0 3 * * *', timeZone: FUSO, timeoutSeconds: 540, memory: '512MiB' },
  async () => {
    await eseguiPulizia(dataISO(oggi()), {
      modalitaProva: PULIZIA_MODALITA_PROVA.value(),
      archivio: archivioPredefinito(),
    });
  },
);
