// Inserimento veloce (U7, UX §9.2): il testo digitato in una cella diventa un'assegnazione, oppure un errore
// con il motivo. Codice di turno → turno principale; codice di assenza → assenza; codice di fascia → aggiunge
// la reperibilità. Il motivo è un dato: il browser compone «N1 escluso per Rossi M.».
import { eCodiceAssenza, eCodiceTurno, normalizzaCodice } from '../codici';
import type { CellaDoc } from '../documenti';
import type { MotivoRifiuto } from '../regole/livelli';
import type { ConfigurazioneGriglia } from '../regole/opzioni-cella';
import {
  applicaAssegnazione,
  assenzaInCella,
  reperibilitaInCella,
  turnoInCella,
  type Assegnazione,
  type ContestoAssegnazione,
} from './cella';

export interface ContestoInserimento extends ContestoAssegnazione {
  readonly configurazione: ConfigurazioneGriglia;
}

export type EsitoRicercaCodice =
  | { readonly esito: 'trovata'; readonly assegnazione: Assegnazione }
  | { readonly esito: 'nonTrovata'; readonly motivo: 'codiceInesistente' | 'codiceDisattivato' };

/** L'assegnazione di un codice secondo la configurazione: copia di orari e pausa di oggi (L28). */
export function assegnazioneDaCodice(
  testo: string,
  configurazione: ConfigurazioneGriglia,
): EsitoRicercaCodice {
  const codice = normalizzaCodice(testo);
  if (eCodiceTurno(codice)) {
    const turno = configurazione.turni.find((t) => t.codice === codice);
    if (turno === undefined) {
      return { esito: 'nonTrovata', motivo: 'codiceInesistente' };
    }
    if (!turno.attivo) {
      return { esito: 'nonTrovata', motivo: 'codiceDisattivato' };
    }
    return {
      esito: 'trovata',
      assegnazione:
        turno.tipo === 'turno'
          ? { tipo: 'turno', turno: turnoInCella(turno) }
          : { tipo: 'reperibilita', reperibilita: reperibilitaInCella(turno) },
    };
  }
  const assenza = eCodiceAssenza(codice)
    ? configurazione.assenze.find((a) => a.codice === codice)
    : undefined;
  if (assenza === undefined) {
    return { esito: 'nonTrovata', motivo: 'codiceInesistente' };
  }
  if (!assenza.attivo) {
    return { esito: 'nonTrovata', motivo: 'codiceDisattivato' };
  }
  return { esito: 'trovata', assegnazione: { tipo: 'assenza', assenza: assenzaInCella(assenza) } };
}

export type EsitoInserimento =
  | { readonly esito: 'applicata'; readonly assegnazione: Assegnazione; readonly cella: CellaDoc }
  /** `codice` è il testo normalizzato (maiuscolo, senza spazi ai lati), per il messaggio. */
  | { readonly esito: 'rifiutata'; readonly motivo: MotivoRifiuto; readonly codice: string };

/**
 * Interpreta il testo digitato. Ordine dei controlli: testo vuoto, codice inesistente o disattivato, poi le
 * regole di `applicaAssegnazione()` (consuntivo, fuori servizio, escluso, reperibilità già presente o terza).
 */
export function interpretaInserimento(
  testo: string,
  cella: CellaDoc | null,
  contesto: ContestoInserimento,
): EsitoInserimento {
  const codice = normalizzaCodice(testo);
  if (codice === '') {
    return { esito: 'rifiutata', motivo: 'vuoto', codice };
  }
  const trovato = assegnazioneDaCodice(codice, contesto.configurazione);
  if (trovato.esito === 'nonTrovata') {
    return { esito: 'rifiutata', motivo: trovato.motivo, codice };
  }
  const esito = applicaAssegnazione(cella, trovato.assegnazione, contesto);
  return esito.esito === 'applicata'
    ? { esito: 'applicata', assegnazione: trovato.assegnazione, cella: esito.cella }
    : { esito: 'rifiutata', motivo: esito.motivo, codice };
}
