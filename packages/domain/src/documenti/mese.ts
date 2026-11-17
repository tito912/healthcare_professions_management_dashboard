import type {
  ChiaveGiorno,
  ChiaveMese,
  CodiceAssenza,
  CodiceTurno,
  DataISO,
  Istante,
  OraLocale,
} from '../tipi';

/** reparti/{repartoId}/mesi/{chiaveMese}; ID = 'AAAA-MM' (ARCHITETTURA §5.8). */
export interface MeseDoc {
  chiave: ChiaveMese; // = ID documento
  anno: number;
  mese: number; // 1-12
  stato: 'bozza' | 'convalidato'; // il browser crea solo 'bozza'; 'convalidato' solo da convalidaMese; riapertura da console (D18)
  calendario: CalendarioMese; // copia della configurazione al momento della creazione (o dell'allineamento in bozza)
  creatoIl: Istante;
  creatoDa: string;
  aggiornatoIl: Istante;
  aggiornatoDa: string;
  convalidatoIl: Istante | null;
  convalidatoDa: string | null; // uid
  convalidatoDaNome: string | null; // «Nome Cognome» del coordinatore, per la fascia «Convalidato il … da …»
}

export interface CalendarioMese {
  festivita: Partial<Record<ChiaveGiorno, { id: string; nome: string }>>; // id = IdFestivitaNazionale o id locale
  attribuzioneNotte: 'inizio' | 'fine';
}

/** reparti/{repartoId}/mesi/{chiaveMese}/righe/{dipendenteId}: una riga per dipendente (ARCHITETTURA §5.9). */
export interface RigaDoc {
  dipendenteId: string; // = ID documento
  contratto: ContrattoRiga; // copia dal dipendente, per ore dovute e giorni di servizio di questo mese
  giorni: Partial<Record<ChiaveGiorno, CellaDoc>>; // solo i giorni con contenuto; giorno assente = cella vuota
  versione: number; // concorrenza ottimistica: 1 alla creazione, +1 a ogni scrittura (regole)
  aggiornatoDa: string; // = request.auth.uid
  aggiornatoIl: Istante; // = request.time
}

export interface ContrattoRiga {
  oreSettimanali: number;
  dataAssunzione: DataISO | null;
  dataCessazione: DataISO | null;
}

export interface CellaDoc {
  turno: TurnoInCella | null; // turno principale pianificato (copia)
  assenza: AssenzaInCella | null; // con turno != null: il turno è «scoperto» finché copertoDa è null
  reperibilita: ReperibilitaInCella[]; // 0-2 (blocco oltre 2)
  orarioReale: OrarioReale | null; // solo con turno != null e assenza == null
  sostituisce: string | null; // su questo turno: dipendenteId del collega di cui si copre il turno principale
  copertoDa: string | null; // sul turno scoperto: dipendenteId del sostituto
}

export interface TurnoInCella {
  codice: CodiceTurno;
  inizio: OraLocale;
  fine: OraLocale;
  pausaMinuti: number;
  notturno: boolean;
}

export interface AssenzaInCella {
  codice: CodiceAssenza;
  effetto: 'comeRiposo' | 'neutra';
  malattia: boolean;
}

export interface ReperibilitaInCella {
  codice: CodiceTurno;
  inizio: OraLocale;
  fine: OraLocale;
  chiamate: Chiamata[]; // 0..MAX_CHIAMATE_PER_REPERIBILITA (1, L21)
  sostituisce: string | null;
  copertaDa: string | null;
}

export interface Chiamata {
  durataMinuti: number; // intero 1-1440, non oltre la durata della reperibilità
  oraInizio: OraLocale | null; // se presente, le 11 ore ripartono dalla fine dell'intervento (D8)
}

export interface OrarioReale {
  inizio: OraLocale; // stessa regola del turno: fine <= inizio = giorno dopo
  fine: OraLocale;
}
