// validaRiga (ARCHITETTURA §5.9): i controlli che servono solo la riga e il mese, così li usano il browser
// prima di salvare, il trigger dei riepiloghi e convalidaMese. Restituisce codici, mai testi.
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import { inServizioIl } from '../calendario/servizio';
import { schemaCella, schemaContrattoRiga } from '../contratti/righe';
import type { CellaDoc, ContrattoRiga } from '../documenti';
import { MAX_CHIAMATE_PER_REPERIBILITA, MAX_REPERIBILITA_GIORNO } from '../impostazioni';
import type { CodiceProblemaRiga, ProblemaRiga } from '../regole/livelli';
import type { ChiaveMese, DataISO, OraLocale } from '../tipi';
import { durataReale } from '../turni/durata';
import { eNotturno } from '../turni/notturno';
import { eCellaVuota } from './cella';

/** Una riga come arriva da Firestore o dal browser: celle e contratto si verificano qui, campo per campo. */
export interface RigaDaValidare {
  readonly dipendenteId: string;
  readonly contratto: unknown;
  readonly giorni: Readonly<Record<string, unknown>>;
}

export interface ContestoValidaRiga {
  readonly chiaveMese: ChiaveMese;
}

/** La cella se ha la forma di `CellaDoc` (tutti i campi, nessuno in più, valori validi), altrimenti null. */
export function cellaValida(valore: unknown): CellaDoc | null {
  const esito = schemaCella.safeParse(valore);
  return esito.success ? esito.data : null;
}

/** Il contratto se è valido (ore 1-48 a passi di 0,5, date esistenti, assunzione non dopo la cessazione). */
export function contrattoValido(valore: unknown): ContrattoRiga | null {
  const esito = schemaContrattoRiga.safeParse(valore);
  return esito.success ? esito.data : null;
}

/** L'ora cade nella fascia: inizio compreso, fine esclusa; le fasce che attraversano la mezzanotte valgono anche dopo. */
function nellaFascia(ora: OraLocale, inizio: OraLocale, fine: OraLocale): boolean {
  return inizio < fine ? inizio <= ora && ora < fine : ora >= inizio || ora < fine;
}

/** I problemi di significato di una cella valida nella forma. */
function problemiCella(cella: CellaDoc, data: DataISO, dipendenteId: string): CodiceProblemaRiga[] {
  const codici = new Set<CodiceProblemaRiga>();
  const turnoSvolto = cella.turno !== null && cella.assenza === null;
  const turnoScoperto = cella.turno !== null && cella.assenza !== null;
  if (
    cella.turno !== null &&
    cella.turno.notturno !== eNotturno(cella.turno.inizio, cella.turno.fine)
  ) {
    codici.add('notturnoIncoerente');
  }
  if (cella.turno !== null && cella.assenza?.effetto === 'comeRiposo') {
    codici.add('assenzaComeRiposoSuTurno');
  }
  if (cella.reperibilita.length > MAX_REPERIBILITA_GIORNO) {
    codici.add('troppeReperibilita');
  }
  if (new Set(cella.reperibilita.map((r) => r.codice)).size !== cella.reperibilita.length) {
    codici.add('reperibilitaRipetuta');
  }
  for (const reperibilita of cella.reperibilita) {
    if (reperibilita.chiamate.length > MAX_CHIAMATE_PER_REPERIBILITA) {
      codici.add('troppeChiamate');
    }
    const durataFascia = durataReale(data, reperibilita.inizio, reperibilita.fine);
    for (const chiamata of reperibilita.chiamate) {
      if (chiamata.durataMinuti > durataFascia) {
        codici.add('durataChiamataNonValida');
      }
      if (
        chiamata.oraInizio !== null &&
        !nellaFascia(chiamata.oraInizio, reperibilita.inizio, reperibilita.fine)
      ) {
        codici.add('oraChiamataFuoriFascia');
      }
    }
  }
  if (cella.orarioReale !== null && !turnoSvolto) {
    codici.add('orarioRealeSenzaTurnoSvolto');
  }
  const riferimenti = [
    cella.sostituisce,
    cella.copertoDa,
    ...cella.reperibilita.flatMap((r) => [r.sostituisce, r.copertaDa]),
  ];
  if (riferimenti.includes(dipendenteId)) {
    codici.add('riferimentoASeStesso');
  }
  if (cella.copertoDa !== null && !turnoScoperto) {
    codici.add('copertoDaSenzaTurnoScoperto');
  }
  if (cella.sostituisce !== null && !turnoSvolto) {
    codici.add('sostituisceSenzaTurnoSvolto');
  }
  return [...codici];
}

/**
 * Controlli della riga:
 * - contratto valido (blocco `contrattoNonValido`);
 * - ogni chiave di `giorni` è un giorno del mese (`giornoInesistente`) e ogni cella ha la forma di `CellaDoc`
 *   (`cellaMalformata`): codici, orari, tipi, pausa 0-240, chiamate di 1-1440 minuti;
 * - un solo turno al giorno (garantito dalla forma) e turno con assenza solo come turno scoperto, cioè con
 *   un'assenza neutra; notturno coerente con gli orari (L8);
 * - al massimo 2 reperibilità senza codici ripetuti; chiamate entro `MAX_CHIAMATE_PER_REPERIBILITA`, con durata
 *   fino alla durata reale della fascia e ora di inizio dentro la fascia (L21, L38);
 * - orario reale solo su un turno svolto; `sostituisce` solo su un turno svolto, `copertoDa` solo su un turno
 *   scoperto; nessun riferimento al dipendente stesso;
 * - contenuto in un giorno fuori servizio: avviso `fuoriServizio`, non blocco (può essere rimasto da prima di un
 *   cambio di date; il browser impedisce di aggiungerne di nuovo con `applicaAssegnazione()`).
 * I giorni sono in ordine di chiave; il contratto, se non è valido, viene per primo.
 */
export function validaRiga(riga: RigaDaValidare, contesto: ContestoValidaRiga): ProblemaRiga[] {
  const problemi: ProblemaRiga[] = [];
  const aggiungi = (
    livello: ProblemaRiga['livello'],
    codice: CodiceProblemaRiga,
    chiaveGiorno: string | null,
  ): void => {
    problemi.push({ livello, codice, dipendenteId: riga.dipendenteId, chiaveGiorno });
  };
  const contratto = contrattoValido(riga.contratto);
  if (contratto === null) {
    aggiungi('blocco', 'contrattoNonValido', null);
  }
  for (const chiave of Object.keys(riga.giorni).sort()) {
    const data = eChiaveGiorno(chiave) ? dataDelGiorno(contesto.chiaveMese, chiave) : null;
    if (data === null) {
      aggiungi('blocco', 'giornoInesistente', chiave);
      continue;
    }
    const cella = cellaValida(riga.giorni[chiave]);
    if (cella === null) {
      aggiungi('blocco', 'cellaMalformata', chiave);
      continue;
    }
    for (const codice of problemiCella(cella, data, riga.dipendenteId)) {
      aggiungi('blocco', codice, chiave);
    }
    if (contratto !== null && !eCellaVuota(cella) && !inServizioIl(contratto, data)) {
      aggiungi('avviso', 'fuoriServizio', chiave);
    }
  }
  return problemi;
}

/** Solo i blocchi: se ce n'è almeno uno la riga non si salva e il mese non si convalida. */
export function soloBlocchi<T extends { readonly livello: string }>(problemi: readonly T[]): T[] {
  return problemi.filter((p) => p.livello === 'blocco');
}
