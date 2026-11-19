// Chiamata in reperibilità (SPEC «si indica se è scattata la chiamata e quanto è durata», L21, L38). Una sola
// chiamata per reperibilità; durata intera da 1 minuto alla durata reale della fascia nel giorno (col cambio
// d'ora); ora di inizio facoltativa dentro la fascia: con l'ora, le 11 ore di riposo ripartono dalla fine
// dell'intervento (D8, `fineEffettivaPerRiposo()`). Non modifica la cella ricevuta.
import type { CellaDoc, Chiamata } from '../documenti';
import type { CodiceTurno, DataISO } from '../tipi';
import { durataReale } from '../turni/durata';
import { nellaFascia } from './valida-riga';

export type MotivoRifiutoChiamata =
  | 'reperibilitaAssente' // la cella non ha quella reperibilità
  | 'reperibilitaCoperta' // la reperibilità è coperta da un collega: la chiamata è del collega
  | 'durataNonValida' // non intera, sotto 1 minuto o oltre la durata della fascia
  | 'oraFuoriFascia'; // l'ora di inizio non cade nella fascia

export type EsitoChiamata =
  | { readonly esito: 'applicata'; readonly cella: CellaDoc }
  | { readonly esito: 'rifiutata'; readonly motivo: MotivoRifiutoChiamata };

/**
 * Registra, sostituisce o toglie (`chiamata === null`) la chiamata della reperibilità `codice` della cella.
 * `giorno` serve alla durata reale della fascia (cambio d'ora).
 */
export function impostaChiamata(
  cella: CellaDoc,
  giorno: DataISO,
  codice: CodiceTurno,
  chiamata: Chiamata | null,
): EsitoChiamata {
  const reperibilita = cella.reperibilita.find((r) => r.codice === codice);
  if (reperibilita === undefined) {
    return { esito: 'rifiutata', motivo: 'reperibilitaAssente' };
  }
  if (chiamata !== null) {
    if (reperibilita.copertaDa !== null) {
      return { esito: 'rifiutata', motivo: 'reperibilitaCoperta' };
    }
    const massimo = durataReale(giorno, reperibilita.inizio, reperibilita.fine);
    if (
      !Number.isInteger(chiamata.durataMinuti) ||
      chiamata.durataMinuti < 1 ||
      chiamata.durataMinuti > massimo
    ) {
      return { esito: 'rifiutata', motivo: 'durataNonValida' };
    }
    if (
      chiamata.oraInizio !== null &&
      !nellaFascia(chiamata.oraInizio, reperibilita.inizio, reperibilita.fine)
    ) {
      return { esito: 'rifiutata', motivo: 'oraFuoriFascia' };
    }
  }
  return {
    esito: 'applicata',
    cella: {
      ...cella,
      reperibilita: cella.reperibilita.map((r) =>
        r.codice === codice
          ? { ...r, chiamate: chiamata === null ? [] : [{ ...chiamata }] }
          : { ...r, chiamate: [...r.chiamate] },
      ),
    },
  };
}
