// validaModifica (D2, PIANO 3.1a criterio 6): una modifica di consuntivo — orari reali, assenza su uno o più giorni,
// sostituzione (e la sua rimozione), chiamate in reperibilità — applicata alla riga di un mese in bozza. Restituisce
// le righe risultanti (una, o due per le sostituzioni) con tutte le loro segnalazioni, oppure il blocco con il motivo.
// Su un mese convalidato è sempre un blocco: dopo la convalida il mese è in sola lettura totale (D2).
// La usa la griglia (step 3.2) prima di aggiungere la modifica a quelle non salvate. Non modifica le righe ricevute.
import { dataDelGiorno } from '../calendario/mesi';
import { inServizioIl } from '../calendario/servizio';
import type { AssenzaInCella, CellaDoc, Chiamata, OrarioReale } from '../documenti';
import { applicaAssegnazione, impostaCella } from '../griglia/cella';
import { impostaChiamata, type MotivoRifiutoChiamata } from '../griglia/chiamata';
import { soloBlocchi, validaRiga } from '../griglia/valida-riga';
import { MAX_CHIAMATE_PER_REPERIBILITA } from '../impostazioni';
import { avvisiRiga } from '../regole/avvisi-riga';
import { turnoSvolto } from '../regole/giorni-riga';
import type { CodiceProblemaRiga, MotivoRifiuto, Segnalazione } from '../regole/livelli';
import {
  scopertoDi,
  valutaCandidato,
  type MotivoNonDisponibile,
  type RigheAdiacentiDipendente,
} from '../sostituti/classifica';
import type { ChiaveGiorno, ChiaveMese, CodiceTurno } from '../tipi';
import {
  applicaSostituzione,
  oggettoScoperto,
  rimuoviSostituzione,
  type MotivoRifiutoSostituzione,
  type OggettoSostituzione,
  type RigaConsuntivo,
} from './sostituzione';
import { orarioVariato } from './variazione';

export type ModificaConsuntivo =
  /** Orario reale di un turno svolto; null lo toglie. Un orario uguale al previsto non si conserva. */
  | {
      readonly tipo: 'orarioReale';
      readonly giorno: ChiaveGiorno;
      readonly orario: OrarioReale | null;
    }
  /** La stessa assenza su uno o più giorni della riga (regole di `applicaAssegnazione()`, UX §9.3). */
  | {
      readonly tipo: 'assenza';
      readonly giorni: readonly ChiaveGiorno[];
      readonly assenza: AssenzaInCella;
    }
  /** La riga è quella dell'assente; il sostituto è `contesto.collega`. */
  | {
      readonly tipo: 'sostituzione' | 'rimuoviSostituzione';
      readonly giorno: ChiaveGiorno;
      readonly oggetto: OggettoSostituzione;
      readonly sostitutoId: string;
    }
  /** L'elenco completo delle chiamate di una reperibilità (vuoto le toglie). */
  | {
      readonly tipo: 'chiamate';
      readonly giorno: ChiaveGiorno;
      readonly codice: CodiceTurno;
      readonly chiamate: readonly Chiamata[];
    };

export interface ContestoModifica {
  readonly chiaveMese: ChiaveMese;
  readonly statoMese: 'bozza' | 'convalidato';
  /** Turni e fasce esclusi per dipendente (dal suo documento). */
  readonly turniEsclusi: Readonly<Record<string, readonly CodiceTurno[]>>;
  /** Righe dello stesso dipendente nei mesi adiacenti, per gli avvisi e le sovrapposizioni a cavallo di mese. */
  readonly righeAdiacenti: Readonly<Record<string, RigheAdiacentiDipendente>>;
  /** La riga del sostituto, per `sostituzione` e `rimuoviSostituzione`; null per le altre modifiche. */
  readonly collega: RigaConsuntivo | null;
}

export type MotivoBloccoModifica =
  | 'meseConvalidato' // D2: sola lettura totale
  | 'giornoInesistente' // il giorno non è del mese
  | 'nessunGiorno' // assenza senza giorni
  | 'turnoNonSvolto' // orario reale su una cella senza turno svolto (vuota, scoperta, solo reperibilità)
  | 'rigaCollegaMancante' // sostituzione senza la riga del sostituto
  | 'reperibilitaScoperta' // chiamata su una reperibilità in un giorno di assenza neutra
  | 'troppeChiamate' // oltre MAX_CHIAMATE_PER_REPERIBILITA (L21)
  | 'rigaNonValida' // la cella risultante non passa validaRiga (codici in `codici`)
  | MotivoRifiuto // assenza: `consuntivo`, `fuoriServizio` (applicaAssegnazione)
  | MotivoRifiutoSostituzione
  | MotivoNonDisponibile['codice'] // sostituto non disponibile (L9)
  | MotivoRifiutoChiamata; // durata e ora della chiamata (L38), reperibilità assente o coperta

