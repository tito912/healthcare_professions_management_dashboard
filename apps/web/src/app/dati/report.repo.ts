import { Injectable } from '@angular/core';
import {
  mesiDelBimestre,
  type ChiaveMese,
  type IdBimestre,
  type StatoReportBimestre,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';
import { leggiMese } from './mesi.firestore';
import { leggiReport, type ReportSalvato } from './report.firestore';

export type { EsitoInvioSalvato, ReportSalvato } from './report.firestore';

/** I due mesi di un bimestre con il loro stato (null = mese non creato o illeggibile). */
export interface MesiDelBimestre {
  readonly chiave: ChiaveMese;
  readonly stato: 'bozza' | 'convalidato' | null;
}

/** Report bimestrale (sola lettura: lo scrivono generaReport, inviaReport e reportBimestrale, ARCHITETTURA §5.12). */
@Injectable({ providedIn: 'root' })
export class ReportRepo {
  leggi(repartoId: string, idBimestre: IdBimestre): Promise<ReportSalvato | null> {
    return leggiReport(serviziFirebase().db, repartoId, idBimestre);
  }

  /** Lo stato dei due mesi del bimestre (due letture). */
  async mesi(repartoId: string, idBimestre: IdBimestre): Promise<readonly MesiDelBimestre[]> {
    const { db } = serviziFirebase();
    return Promise.all(
      mesiDelBimestre(idBimestre).map(async (chiave): Promise<MesiDelBimestre> => {
        const mese = await leggiMese(db, repartoId, chiave);
        return { chiave, stato: mese?.stato ?? null };
      }),
    );
  }

  /** Report e stato dei mesi per l'avviso della Home: tre letture per reparto. */
  async statoBimestre(repartoId: string, idBimestre: IdBimestre): Promise<StatoReportBimestre> {
    const [report, mesi] = await Promise.all([
      this.leggi(repartoId, idBimestre),
      this.mesi(repartoId, idBimestre),
    ]);
    return { idBimestre, inviato: report?.inviato ?? false, mesi };
  }
}
