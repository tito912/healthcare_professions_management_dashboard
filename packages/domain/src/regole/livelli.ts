// Tipi dei risultati delle regole (U5, UX §9.6). Le regole restituiscono dati, mai testi: il browser compone
// le frasi («Riposo di 9 ore tra il 4 e il 5») dai campi. Tre livelli (`Livello` in tipi/):
//   blocco: dati non validi, la riga non si salva e il mese non si convalida;
//   avviso: si salva lo stesso (riposo, reperibilità, turno escluso, fuori servizio, scoperto);
//   nota: informazioni (celle saltate da pennello o incolla, allineamenti proposti).
import type { CodiceAssenza, CodiceTurno, DataISO, Livello, Minuti } from '../tipi';

/** Perché un'assegnazione non si applica a una cella (inserimento veloce, pennello, incolla, menu). */
export type MotivoRifiuto =
  | 'vuoto' // testo vuoto
  | 'codiceInesistente' // nessun turno, fascia o assenza con quel codice
  | 'codiceDisattivato' // il codice esiste ma è disattivato
  | 'turnoEscluso' // turno o fascia tra gli esclusi del dipendente
  | 'massimoReperibilita' // la cella ha già 2 reperibilità
  | 'reperibilitaGiaPresente' // la stessa fascia è già nella cella
  | 'fuoriServizio' // giorno prima dell'assunzione o dopo la cessazione
  | 'consuntivo' // la cella ha orari reali, sostituzioni, coperture o chiamate: si modifica dal dettaglio
  | 'testoNonValido'; // testo incollato con due turni o due assenze nella stessa cella

/** Problemi trovati da `validaRiga()` e `validaMese()` (ARCHITETTURA §5.9). */
export type CodiceProblemaRiga =
  // blocchi di validaRiga
  | 'contrattoNonValido'
  | 'giorniNonValidi'
  | 'giornoInesistente'
  | 'cellaMalformata'
  | 'notturnoIncoerente'
  | 'assenzaComeRiposoSuTurno'
  | 'troppeReperibilita'
  | 'reperibilitaRipetuta'
  | 'troppeChiamate'
  | 'durataChiamataNonValida'
  | 'oraChiamataFuoriFascia'
  | 'orarioRealeSenzaTurnoSvolto'
  | 'riferimentoASeStesso'
  | 'copertoDaSenzaTurnoScoperto'
  | 'sostituisceSenzaTurnoSvolto'
  // avviso di validaRiga
  | 'fuoriServizio'
  // blocchi di validaMese
  | 'sostituzioneSenzaRiga'
  | 'sostituzioneNonReciproca';

/** Un problema di una riga: il giorno è la chiave della mappa `giorni` (può non esistere nel mese). */
export interface ProblemaRiga {
  readonly livello: 'blocco' | 'avviso';
  readonly codice: CodiceProblemaRiga;
  readonly dipendenteId: string;
  readonly chiaveGiorno: string | null;
}

/** Riposo sotto le 11 ore tra la fine di un periodo di lavoro (`giornoPrecedente`) e il turno di `giorno`. */
export interface AvvisoRiposo {
  readonly livello: 'avviso';
  readonly codice: 'riposoInsufficiente';
  readonly giorno: DataISO;
  readonly giornoPrecedente: DataISO;
  /** Minuti reali di riposo (zero se i periodi si sovrappongono). */
  readonly minutiRiposo: Minuti;
  /** Che cosa ha chiuso il periodo di lavoro precedente: un turno o una chiamata con ora di inizio (D8). */
  readonly origine: 'turno' | 'chiamata';
}

/** Reperibilità del mese oltre `MAX_UNITA_REPERIBILITA_MESE` unità. */
export interface AvvisoReperibilitaOltreLimite {
  readonly livello: 'avviso';
  readonly codice: 'reperibilitaOltreLimite';
  readonly giorno: null;
  readonly minutiReperibilita: Minuti;
  /** minutiReperibilita / 720: un numero con decimali, solo per lo schermo («7,5 su 7»). */
  readonly unita: number;
  readonly limiteUnita: number;
}

/** Reperibilità che si sovrappone a un turno principale svolto (stesso giorno o adiacente). */
export interface AvvisoReperibilitaSovrapposta {
  readonly livello: 'avviso';
  readonly codice: 'reperibilitaSovrapposta';
  readonly giorno: DataISO;
  readonly codiceReperibilita: CodiceTurno;
  readonly codiceTurno: CodiceTurno;
  readonly giornoTurno: DataISO;
}

/** Turno o fascia assegnati che oggi sono tra gli esclusi del dipendente. */
export interface AvvisoTurnoEsclusoAssegnato {
  readonly livello: 'avviso';
  readonly codice: 'turnoEsclusoAssegnato';
  readonly giorno: DataISO;
  readonly codiceTurno: CodiceTurno;
}

/** Turno principale con un'assenza neutra e senza sostituto. */
export interface AvvisoTurnoScoperto {
  readonly livello: 'avviso';
  readonly codice: 'turnoScoperto';
  readonly giorno: DataISO;
  readonly codiceTurno: CodiceTurno;
  readonly codiceAssenza: CodiceAssenza | null;
}

/** Reperibilità in un giorno di assenza neutra, senza un collega che la copra. */
export interface AvvisoReperibilitaScoperta {
  readonly livello: 'avviso';
  readonly codice: 'reperibilitaScoperta';
  readonly giorno: DataISO;
  readonly codiceReperibilita: CodiceTurno;
  readonly codiceAssenza: CodiceAssenza | null;
}

/** Un problema di `validaRiga()` nel pannello: `giorno` è null se la chiave non esiste nel mese. */
export interface SegnalazioneRiga {
  readonly livello: 'blocco' | 'avviso';
  readonly codice: CodiceProblemaRiga;
  readonly giorno: DataISO | null;
  readonly chiaveGiorno: string | null;
}

/** Cella saltata da pennello o incolla, con il motivo (nota). */
export interface NotaCellaSaltata {
  readonly livello: 'nota';
  readonly codice: 'cellaSaltata';
  readonly giorno: DataISO;
  readonly dipendenteId: string;
  readonly motivo: MotivoRifiuto;
  readonly codiceInserito: string | null;
}

export type Segnalazione =
  | AvvisoRiposo
  | AvvisoReperibilitaOltreLimite
  | AvvisoReperibilitaSovrapposta
  | AvvisoTurnoEsclusoAssegnato
  | AvvisoTurnoScoperto
  | AvvisoReperibilitaScoperta
  | SegnalazioneRiga
  | NotaCellaSaltata;

/** Vero per blocchi e avvisi: quelli che entrano nel conteggio del pulsante «Avvisi» e del riepilogo. */
export function contaComeAvviso(segnalazione: { readonly livello: Livello }): boolean {
  return segnalazione.livello !== 'nota';
}
