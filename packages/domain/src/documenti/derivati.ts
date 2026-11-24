// Documenti derivati, scritti solo dalle Functions (ARCHITETTURA §5.10-§5.12).
import type { ChiaveGiorno, ChiaveMese, CodiceTurno, IdBimestre, Istante, Minuti } from '../tipi';

/** reparti/{repartoId}/riepiloghi/{chiaveMese}_{dipendenteId} (ARCHITETTURA §5.10). */
export interface RiepilogoMensileDoc {
  dipendenteId: string;
  chiaveMese: ChiaveMese;
  anno: number;
  statoMese: 'bozza' | 'convalidato';
  valida: boolean; // false se validaRiga() fallisce; validaMese() la verifica solo convalidaMese
  erroriValidazione: string[]; // codici d'errore del dominio, mai testi con dati personali
  // conteggi a consuntivo (turni svolti: esclusi i turni scoperti, comprese le sostituzioni fatte)
  turniSvolti: number;
  notti: number;
  sabati: number;
  domenicheEFestivi: number; // i festivi contano come domeniche; ogni turno in una sola categoria (L11)
  conteggiPerCodice: Record<string, number>; // turni principali e reperibilità svolti, per codice
  reperibilitaSvolte: number;
  minutiReperibilita: Minuti; // unità da 12 ore = minutiReperibilita / 720
  chiamate: number;
  minutiChiamate: Minuti;
  // ore (D4)
  minutiPianificati: Minuti;
  minutiLavorati: Minuti; // orari reali dove presenti; nei mesi in bozza include il pianificato
  minutiDovuti: Minuti;
  saldoMinuti: Minuti; // minutiLavorati - minutiDovuti
  variazioni: number; // celle con orario reale diverso dal previsto
  minutiVariazioni: Minuti; // somma algebrica delle differenze
  assenzePerCodice: Record<string, number>; // giorni per codice di assenza
  // festività
  festivitaIds: string[]; // per la query array-contains dello storico
  festivitaLavorate: { idFestivita: string; giorno: ChiaveGiorno; codice: CodiceTurno }[];
  // avvisi
  numeroAvvisi: number; // livello 'avviso' e 'blocco' calcolabili dal trigger; le note non contano
  calcolatoIl: Istante;
  versioneCalcolo: number; // costante VERSIONE_CALCOLO del dominio
}

type ChiaveMeseAnno =
  '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';

/** reparti/{repartoId}/bancaOre/{anno}_{dipendenteId} (ARCHITETTURA §5.11). */
export interface BancaOreDoc {
  dipendenteId: string;
  anno: number;
  riportoMinuti: Minuti; // saldoAnnoMinuti dell'anno precedente; 0 se non esiste (L13)
  mesi: Partial<Record<ChiaveMeseAnno, MeseBancaOre>>;
  saldoAnnoMinuti: Minuti; // riporto + somma dei saldi di tutti i mesi presenti
  saldoDefinitivoMinuti: Minuti; // riporto + somma dei soli mesi definitivi
  provvisorio: boolean; // true se almeno un mese è in bozza o il riporto è provvisorio
  calcolatoIl: Istante;
}

export interface MeseBancaOre {
  minutiLavorati: Minuti;
  minutiDovuti: Minuti;
  saldoMinuti: Minuti;
  definitivo: boolean; // true se il mese è convalidato
}

/** reparti/{repartoId}/report/{idBimestre} (ARCHITETTURA §5.12). */
export interface ReportDoc {
  idBimestre: IdBimestre;
  anno: number;
  bimestre: 1 | 2 | 3 | 4 | 5 | 6;
  mesi: [ChiaveMese, ChiaveMese];
  mesiInclusi: ChiaveMese[]; // solo i mesi convalidati
  righe: Record<string, ConteggiReport>; // chiave = dipendenteId
  totali: ConteggiReport;
  generatoIl: Istante;
  generatoDa: string; // uid, oppure 'sistema'
  file: { percorso: string; generatoIl: Istante } | null; // in Cloud Storage, eliminato dopo CONSERVAZIONE_FILE_REPORT_GIORNI (L16)
  invii: Record<string, EsitoInvio>; // chiave = dipendenteId
  invioAutomaticoIl: Istante | null; // impostato in transazione prima di accodare: rende idempotente reportBimestrale
}

export interface ConteggiReport {
  turniSvolti: number;
  notti: number;
  sabati: number;
  domenicheEFestivi: number;
  reperibilitaSvolte: number;
  chiamate: number;
  minutiChiamate: Minuti;
  // ore del bimestre (L44): somma dei riepiloghi dei mesi inclusi
  minutiDovuti: Minuti;
  minutiLavorati: Minuti;
  saldoMinuti: Minuti; // minutiLavorati - minutiDovuti, può essere negativo
}

export interface EsitoInvio {
  esito: 'accodato' | 'senzaEmail' | 'errore';
  il: Istante;
  mailId: string | null;
  mesiInclusi: ChiaveMese[]; // i mesi che comprendeva l'invio: un invio con un solo mese non chiude il bimestre
}
