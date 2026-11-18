// Operazioni sulle celle della griglia (U3, UX §9.3). Le stesse regole valgono per inserimento veloce,
// pennello, incolla e menu: `applicaAssegnazione()` è l'unico punto che cambia la pianificazione di una cella.
// Le funzioni non modificano mai la cella ricevuta: restituiscono una cella nuova.
import { MAX_REPERIBILITA_GIORNO } from '../impostazioni';
import type {
  AssenzaInCella,
  CellaDoc,
  ReperibilitaInCella,
  RigaDoc,
  TurnoInCella,
} from '../documenti';
import type { MotivoRifiuto } from '../regole/livelli';
import type { AssenzaConfigurata, TurnoConfigurato } from '../regole/opzioni-cella';
import type { ChiaveGiorno, CodiceTurno } from '../tipi';

export function cellaVuota(): CellaDoc {
  return {
    turno: null,
    assenza: null,
    reperibilita: [],
    orarioReale: null,
    sostituisce: null,
    copertoDa: null,
  };
}

/** Nessun contenuto: una cella così non si salva (il giorno sparisce dalla mappa `giorni`). */
export function eCellaVuota(cella: CellaDoc): boolean {
  return (
    cella.turno === null &&
    cella.assenza === null &&
    cella.reperibilita.length === 0 &&
    cella.orarioReale === null &&
    cella.sostituisce === null &&
    cella.copertoDa === null
  );
}

/**
 * Dati di consuntivo (UX §9.2): orario reale, sostituzione, copertura, chiamate o reperibilità sostituite o
 * coperte. Una cella così non si modifica dalla griglia ma dal suo dettaglio (step 2.3 e 3.2).
 */
export function haConsuntivo(cella: CellaDoc): boolean {
  return (
    cella.orarioReale !== null ||
    cella.sostituisce !== null ||
    cella.copertoDa !== null ||
    cella.reperibilita.some(
      (r) => r.chiamate.length > 0 || r.sostituisce !== null || r.copertaDa !== null,
    )
  );
}

/** Copia nella cella di un turno della configurazione (orari, pausa e notturno di oggi: L28). */
export function turnoInCella(turno: TurnoConfigurato): TurnoInCella {
  return {
    codice: turno.codice,
    inizio: turno.inizio,
    fine: turno.fine,
    pausaMinuti: turno.pausaMinuti,
    notturno: turno.notturno,
  };
}

export function assenzaInCella(assenza: AssenzaConfigurata): AssenzaInCella {
  return { codice: assenza.codice, effetto: assenza.effetto, malattia: assenza.malattia };
}

export function reperibilitaInCella(fascia: TurnoConfigurato): ReperibilitaInCella {
  return {
    codice: fascia.codice,
    inizio: fascia.inizio,
    fine: fascia.fine,
    chiamate: [],
    sostituisce: null,
    copertaDa: null,
  };
}

/** Che cosa si applica a una cella. */
export type Assegnazione =
  | { readonly tipo: 'turno'; readonly turno: TurnoInCella }
  | { readonly tipo: 'assenza'; readonly assenza: AssenzaInCella }
  | { readonly tipo: 'reperibilita'; readonly reperibilita: ReperibilitaInCella }
  /** Svuota pianificazione e assenza (gomma, Canc). */
  | { readonly tipo: 'gomma' }
  /** Menu «Elimina il turno scoperto»: resta solo l'assenza. */
  | { readonly tipo: 'eliminaTurnoScoperto' }
  /** Menu «Rimuovi» su una reperibilità. */
  | { readonly tipo: 'rimuoviReperibilita'; readonly codice: CodiceTurno };

export interface ContestoAssegnazione {
  /** Turni e fasce esclusi del dipendente (dal suo documento, non dalla riga). */
  readonly turniEsclusi: readonly CodiceTurno[];
  /** Il giorno è tra assunzione e cessazione (`inServizioIl()` con il `contratto` della riga). */
  readonly inServizio: boolean;
}

export type EsitoAssegnazione =
  | { readonly esito: 'applicata'; readonly cella: CellaDoc }
  | { readonly esito: 'rifiutata'; readonly motivo: MotivoRifiuto };

