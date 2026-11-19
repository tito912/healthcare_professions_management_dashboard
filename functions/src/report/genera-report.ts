// generaReport (ARCHITETTURA §8): coordinatore del reparto o ADMIN. Calcola e salva `report/{idBimestre}` con i soli
// mesi convalidati, genera il file Excel del reparto (exceljs), lo archivia in Cloud Storage e lo restituisce in
// base64 per il download. Se l'archiviazione fallisce il file si restituisce lo stesso (`file: null` nel documento).
import { schemaGeneraReportInput, type GeneraReportOutput, type IdBimestre } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { oraServer } from '../comune/admin';
import { richiediLettoreDi } from '../comune/autorizzazione';
import { datiErroreSicuri, definisciCallable } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import { archiviaFile, percorsoFileReparto } from './archivio';
import { preparaReport, righeOrdinate, salvaReport, type DatiReport } from './calcolo';
import { generaExcelReparto } from './excel';
import { nomeFileReparto } from './nomi';
import { rifReport } from './rif';

const NOME = 'generaReport';

/** Genera il file del reparto per i dati letti e lo archivia; restituisce il contenuto e se l'archivio è riuscito. */
export async function creaFileReparto(
  dati: DatiReport,
): Promise<{ readonly contenuto: Buffer; readonly percorso: string | null }> {
  const contenuto = await generaExcelReparto({
    nomeReparto: dati.nomeReparto,
    idBimestre: dati.idBimestre,
    mesiInclusi: dati.conteggi.mesiInclusi,
    righe: righeOrdinate(dati),
    totali: dati.conteggi.totali,
    legenda: dati.legenda,
  });
  try {
    const percorso = await archiviaFile(
      percorsoFileReparto(dati.repartoId, dati.idBimestre),
      contenuto,
    );
    await rifReport(dati.repartoId, dati.idBimestre).update({
      file: { percorso, generatoIl: oraServer() },
    });
    return { contenuto, percorso };
  } catch (e) {
    logger.error('Archiviazione del file del report non riuscita', {
      repartoId: dati.repartoId,
      idBimestre: dati.idBimestre,
      ...datiErroreSicuri(e),
    });
    return { contenuto, percorso: null };
  }
}

/** Calcola, salva e archivia il report del bimestre; usata anche dall'invio automatico. */
export async function generaEArchivia(
  repartoId: string,
  idBimestre: IdBimestre,
  autore: Parameters<typeof voceRegistro>[0],
): Promise<{ readonly dati: DatiReport; readonly contenuto: Buffer }> {
  const dati = await preparaReport(repartoId, idBimestre);
  await salvaReport(dati, autore?.uid ?? 'sistema', {
    ref: rifNuovaVoce(repartoId),
    dati: voceRegistro(autore, {
      tipo: 'report.generato',
      repartoId,
      dettagli: {
        idBimestre,
        mesiInclusi: dati.conteggi.mesiInclusi.join(','),
        dipendenti: Object.keys(dati.conteggi.righe).length,
      },
    }),
  });
  const { contenuto } = await creaFileReparto(dati);
  return { dati, contenuto };
}

export const generaReport = definisciCallable(
  NOME,
  async (richiesta): Promise<GeneraReportOutput> => {
    const input = validaInput(NOME, schemaGeneraReportInput, richiesta.data);
    const autore = await richiediLettoreDi(richiesta, input.repartoId);
    const { dati, contenuto } = await generaEArchivia(input.repartoId, input.idBimestre, autore);
    logger.info('Report generato', {
      repartoId: input.repartoId,
      idBimestre: input.idBimestre,
      autoreUid: autore.uid,
    });
    return {
      nomeFile: nomeFileReparto(dati.idBimestre, dati.nomeReparto),
      contenutoBase64: contenuto.toString('base64'),
      mesiInclusi: [...dati.conteggi.mesiInclusi],
    };
  },
  { timeoutSeconds: 120, memory: '512MiB' },
);