export interface AvvisiDiRiga {
  readonly dipendenteId: string;
  /** Tutte le segnalazioni della riga risultante (`avvisiRiga()`), come le mostra il pannello Avvisi. */
  readonly segnalazioni: readonly Segnalazione[];
}

export type EsitoModifica =
  | {
      readonly esito: 'consentita';
      /** La riga modificata e, per le sostituzioni, quella del sostituto (in quest'ordine). */
      readonly righe: readonly RigaConsuntivo[];
      readonly avvisi: readonly AvvisiDiRiga[];
    }
  | {
      readonly esito: 'bloccata';
      readonly motivo: MotivoBloccoModifica;
      readonly giorno: ChiaveGiorno | null;
      /** Solo per `rigaNonValida`: i codici di `validaRiga()`; altrimenti vuoto. */
      readonly codici: readonly CodiceProblemaRiga[];
    };

type EsitoInterno =
  | {
      readonly esito: 'applicata';
      readonly righe: readonly RigaConsuntivo[];
      readonly giorni: readonly ChiaveGiorno[];
    }
  | Extract<EsitoModifica, { esito: 'bloccata' }>;

function blocca(motivo: MotivoBloccoModifica, giorno: ChiaveGiorno | null): EsitoInterno {
  return { esito: 'bloccata', motivo, giorno, codici: [] };
}

function conCella(riga: RigaConsuntivo, giorno: ChiaveGiorno, cella: CellaDoc): RigaConsuntivo {
  return { ...riga, giorni: impostaCella(riga.giorni, giorno, cella) };
}

function orarioReale(
  riga: RigaConsuntivo,
  giorno: ChiaveGiorno,
  orario: OrarioReale | null,
): EsitoInterno {
  const cella = riga.giorni[giorno];
  if (cella === undefined || cella.turno === null || !turnoSvolto(cella)) {
    return blocca('turnoNonSvolto', giorno);
  }
  const nuovo = orario !== null && orarioVariato(cella.turno, orario) ? { ...orario } : null;
  return {
    esito: 'applicata',
    righe: [conCella(riga, giorno, { ...cella, orarioReale: nuovo })],
    giorni: [giorno],
  };
}

function assenza(
  riga: RigaConsuntivo,
  giorni: readonly ChiaveGiorno[],
  valore: AssenzaInCella,
  chiaveMese: ChiaveMese,
): EsitoInterno {
  const elenco = [...new Set(giorni)].sort();
  if (elenco.length === 0) {
    return blocca('nessunGiorno', null);
  }
  let risultato = riga;
  for (const giorno of elenco) {
    const data = dataDelGiorno(chiaveMese, giorno);
    if (data === null) {
      return blocca('giornoInesistente', giorno);
    }
    const esito = applicaAssegnazione(
      risultato.giorni[giorno] ?? null,
      { tipo: 'assenza', assenza: valore },
      { turniEsclusi: [], inServizio: inServizioIl(riga.contratto, data) },
    );
    if (esito.esito === 'rifiutata') {
      return blocca(esito.motivo, giorno);
    }
    risultato = conCella(risultato, giorno, esito.cella);
  }
  return { esito: 'applicata', righe: [risultato], giorni: elenco };
}

function sostituzione(
  riga: RigaConsuntivo,
  modifica: Extract<ModificaConsuntivo, { tipo: 'sostituzione' | 'rimuoviSostituzione' }>,
  contesto: ContestoModifica,
): EsitoInterno {
  const { giorno, oggetto } = modifica;
  const collega = contesto.collega;
  if (collega === null || collega.dipendenteId !== modifica.sostitutoId) {
    return blocca('rigaCollegaMancante', giorno);
  }
  if (collega.dipendenteId === riga.dipendenteId) {
    return blocca('stessoDipendente', giorno);
  }
  if (modifica.tipo === 'sostituzione') {
    const cella = riga.giorni[giorno];
    const verifica = oggettoScoperto(cella, oggetto);
    const scoperto = scopertoDi(contesto.chiaveMese, giorno, cella, oggetto);
    if (verifica.esito === 'rifiutato' || scoperto === null) {
      return blocca(verifica.esito === 'rifiutato' ? verifica.motivo : 'nonScoperto', giorno);
    }
    const valutazione = valutaCandidato(contesto.chiaveMese, scoperto, {
      riga: collega,
      adiacenti: contesto.righeAdiacenti[collega.dipendenteId] ?? null,
      turniEsclusi: contesto.turniEsclusi[collega.dipendenteId] ?? [],
    });
    if (valutazione.esito === 'nonDisponibile') {
      return blocca(valutazione.motivo.codice, giorno);
    }
  }
  const esito =
    modifica.tipo === 'sostituzione'
      ? applicaSostituzione(riga, collega, giorno, oggetto)
      : rimuoviSostituzione(riga, collega, giorno, oggetto);
  if (esito.esito === 'rifiutata') {
    return blocca(esito.motivo, giorno);
  }
  return { esito: 'applicata', righe: [esito.assente, esito.sostituto], giorni: [giorno] };
}

