// pulisciCessati (ARCHITETTURA §8, L3, L16): ogni notte alle 03:00 Europe/Rome elimina in modo definitivo i dipendenti
// cessati da almeno 5 anni (documento, `privato/dati` e indice HMAC del codice fiscale) e i file Excel dei report più
// vecchi di `CONSERVAZIONE_FILE_REPORT_GIORNI`. Righe, riepiloghi, banca ore e report contengono solo l'ID del
// dipendente: restano com'erano (mese convalidato = sola lettura, D2) e diventano anonimi da soli («Dipendente
// rimosso»). Nel registro va una voce con soli conteggi; nei log solo ID. Con `modalitaProva` elenca senza cancellare.
import {
  daEliminare,
  dataISO,
  dataLimiteCessazione,
  eDataISO,
  eIdBimestre,
  FUSO,
  fileReportScaduto,
  oggi,
  type DataISO,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getStorage } from 'firebase-admin/storage';
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

interface Cessato {
  readonly repartoId: string;
  readonly dipendenteId: string;
}

const PERCORSO_FILE_REPORT = /^report\/([^/]+)\/([^/]+)\/reparto\.xlsx$/;

async function cessatiDaEliminare(oggiData: DataISO): Promise<readonly Cessato[]> {
  const risultato = await db()
    .collectionGroup('dipendenti')
    .where('dataCessazione', '<=', dataLimiteCessazione(oggiData))
    .select('dataCessazione')
    .get();
  return risultato.docs.flatMap((documento) => {
    const cessazione: unknown = documento.get('dataCessazione');
    const repartoId = documento.ref.parent.parent?.id;
    return repartoId !== undefined &&
      typeof cessazione === 'string' &&
      eDataISO(cessazione) &&
      daEliminare(dataISO(cessazione), oggiData)
      ? [{ repartoId, dipendenteId: documento.id }]
      : [];
  });
}

async function eliminaCessato(cessato: Cessato): Promise<void> {
  const riferimento = db()
    .collection('reparti')
    .doc(cessato.repartoId)
    .collection('dipendenti')
    .doc(cessato.dipendenteId);
  const privato = rifPrivato(riferimento);
  const hmac: unknown = (await privato.get()).get('hmacCodiceFiscale');
  const batch = db().batch();
  if (typeof hmac === 'string' && hmac !== '') {
    // L'indice si elimina solo se è davvero di questo dipendente.
    const indice = rifIndiceCodiceFiscale(hmac);
    if ((await indice.get()).get('dipendenteId') === cessato.dipendenteId) {
      batch.delete(indice);
    }
  }
  batch.delete(privato);
  batch.delete(riferimento);
  await batch.commit();
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
      await eliminaCessato(cessato);
      dipendentiEliminati += 1;
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
  // Solo conteggi: nessun nome, codice fiscale o email.
  await rifNuovaVoce(null).set(
    voceRegistro(null, {
      tipo: 'pulizia.eseguita',
      repartoId: null,
      dettagli: { ...risultato },
    }),
  );
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
