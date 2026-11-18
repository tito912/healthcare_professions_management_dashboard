// Riposo di 11 ore tra la fine di un periodo di lavoro e l'inizio del turno successivo (SPEC, D8).
// Periodi di lavoro: i turni principali svolti (orario reale se c'è) e le chiamate in reperibilità con l'ora
// di inizio, che fanno ripartire le 11 ore dalla fine dell'intervento. Le reperibilità senza chiamata e le
// chiamate senza ora non interrompono il riposo. Tutto in minuti reali a Europe/Rome.
import { spostaGiorni } from '../calendario/mesi';
import type { Chiamata, ReperibilitaInCella } from '../documenti';
import { RIPOSO_MINIMO_MINUTI } from '../impostazioni';
import type { DataISO } from '../tipi';
import { istanteLocale, type IntervalloReale } from '../turni/durata';
import { intervalloTurnoSvolto, reperibilitaSvolta, type GiornoRiga } from './giorni-riga';
import type { AvvisoRiposo } from './livelli';

export { giorniDaRighe, intervalloTurnoSvolto, turnoSvolto, type GiornoRiga } from './giorni-riga';

const MS_MINUTO = 60_000;

/** Un periodo di lavoro: `giorno` è quello della cella (anche se la chiamata cade dopo mezzanotte). */
export interface PeriodoLavoro extends IntervalloReale {
  readonly giorno: DataISO;
  readonly origine: 'turno' | 'chiamata';
}

/**
 * Intervallo reale di una chiamata con ora di inizio. L'ora sta dentro la fascia (L38): se è prima dell'inizio
 * della fascia, la chiamata cade il giorno dopo (fascia 20:00-08:00, chiamata alle 03:00). La durata si somma
 * in minuti reali, anche attraverso il cambio d'ora.
 */
function intervalloChiamata(
  giorno: DataISO,
  reperibilita: Pick<ReperibilitaInCella, 'inizio' | 'fine'>,
  chiamata: Chiamata,
): IntervalloReale | null {
  if (chiamata.oraInizio === null) {
    return null;
  }
  const giornoChiamata =
    chiamata.oraInizio >= reperibilita.inizio ? giorno : spostaGiorni(giorno, 1);
  const inizioMs = istanteLocale(giornoChiamata, chiamata.oraInizio);
  return { inizioMs, fineMs: inizioMs + chiamata.durataMinuti * MS_MINUTO };
}

/** Fine dell'intervento (D8), in millisecondi: da qui ripartono le 11 ore. Null se la chiamata non ha l'ora. */
export function fineEffettivaPerRiposo(
  giorno: DataISO,
  reperibilita: Pick<ReperibilitaInCella, 'inizio' | 'fine'>,
  chiamata: Chiamata,
): number | null {
  return intervalloChiamata(giorno, reperibilita, chiamata)?.fineMs ?? null;
}

function ordinePeriodi(a: PeriodoLavoro, b: PeriodoLavoro): number {
  return (
    a.inizioMs - b.inizioMs ||
    Number(a.origine === 'chiamata') - Number(b.origine === 'chiamata') ||
    a.giorno.localeCompare(b.giorno)
  );
}

/** I periodi di lavoro dei giorni dati, in ordine di inizio. */
export function periodiDiLavoro(giorni: readonly GiornoRiga[]): PeriodoLavoro[] {
  const periodi: PeriodoLavoro[] = [];
  for (const { giorno, cella } of giorni) {
    const turno = intervalloTurnoSvolto(giorno, cella);
    if (turno !== null) {
      periodi.push({ ...turno, giorno, origine: 'turno' });
    }
    for (const reperibilita of cella.reperibilita) {
      if (!reperibilitaSvolta(cella, reperibilita)) {
        continue;
      }
      for (const chiamata of reperibilita.chiamate) {
        const intervallo = intervalloChiamata(giorno, reperibilita, chiamata);
        if (intervallo !== null) {
          periodi.push({ ...intervallo, giorno, origine: 'chiamata' });
        }
      }
    }
  }
  return periodi.sort(ordinePeriodi);
}

/**
 * Avvisi di riposo: per ogni turno principale, i minuti tra la fine più tarda dei periodi iniziati prima e il suo
 * inizio. Sotto `RIPOSO_MINIMO_MINUTI` (660) è un avviso; 11 ore esatte non lo sono. Periodi sovrapposti danno
 * riposo zero. L'elenco può comprendere più mesi (righe del mese precedente e successivo) e qualsiasi ordine.
 */
export function avvisiRiposo(giorni: readonly GiornoRiga[]): AvvisoRiposo[] {
  const avvisi: AvvisoRiposo[] = [];
  let ultimaFine: {
    readonly ms: number;
    readonly giorno: DataISO;
    readonly origine: PeriodoLavoro['origine'];
  } | null = null;
  for (const periodo of periodiDiLavoro(giorni)) {
    if (periodo.origine === 'turno' && ultimaFine !== null) {
      const minutiRiposo = Math.max(0, Math.round((periodo.inizioMs - ultimaFine.ms) / MS_MINUTO));
      if (minutiRiposo < RIPOSO_MINIMO_MINUTI) {
        avvisi.push({
          livello: 'avviso',
          codice: 'riposoInsufficiente',
          giorno: periodo.giorno,
          giornoPrecedente: ultimaFine.giorno,
          minutiRiposo,
          origine: ultimaFine.origine,
        });
      }
    }
    if (ultimaFine === null || periodo.fineMs > ultimaFine.ms) {
      ultimaFine = { ms: periodo.fineMs, giorno: periodo.giorno, origine: periodo.origine };
    }
  }
  return avvisi;
}
