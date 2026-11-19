// Conservazione dei dati dei dipendenti cessati (L3): dopo 5 anni dalla cessazione `pulisciCessati` li elimina.
import { DateTime } from 'luxon';
import { dataISO } from './codici';
import { ANNI_CONSERVAZIONE_CESSATI, CONSERVAZIONE_FILE_REPORT_GIORNI, FUSO } from './impostazioni';
import type { DataISO } from './tipi';

function giorno(data: DataISO): DateTime {
  return DateTime.fromISO(data, { zone: FUSO });
}

/** Primo giorno in cui un cessato va eliminato: 5 anni esatti dopo la cessazione (29 febbraio -> 28 febbraio). */
export function dataEliminazione(dataCessazione: DataISO): DataISO {
  return dataISO(
    giorno(dataCessazione).plus({ years: ANNI_CONSERVAZIONE_CESSATI }).toFormat('yyyy-LL-dd'),
  );
}

/** Vero da 5 anni esatti dopo la data di cessazione (compreso quel giorno). `oggi` è un parametro: niente orologio. */
export function daEliminare(dataCessazione: DataISO, oggi: DataISO): boolean {
  return oggi >= dataEliminazione(dataCessazione);
}

/**
 * Ultima data di cessazione che può già essere da eliminare oggi, per restringere la query: una cessazione al
 * 29 febbraio scade il 28 febbraio, quindi si lascia un giorno di margine e si filtra poi con `daEliminare`.
 */
export function dataLimiteCessazione(oggi: DataISO): DataISO {
  return dataISO(
    giorno(oggi)
      .minus({ years: ANNI_CONSERVAZIONE_CESSATI })
      .plus({ days: 1 })
      .toFormat('yyyy-LL-dd'),
  );
}

/**
 * Vero se un file di report creato all'istante `creatoIso` (ISO 8601, come `timeCreated` di Cloud Storage) ha
 * almeno `CONSERVAZIONE_FILE_REPORT_GIORNI` giorni di calendario a Europe/Rome (L16).
 */
export function fileReportScaduto(creatoIso: string, oggi: DataISO): boolean {
  const creato = DateTime.fromISO(creatoIso, { setZone: false }).setZone(FUSO);
  if (!creato.isValid) {
    return false;
  }
  const scadenza = creato.startOf('day').plus({ days: CONSERVAZIONE_FILE_REPORT_GIORNI });
  return giorno(oggi) >= scadenza;
}