function chiamate(
  riga: RigaConsuntivo,
  modifica: Extract<ModificaConsuntivo, { tipo: 'chiamate' }>,
  chiaveMese: ChiaveMese,
): EsitoInterno {
  const { giorno, codice } = modifica;
  const data = dataDelGiorno(chiaveMese, giorno);
  const cella = riga.giorni[giorno];
  const fascia = cella?.reperibilita.find((r) => r.codice === codice);
  if (data === null || cella === undefined || fascia === undefined) {
    return blocca(data === null ? 'giornoInesistente' : 'reperibilitaAssente', giorno);
  }
  if (modifica.chiamate.length > 0) {
    if (fascia.copertaDa !== null) {
      return blocca('reperibilitaCoperta', giorno);
    }
    if (cella.assenza?.effetto === 'neutra') {
      return blocca('reperibilitaScoperta', giorno);
    }
    if (modifica.chiamate.length > MAX_CHIAMATE_PER_REPERIBILITA) {
      return blocca('troppeChiamate', giorno);
    }
  }
  for (const chiamata of modifica.chiamate) {
    const esito = impostaChiamata(cella, data, codice, chiamata);
    if (esito.esito === 'rifiutata') {
      return blocca(esito.motivo, giorno);
    }
  }
  const nuova: CellaDoc = {
    ...cella,
    reperibilita: cella.reperibilita.map((r) =>
      r.codice === codice ? { ...r, chiamate: modifica.chiamate.map((c) => ({ ...c })) } : r,
    ),
  };
  return { esito: 'applicata', righe: [conCella(riga, giorno, nuova)], giorni: [giorno] };
}

function applica(
  riga: RigaConsuntivo,
  modifica: ModificaConsuntivo,
  contesto: ContestoModifica,
): EsitoInterno {
  switch (modifica.tipo) {
    case 'orarioReale':
      return dataDelGiorno(contesto.chiaveMese, modifica.giorno) === null
        ? blocca('giornoInesistente', modifica.giorno)
        : orarioReale(riga, modifica.giorno, modifica.orario);
    case 'assenza':
      return assenza(riga, modifica.giorni, modifica.assenza, contesto.chiaveMese);
    case 'sostituzione':
    case 'rimuoviSostituzione':
      return dataDelGiorno(contesto.chiaveMese, modifica.giorno) === null
        ? blocca('giornoInesistente', modifica.giorno)
        : sostituzione(riga, modifica, contesto);
    case 'chiamate':
      return chiamate(riga, modifica, contesto.chiaveMese);
  }
}

/**
 * Valida e applica una modifica di consuntivo. Ordine: mese convalidato (sempre blocco, D2) → controlli propri della
 * modifica → `validaRiga()` sui giorni toccati delle righe risultanti (un blocco lì ferma la modifica) → segnalazioni
 * delle righe risultanti con `avvisiRiga()` (riposo, scoperti, sovrapposizioni…: avvisi, non blocchi).
 */
export function validaModifica(
  riga: RigaConsuntivo,
  modifica: ModificaConsuntivo,
  contesto: ContestoModifica,
): EsitoModifica {
  if (contesto.statoMese === 'convalidato') {
    return { esito: 'bloccata', motivo: 'meseConvalidato', giorno: null, codici: [] };
  }
  const esito = applica(riga, modifica, contesto);
  if (esito.esito === 'bloccata') {
    return esito;
  }
  for (const risultante of esito.righe) {
    const blocchi = soloBlocchi(validaRiga(risultante, { chiaveMese: contesto.chiaveMese })).filter(
      (problema) => esito.giorni.some((giorno) => giorno === problema.chiaveGiorno),
    );
    const primo = blocchi[0];
    if (primo !== undefined) {
      const giorno = esito.giorni.find((g) => g === primo.chiaveGiorno) ?? null;
      return {
        esito: 'bloccata',
        motivo: 'rigaNonValida',
        giorno,
        codici: [...new Set(blocchi.map((problema) => problema.codice))].sort(),
      };
    }
  }
  return {
    esito: 'consentita',
    righe: esito.righe,
    avvisi: esito.righe.map((risultante) => {
      const adiacenti = contesto.righeAdiacenti[risultante.dipendenteId];
      return {
        dipendenteId: risultante.dipendenteId,
        segnalazioni: avvisiRiga(risultante, {
          chiaveMese: contesto.chiaveMese,
          turniEsclusi: contesto.turniEsclusi[risultante.dipendenteId] ?? [],
          righeAdiacenti: {
            precedente: adiacenti?.precedente ?? null,
            successiva: adiacenti?.successiva ?? null,
          },
        }),
      };
    }),
  };
}
