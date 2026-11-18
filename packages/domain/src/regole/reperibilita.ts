// Reperibilità (SPEC «Regole e controlli automatici»): massimo 2 al giorno (blocco), al massimo 7 unità da
// 12 ore nel mese sommando le fasce più brevi (avviso), avviso se si sovrappone al turno principale.
import { dataDelGiorno, eChiaveGiorno, spostaGiorni } from '../calendario/mesi';
import type { CellaDoc } from '../documenti';
import {
  MAX_REPERIBILITA_GIORNO,
  MAX_UNITA_REPERIBILITA_MESE,
  MINUTI_UNITA_REPERIBILITA,
} from '../impostazioni';
import type { ChiaveGiorno, ChiaveMese, CodiceTurno, DataISO, Minuti } from '../tipi';
import { durataReale, intervalloReale, type IntervalloReale } from '../turni/durata';
import { intervalloTurnoSvolto, reperibilitaSvolta, type GiornoRiga } from './giorni-riga';
import type { AvvisoReperibilitaOltreLimite, AvvisoReperibilitaSovrapposta } from './livelli';

export { reperibilitaSvolta } from './giorni-riga';

/** Più di `MAX_REPERIBILITA_GIORNO` reperibilità nella cella: un blocco. */
export function superaMassimoReperibilita(cella: Pick<CellaDoc, 'reperibilita'>): boolean {
  return cella.reperibilita.length > MAX_REPERIBILITA_GIORNO;
}

/**
 * Minuti reali delle reperibilità svolte nel mese. Una fascia che attraversa la mezzanotte dell'ultimo giorno
 * conta tutta nel mese in cui inizia (L10); nella notte del cambio d'ora dura un'ora in meno o in più.
 */
export function minutiReperibilitaMese(
  chiave: ChiaveMese,
  giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
): Minuti {
  let totale = 0;
  for (const [giorno, cella] of Object.entries(giorni)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiave, giorno) : null;
    if (data === null || cella === undefined) {
      continue;
    }
    for (const reperibilita of cella.reperibilita) {
      if (reperibilitaSvolta(cella, reperibilita)) {
        totale += durataReale(data, reperibilita.inizio, reperibilita.fine);
      }
    }
  }
  return totale;
}

/** Unità da 12 ore: 720 minuti = 1, tre fasce da 4 ore = 1. Un numero con decimali, solo per lo schermo. */
export function unitaReperibilita(minuti: Minuti): number {
  return minuti / MINUTI_UNITA_REPERIBILITA;
}

/** Avviso se le unità del mese superano `MAX_UNITA_REPERIBILITA_MESE` (7 esatte non lo sono). */
export function avvisoReperibilitaMese(minuti: Minuti): AvvisoReperibilitaOltreLimite | null {
  if (minuti <= MAX_UNITA_REPERIBILITA_MESE * MINUTI_UNITA_REPERIBILITA) {
    return null;
  }
  return {
    livello: 'avviso',
    codice: 'reperibilitaOltreLimite',
    giorno: null,
    minutiReperibilita: minuti,
    unita: unitaReperibilita(minuti),
    limiteUnita: MAX_UNITA_REPERIBILITA_MESE,
  };
}

function siSovrappongono(a: IntervalloReale, b: IntervalloReale): boolean {
  return a.inizioMs < b.fineMs && b.inizioMs < a.fineMs;
}

/**
 * Reperibilità svolte che si sovrappongono a un turno principale svolto dello stesso dipendente, nello stesso
 * giorno o in quello prima o dopo (le fasce e i turni notturni attraversano la mezzanotte). Turno e fascia che
 * si toccano (fine 14:00, inizio 14:00) non si sovrappongono. Il turno usa l'orario reale se c'è.
 */
export function avvisiSovrapposizione(
  giorni: readonly GiornoRiga[],
): AvvisoReperibilitaSovrapposta[] {
  const turni = new Map<
    DataISO,
    { readonly codice: CodiceTurno; readonly intervallo: IntervalloReale }
  >();
  for (const { giorno, cella } of giorni) {
    const intervallo = intervalloTurnoSvolto(giorno, cella);
    if (intervallo !== null && cella.turno !== null) {
      turni.set(giorno, { codice: cella.turno.codice, intervallo });
    }
  }
  const avvisi: AvvisoReperibilitaSovrapposta[] = [];
  for (const { giorno, cella } of [...giorni].sort((a, b) => a.giorno.localeCompare(b.giorno))) {
    for (const reperibilita of cella.reperibilita) {
      if (!reperibilitaSvolta(cella, reperibilita)) {
        continue;
      }
      const fascia = intervalloReale(giorno, reperibilita.inizio, reperibilita.fine);
      for (const giornoTurno of [spostaGiorni(giorno, -1), giorno, spostaGiorni(giorno, 1)]) {
        const turno = turni.get(giornoTurno);
        if (turno !== undefined && siSovrappongono(fascia, turno.intervallo)) {
          avvisi.push({
            livello: 'avviso',
            codice: 'reperibilitaSovrapposta',
            giorno,
            codiceReperibilita: reperibilita.codice,
            codiceTurno: turno.codice,
            giornoTurno,
          });
        }
      }
    }
  }
  return avvisi;
}
