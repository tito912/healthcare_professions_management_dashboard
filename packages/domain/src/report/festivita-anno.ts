// Report annuale delle festività: per dipendente, quali festività ha lavorato nell'anno (con il codice del turno) e
// il totale. Dai riepiloghi mensili (`festivitaLavorate`, già calcolate con l'attribuzione della notte, D6). Le
// colonne sono le festività del reparto nell'anno (nazionali non escluse e locali, in ordine di data) più quelle
// lavorate che oggi non sono più nell'elenco (escluse o locali tolte dopo): non si perde nessun dato storico.
import { dataISO } from '../codici';
import { dataDelGiorno } from '../calendario/mesi';
import { festivitaNazionali, festivitaReparto, type Festivita } from '../calendario/festivita';
import type { ConfigurazioneFestivita } from '../documenti';
import type { CodiceTurno, DataISO } from '../tipi';
import type { RiepilogoPerStorico } from '../storico/festivita';

export interface ColonnaFestivita {
  readonly id: string;
  /** Null per una festività locale tolta dall'elenco: di lei resta solo l'ID. */
  readonly nome: string | null;
  readonly data: DataISO;
  readonly tipo: Festivita['tipo'] | 'nonPiuInElenco';
}

export interface RigaFestivitaAnno {
  /** Per ogni festività lavorata, i codici dei turni (in ordine). */
  readonly perFestivita: Readonly<Record<string, readonly CodiceTurno[]>>;
  /** Numero di festività lavorate nell'anno. */
  readonly totale: number;
}

export interface FestivitaAnno {
  readonly anno: number;
  readonly colonne: readonly ColonnaFestivita[];
  /** Un elemento per ogni dipendente che ha lavorato almeno una festività nell'anno. */
  readonly righe: Readonly<Record<string, RigaFestivitaAnno>>;
}

export function festivitaAnno(
  anno: number,
  configurazione: ConfigurazioneFestivita,
  riepiloghi: readonly RiepilogoPerStorico[],
): FestivitaAnno {
  const delReparto = festivitaReparto(anno, configurazione);
  const colonne = new Map<string, ColonnaFestivita>(
    delReparto.map((f) => [f.id, { id: f.id, nome: f.nome, data: f.data, tipo: f.tipo }]),
  );
  const nazionali = festivitaNazionali(anno);
  const ultimoPerChiave = new Map<string, RiepilogoPerStorico>();
  for (const riepilogo of riepiloghi) {
    if (riepilogo.anno === anno && riepilogo.chiaveMese.startsWith(`${anno}-`)) {
      ultimoPerChiave.set(`${riepilogo.chiaveMese}_${riepilogo.dipendenteId}`, riepilogo);
    }
  }
  const perDipendente = new Map<string, Map<string, CodiceTurno[]>>();
  for (const riepilogo of ultimoPerChiave.values()) {
    for (const lavorata of riepilogo.festivitaLavorate) {
      if (!colonne.has(lavorata.idFestivita)) {
        const nazionale = nazionali.find((f) => f.id === lavorata.idFestivita);
        const data =
          nazionale?.data ??
          dataDelGiorno(riepilogo.chiaveMese, lavorata.giorno) ??
          dataISO(`${anno}-12-31`);
        colonne.set(lavorata.idFestivita, {
          id: lavorata.idFestivita,
          nome: nazionale?.nome ?? null,
          data,
          tipo: 'nonPiuInElenco',
        });
      }
      const festivita =
        perDipendente.get(riepilogo.dipendenteId) ?? new Map<string, CodiceTurno[]>();
      festivita.set(lavorata.idFestivita, [
        ...(festivita.get(lavorata.idFestivita) ?? []),
        lavorata.codice,
      ]);
      perDipendente.set(riepilogo.dipendenteId, festivita);
    }
  }
  const righe: Record<string, RigaFestivitaAnno> = {};
  for (const [dipendenteId, festivita] of perDipendente) {
    const perFestivita: Record<string, readonly CodiceTurno[]> = {};
    let totale = 0;
    for (const [id, codici] of festivita) {
      perFestivita[id] = [...codici].sort();
      totale += codici.length;
    }
    righe[dipendenteId] = { perFestivita, totale };
  }
  return {
    anno,
    colonne: [...colonne.values()].sort(
      (a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id),
    ),
    righe,
  };
}
