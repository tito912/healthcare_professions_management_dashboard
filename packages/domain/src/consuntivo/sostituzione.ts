// Sostituzioni (SPEC «Trova sostituto», U8, PIANO 3.1a criterio 5). Una sostituzione tocca sempre due righe dello
// stesso giorno, con i riferimenti reciproci che `validaMese()` controlla (ARCHITETTURA §5.9):
//   turno principale: assente `copertoDa: S` sul turno scoperto, sostituto con una copia del turno e `sostituisce: A`;
//   reperibilità:     assente `copertaDa: S` sulla fascia, sostituto con una copia della fascia e `sostituisce: A`.
// Queste funzioni controllano solo la forma della sostituzione (che cosa è scoperto, che cosa ha già il sostituto).
// Disponibilità del candidato (sovrapposizioni, turni esclusi, servizio) e avvisi stanno in `classificaSostituti()` e
// `validaModifica()`. Le righe ricevute non si modificano mai.
import { cellaVuota, impostaCella } from '../griglia/cella';
import { MAX_REPERIBILITA_GIORNO } from '../impostazioni';
import type { CellaDoc, ReperibilitaInCella, RigaDoc } from '../documenti';
import type { ChiaveGiorno, CodiceTurno, OraLocale } from '../tipi';

/** Una riga del mese come la usa il consuntivo: dipendente, contratto e celle. */
export type RigaConsuntivo = Pick<RigaDoc, 'dipendenteId' | 'contratto' | 'giorni'>;

/** Che cosa si sostituisce nella cella dell'assente: il turno principale o una sua reperibilità. */
export type OggettoSostituzione =
  { readonly tipo: 'turno' } | { readonly tipo: 'reperibilita'; readonly codice: CodiceTurno };

export type MotivoRifiutoSostituzione =
  | 'stessoDipendente' // assente e sostituto coincidono
  | 'nonScoperto' // la cella dell'assente non ha un turno scoperto o una fascia scoperta con quel codice
  | 'giaCoperto' // il turno o la fascia hanno già un sostituto
  | 'assente' // il sostituto ha un'assenza neutra quel giorno
  | 'haGiaTurno' // il sostituto ha già un turno principale quel giorno
  | 'reperibilitaGiaPresente' // il sostituto ha già la stessa fascia
  | 'massimoReperibilita' // il sostituto ha già 2 reperibilità
  | 'sostituzioneAssente'; // rimozione: le due righe non hanno quella sostituzione

export type EsitoSostituzione =
  | {
      readonly esito: 'applicata';
      readonly assente: RigaConsuntivo;
      readonly sostituto: RigaConsuntivo;
    }
  | { readonly esito: 'rifiutata'; readonly motivo: MotivoRifiutoSostituzione };

function rifiuta(motivo: MotivoRifiutoSostituzione): EsitoSostituzione {
  return { esito: 'rifiutata', motivo };
}

function conCella(riga: RigaConsuntivo, giorno: ChiaveGiorno, cella: CellaDoc): RigaConsuntivo {
  return { ...riga, giorni: impostaCella(riga.giorni, giorno, cella) };
}

/** Copia profonda di una cella (le liste di reperibilità e chiamate non si condividono con l'originale). */
function copiaCella(cella: CellaDoc): CellaDoc {
  return {
    ...cella,
    turno: cella.turno === null ? null : { ...cella.turno },
    assenza: cella.assenza === null ? null : { ...cella.assenza },
    orarioReale: cella.orarioReale === null ? null : { ...cella.orarioReale },
    reperibilita: cella.reperibilita.map((r) => ({
      ...r,
      chiamate: r.chiamate.map((c) => ({ ...c })),
    })),
  };
}

/**
 * Esito della verifica della cella dell'assente: il turno o la fascia scoperti, oppure il motivo per cui non lo sono.
 * Un turno è scoperto se ha un'assenza (che `validaRiga()` ammette solo neutra); una fascia è scoperta se la cella
 * ha un'assenza neutra (con un riposo o uno smonto la reperibilità resta dell'assente).
 */
export function oggettoScoperto(
  cella: CellaDoc | undefined,
  oggetto: OggettoSostituzione,
):
  | { readonly esito: 'scoperto'; readonly inizio: OraLocale; readonly fine: OraLocale }
  | { readonly esito: 'rifiutato'; readonly motivo: 'nonScoperto' | 'giaCoperto' } {
  if (cella === undefined) {
    return { esito: 'rifiutato', motivo: 'nonScoperto' };
  }
  if (oggetto.tipo === 'turno') {
    if (cella.turno === null || cella.assenza === null) {
      return { esito: 'rifiutato', motivo: 'nonScoperto' };
    }
    return cella.copertoDa === null
      ? { esito: 'scoperto', inizio: cella.turno.inizio, fine: cella.turno.fine }
      : { esito: 'rifiutato', motivo: 'giaCoperto' };
  }
  const fascia = cella.reperibilita.find((r) => r.codice === oggetto.codice);
  if (fascia === undefined || cella.assenza?.effetto !== 'neutra') {
    return { esito: 'rifiutato', motivo: 'nonScoperto' };
  }
  return fascia.copertaDa === null
    ? { esito: 'scoperto', inizio: fascia.inizio, fine: fascia.fine }
    : { esito: 'rifiutato', motivo: 'giaCoperto' };
}