function rifiuta(motivo: MotivoRifiuto): EsitoAssegnazione {
  return { esito: 'rifiutata', motivo };
}

function aggiunge(assegnazione: Assegnazione): boolean {
  return (
    assegnazione.tipo === 'turno' ||
    assegnazione.tipo === 'assenza' ||
    assegnazione.tipo === 'reperibilita'
  );
}

/**
 * Applica un'assegnazione (UX §9.3):
 * - un turno sostituisce turno e assenza; le reperibilità restano;
 * - un'assenza «come riposo» sostituisce il turno;
 * - un'assenza neutra su un turno lo lascia scoperto; senza turno è un'assenza semplice;
 * - una reperibilità si aggiunge (al massimo 2, senza ripetizioni);
 * - la gomma svuota tutto.
 * Rifiuta: le celle con consuntivo (qualunque modifica), i turni e le fasce esclusi, ciò che si aggiunge in un
 * giorno fuori servizio (la gomma lì è ammessa, per togliere un contenuto rimasto dopo un cambio di date).
 */
export function applicaAssegnazione(
  cella: CellaDoc | null,
  assegnazione: Assegnazione,
  contesto: ContestoAssegnazione,
): EsitoAssegnazione {
  const prima = cella ?? cellaVuota();
  if (haConsuntivo(prima)) {
    return rifiuta('consuntivo');
  }
  if (aggiunge(assegnazione) && !contesto.inServizio) {
    return rifiuta('fuoriServizio');
  }
  switch (assegnazione.tipo) {
    case 'turno':
      if (contesto.turniEsclusi.includes(assegnazione.turno.codice)) {
        return rifiuta('turnoEscluso');
      }
      return {
        esito: 'applicata',
        cella: { ...prima, turno: { ...assegnazione.turno }, assenza: null },
      };
    case 'assenza': {
      const assenza = { ...assegnazione.assenza };
      const turno = assenza.effetto === 'neutra' ? prima.turno : null;
      return { esito: 'applicata', cella: { ...prima, turno, assenza } };
    }
    case 'reperibilita': {
      const nuova = assegnazione.reperibilita;
      if (contesto.turniEsclusi.includes(nuova.codice)) {
        return rifiuta('turnoEscluso');
      }
      if (prima.reperibilita.some((r) => r.codice === nuova.codice)) {
        return rifiuta('reperibilitaGiaPresente');
      }
      if (prima.reperibilita.length >= MAX_REPERIBILITA_GIORNO) {
        return rifiuta('massimoReperibilita');
      }
      return {
        esito: 'applicata',
        cella: { ...prima, reperibilita: [...prima.reperibilita, { ...nuova, chiamate: [] }] },
      };
    }
    case 'gomma':
      return { esito: 'applicata', cella: cellaVuota() };
    case 'eliminaTurnoScoperto':
      return {
        esito: 'applicata',
        cella: prima.assenza === null ? { ...prima } : { ...prima, turno: null },
      };
    case 'rimuoviReperibilita':
      return {
        esito: 'applicata',
        cella: {
          ...prima,
          reperibilita: prima.reperibilita.filter((r) => r.codice !== assegnazione.codice),
        },
      };
  }
}

/** Codici della cella separati da spazio, come vanno negli appunti (UX §9.4): «M1 MA R1 R2». */
export function testoCella(cella: CellaDoc): string {
  return [cella.turno?.codice, cella.assenza?.codice, ...cella.reperibilita.map((r) => r.codice)]
    .filter((codice) => codice !== undefined)
    .join(' ');
}

/** La mappa `giorni` con la cella impostata; una cella vuota toglie il giorno. Non modifica la mappa ricevuta. */
export function impostaCella(
  giorni: RigaDoc['giorni'],
  giorno: ChiaveGiorno,
  cella: CellaDoc,
): RigaDoc['giorni'] {
  const copia: RigaDoc['giorni'] = { ...giorni };
  if (eCellaVuota(cella)) {
    delete copia[giorno];
  } else {
    copia[giorno] = cella;
  }
  return copia;
}
