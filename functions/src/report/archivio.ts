// Archivio dei file Excel in Cloud Storage (ARCHITETTURA §8, L16): solo il file del reparto, in
// `report/{repartoId}/{idBimestre}/reparto.xlsx`. Il browser non accede mai a Storage: scarica dalla risposta della
// callable. I file si eliminano dopo `CONSERVAZIONE_FILE_REPORT_GIORNI` (step 4.2).
import type { IdBimestre } from '@turni/domain';
import { getStorage } from 'firebase-admin/storage';
import { app } from '../comune/admin';

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function percorsoFileReparto(repartoId: string, idBimestre: IdBimestre): string {
  return `report/${repartoId}/${idBimestre}/reparto.xlsx`;
}

/** Salva il file sul bucket predefinito e restituisce il percorso. */
export async function archiviaFile(percorso: string, contenuto: Buffer): Promise<string> {
  await getStorage(app())
    .bucket()
    .file(percorso)
    .save(contenuto, { contentType: TIPO_XLSX, resumable: false });
  return percorso;
}