/**
 * Il sostituto prende il turno scoperto o la fascia scoperta dell'assente nel giorno dato.
 * - Turno: nella cella del sostituto il turno (copia di quello scoperto, senza orario reale) prende il posto di
 *   un'eventuale assenza «come riposo» (riposo, smonto); le reperibilità restano. Rifiutato se il sostituto ha già un
 *   turno o un'assenza neutra.
 * - Reperibilità: la fascia (copia, senza chiamate) si aggiunge alle reperibilità del sostituto; rifiutata se ha
 *   un'assenza neutra, la stessa fascia o già 2 reperibilità.
 */
export function applicaSostituzione(
  assente: RigaConsuntivo,
  sostituto: RigaConsuntivo,
  giorno: ChiaveGiorno,
  oggetto: OggettoSostituzione,
): EsitoSostituzione {
  if (assente.dipendenteId === sostituto.dipendenteId) {
    return rifiuta('stessoDipendente');
  }
  const cellaAssente = assente.giorni[giorno];
  const scoperto = oggettoScoperto(cellaAssente, oggetto);
  if (scoperto.esito === 'rifiutato' || cellaAssente === undefined) {
    return rifiuta(scoperto.esito === 'rifiutato' ? scoperto.motivo : 'nonScoperto');
  }
  const prima = copiaCella(sostituto.giorni[giorno] ?? cellaVuota());
  if (prima.assenza?.effetto === 'neutra') {
    return rifiuta('assente');
  }
  const copiaAssente = copiaCella(cellaAssente);
  if (oggetto.tipo === 'turno') {
    if (prima.turno !== null || copiaAssente.turno === null) {
      return rifiuta('haGiaTurno');
    }
    return {
      esito: 'applicata',
      assente: conCella(assente, giorno, { ...copiaAssente, copertoDa: sostituto.dipendenteId }),
      sostituto: conCella(sostituto, giorno, {
        ...prima,
        turno: { ...copiaAssente.turno },
        assenza: null,
        orarioReale: null,
        sostituisce: assente.dipendenteId,
      }),
    };
  }
  if (prima.reperibilita.some((r) => r.codice === oggetto.codice)) {
    return rifiuta('reperibilitaGiaPresente');
  }
  if (prima.reperibilita.length >= MAX_REPERIBILITA_GIORNO) {
    return rifiuta('massimoReperibilita');
  }
  const fascia = copiaAssente.reperibilita.find((r) => r.codice === oggetto.codice);
  if (fascia === undefined) {
    return rifiuta('nonScoperto');
  }
  const presa: ReperibilitaInCella = {
    ...fascia,
    chiamate: [],
    sostituisce: assente.dipendenteId,
    copertaDa: null,
  };
  return {
    esito: 'applicata',
    assente: conCella(assente, giorno, {
      ...copiaAssente,
      reperibilita: copiaAssente.reperibilita.map((r) =>
        r.codice === oggetto.codice ? { ...r, copertaDa: sostituto.dipendenteId } : r,
      ),
    }),
    sostituto: conCella(sostituto, giorno, {
      ...prima,
      reperibilita: [...prima.reperibilita, presa],
    }),
  };
}

/**
 * Toglie una sostituzione esistente: l'assente torna scoperto; il sostituto perde il turno (con il suo orario reale)
 * o la fascia (con le sue chiamate). Una cella del sostituto rimasta vuota sparisce dalla mappa. Rifiutata con
 * `sostituzioneAssente` se le due righe non hanno quella sostituzione reciproca nel giorno dato.
 */
export function rimuoviSostituzione(
  assente: RigaConsuntivo,
  sostituto: RigaConsuntivo,
  giorno: ChiaveGiorno,
  oggetto: OggettoSostituzione,
): EsitoSostituzione {
  const cellaAssente = assente.giorni[giorno];
  const cellaSostituto = sostituto.giorni[giorno];
  if (cellaAssente === undefined || cellaSostituto === undefined) {
    return rifiuta('sostituzioneAssente');
  }
  const a = copiaCella(cellaAssente);
  const s = copiaCella(cellaSostituto);
  const idA = assente.dipendenteId;
  const idS = sostituto.dipendenteId;
  if (oggetto.tipo === 'turno') {
    if (a.copertoDa !== idS || s.sostituisce !== idA) {
      return rifiuta('sostituzioneAssente');
    }
    return {
      esito: 'applicata',
      assente: conCella(assente, giorno, { ...a, copertoDa: null }),
      sostituto: conCella(sostituto, giorno, {
        ...s,
        turno: null,
        orarioReale: null,
        sostituisce: null,
      }),
    };
  }
  const coperta = a.reperibilita.some((r) => r.codice === oggetto.codice && r.copertaDa === idS);
  const presa = s.reperibilita.some((r) => r.codice === oggetto.codice && r.sostituisce === idA);
  if (!coperta || !presa) {
    return rifiuta('sostituzioneAssente');
  }
  return {
    esito: 'applicata',
    assente: conCella(assente, giorno, {
      ...a,
      reperibilita: a.reperibilita.map((r) =>
        r.codice === oggetto.codice ? { ...r, copertaDa: null } : r,
      ),
    }),
    sostituto: conCella(sostituto, giorno, {
      ...s,
      reperibilita: s.reperibilita.filter(
        (r) => !(r.codice === oggetto.codice && r.sostituisce === idA),
      ),
    }),
  };
}
