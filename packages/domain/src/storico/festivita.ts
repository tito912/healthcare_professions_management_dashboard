// Storico delle festività (U6, UX §9.10): quante volte ogni dipendente ha lavorato una festività negli ultimi
// `ANNI_STORICO_FESTIVITA` anni, dai riepiloghi mensili. Funzioni pure: la lettura dei riepiloghi (query
// `festivitaIds array-contains`) sta nel browser. Gli anni sono quelli PRIMA dell'anno del mese mostrato: la
// pianificazione in corso si vede già nella griglia e non entra nel conteggio.
import { chiaveMeseDa } from '../calendario/mesi';
import type { RiepilogoMensileDoc } from '../documenti';
import { ANNI_STORICO_FESTIVITA } from '../impostazioni';
import type { ChiaveMese, CodiceTurno } from '../tipi';

/** I campi di un riepilogo che servono allo storico. */
export type RiepilogoPerStorico = Pick<
  RiepilogoMensileDoc,
  'dipendenteId' | 'chiaveMese' | 'anno' | 'festivitaLavorate'
>;

export interface IntervalloStorico {
  /** Primo e ultimo mese compresi, per la query sui riepiloghi. */
  readonly da: ChiaveMese;
  readonly a: ChiaveMese;
  /** Gli anni dal più recente al più lontano. */
  readonly anni: readonly number[];
}

export function intervalloStoricoFestivita(
  chiaveMese: ChiaveMese,
  anniStorico: number = ANNI_STORICO_FESTIVITA,
): IntervalloStorico {
  const anno = Number(chiaveMese.slice(0, 4));
  return {
    da: chiaveMeseDa(anno - anniStorico, 1),
    a: chiaveMeseDa(anno - 1, 12),
    anni: Array.from({ length: anniStorico }, (_, i) => anno - 1 - i),
  };
}

export interface VoceStorico {
  readonly dipendenteId: string;
  readonly codice: CodiceTurno;
}

export interface StoricoFestivita {
  readonly intervallo: IntervalloStorico;
  /** Volte in cui ogni dipendente ha lavorato la festività nell'intervallo. */
  readonly perDipendente: ReadonlyMap<string, number>;
  /** Un elemento per anno (anche vuoto), dal più recente: chi ha lavorato e con quale turno. */
  readonly perAnno: readonly { readonly anno: number; readonly voci: readonly VoceStorico[] }[];
}

export function aggregaStoricoFestivita(
  idFestivita: string,
  chiaveMese: ChiaveMese,
  riepiloghi: readonly RiepilogoPerStorico[],
  anniStorico: number = ANNI_STORICO_FESTIVITA,
): StoricoFestivita {
  const intervallo = intervalloStoricoFestivita(chiaveMese, anniStorico);
  const perDipendente = new Map<string, number>();
  const perAnno = new Map<number, VoceStorico[]>(intervallo.anni.map((anno) => [anno, []]));
  const visti = new Set<string>();
  for (const riepilogo of riepiloghi) {
    const chiaveUnica = `${riepilogo.chiaveMese}_${riepilogo.dipendenteId}`;
    if (
      visti.has(chiaveUnica) ||
      riepilogo.chiaveMese < intervallo.da ||
      riepilogo.chiaveMese > intervallo.a
    ) {
      continue;
    }
    visti.add(chiaveUnica);
    for (const lavorata of riepilogo.festivitaLavorate) {
      if (lavorata.idFestivita !== idFestivita) {
        continue;
      }
      perDipendente.set(
        riepilogo.dipendenteId,
        (perDipendente.get(riepilogo.dipendenteId) ?? 0) + 1,
      );
      perAnno.get(riepilogo.anno)?.push({
        dipendenteId: riepilogo.dipendenteId,
        codice: lavorata.codice,
      });
    }
  }
  return {
    intervallo,
    perDipendente,
    perAnno: intervallo.anni.map((anno) => ({
      anno,
      voci: [...(perAnno.get(anno) ?? [])].sort(
        (a, b) => a.dipendenteId.localeCompare(b.dipendenteId) || a.codice.localeCompare(b.codice),
      ),
    })),
  };
}
