// Totali di fine riga (SPEC griglia, UX §8.1): ore pianificate, ore dovute (D4), differenza, unità di reperibilità.
// Tutto in minuti interi; le ore decimali esistono solo nella formattazione.
import { oreDovuteMese, type ContrattoOre } from '../banca-ore/ore-dovute';
import type { Festivita } from '../calendario/festivita';
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import type { CellaDoc } from '../documenti';
import type { ChiaveGiorno, ChiaveMese, Minuti } from '../tipi';
import { durataLavorata } from '../turni/durata';
import { minutiReperibilitaMese, unitaReperibilita } from './reperibilita';

export interface TotaliRiga {
  /** Turni principali pianificati e svolti dal dipendente (esclusi i turni scoperti), durata reale meno pausa. */
  readonly minutiPianificati: Minuti;
  readonly minutiDovuti: Minuti;
  /** Pianificati − dovuti. */
  readonly differenzaMinuti: Minuti;
  readonly minutiReperibilita: Minuti;
  readonly unitaReperibilita: number;
}

export interface ContestoTotali {
  readonly chiaveMese: ChiaveMese;
  /** Festività del mese (`festivitaDelMese()` dal calendario del mese). */
  readonly festivita: readonly Festivita[];
}

/**
 * Pianificate: ogni turno principale senza assenza conta tutta la sua durata lavorata nel mese del giorno in cui
 * inizia (L10), anche se finisce nel mese dopo, con il cambio d'ora. Gli orari reali non entrano: sono consuntivo.
 */
export function minutiPianificatiMese(
  chiave: ChiaveMese,
  giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
): Minuti {
  let totale = 0;
  for (const [giorno, cella] of Object.entries(giorni)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiave, giorno) : null;
    if (data === null || cella?.turno == null || cella.assenza !== null) {
      continue;
    }
    totale += durataLavorata(data, cella.turno.inizio, cella.turno.fine, cella.turno.pausaMinuti);
  }
  return totale;
}

export function totaliRiga(
  riga: {
    readonly contratto: ContrattoOre;
    readonly giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>;
  },
  contesto: ContestoTotali,
): TotaliRiga {
  const minutiPianificati = minutiPianificatiMese(contesto.chiaveMese, riga.giorni);
  const minutiDovuti = oreDovuteMese(
    contesto.chiaveMese,
    riga.contratto,
    contesto.festivita,
    riga.giorni,
  );
  const minutiReperibilita = minutiReperibilitaMese(contesto.chiaveMese, riga.giorni);
  return {
    minutiPianificati,
    minutiDovuti,
    differenzaMinuti: minutiPianificati - minutiDovuti,
    minutiReperibilita,
    unitaReperibilita: unitaReperibilita(minutiReperibilita),
  };
}
