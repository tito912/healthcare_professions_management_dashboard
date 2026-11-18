// Che cosa ha svolto un dipendente in un giorno: base comune di riposo, reperibilità, totali e avvisi.
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import type { CellaDoc, ReperibilitaInCella, RigaDoc } from '../documenti';
import type { ChiaveMese, DataISO } from '../tipi';
import { intervalloReale, type IntervalloReale } from '../turni/durata';

/** Una cella con la sua data: l'elenco può attraversare più mesi (riposo a cavallo di mese e d'anno). */
export interface GiornoRiga {
  readonly giorno: DataISO;
  readonly cella: CellaDoc;
}

/** Il turno principale è svolto dal dipendente: c'è e non ha un'assenza (scoperto o coperto da un collega). */
export function turnoSvolto(cella: CellaDoc): boolean {
  return cella.turno !== null && cella.assenza === null;
}

/** Intervallo reale del turno svolto: l'orario reale se c'è, altrimenti il pianificato; null se non è svolto. */
export function intervalloTurnoSvolto(giorno: DataISO, cella: CellaDoc): IntervalloReale | null {
  if (cella.turno === null || cella.assenza !== null) {
    return null;
  }
  const orario = cella.orarioReale ?? cella.turno;
  return intervalloReale(giorno, orario.inizio, orario.fine);
}

/**
 * La reperibilità è a carico del dipendente: non è coperta da un collega e il giorno non ha un'assenza neutra
 * (malattia, ferie: la reperibilità resta scoperta). Con un riposo o uno smonto la reperibilità resta sua.
 */
export function reperibilitaSvolta(cella: CellaDoc, reperibilita: ReperibilitaInCella): boolean {
  return reperibilita.copertaDa === null && cella.assenza?.effetto !== 'neutra';
}

/** Le celle di una o più righe (mesi diversi dello stesso dipendente) in ordine di data; scarta i giorni inesistenti. */
export function giorniDaRighe(
  righe: readonly { readonly chiaveMese: ChiaveMese; readonly giorni: RigaDoc['giorni'] }[],
): GiornoRiga[] {
  const elenco: GiornoRiga[] = [];
  for (const { chiaveMese, giorni } of righe) {
    for (const [chiave, cella] of Object.entries(giorni)) {
      const giorno = eChiaveGiorno(chiave) ? dataDelGiorno(chiaveMese, chiave) : null;
      if (giorno !== null && cella !== undefined) {
        elenco.push({ giorno, cella });
      }
    }
  }
  return elenco.sort((a, b) => a.giorno.localeCompare(b.giorno));
}
