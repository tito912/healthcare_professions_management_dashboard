// Dati dimostrativi per provare l'app a mano (step 4.3). Gira SOLO sugli emulatori: non esiste un'opzione per
// un progetto reale, gli host sono forzati su 127.0.0.1 con le porte di firebase.json e il progetto è demo-turni.
//
//   npm run emulators            (in un terminale, lasciarlo acceso)
//   npm run seed-demo -- --emulatore          (in un altro terminale)
//   npm run seed-demo -- --emulatore --svuota (cancella prima i dati degli emulatori e ricrea tutto)
//
// Crea: un ADMIN; due coordinatori; due reparti con turni M1, P1, N1, G1 e reperibilità R1, R2; 12 dipendenti
// per reparto con nomi di fantasia e codici fiscali formalmente validi ma inventati; tre mesi per reparto (il
// mese corrente in bozza, i due precedenti convalidati) con riposi, malattie, sostituzioni, scoperti e variazioni.
// Utenti, dipendenti e convalida passano dalle Functions vere (callable, chiamate come farebbe il browser con il
// token dell'utente); reparti, turni, assenze, mesi e righe si scrivono con l'Admin SDK dopo i controlli del
// dominio (`validaRiga`, `validaMese`). Riepiloghi e banca ore li calcolano i trigger.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  calendarioMese,
  chiaveGiornoDi,
  chiaveMese,
  codiceAssenza,
  codiceTurno,
  dataISO,
  eCodiceFiscaleValido,
  eNotturno,
  giorniDelMese,
  meseCorrente,
  oraLocale,
  REGIONE_FUNZIONI,
  spostaMese,
  validaMese,
  validaRiga,
  type CellaDoc,
  type ChiaveGiorno,
  type ChiaveMese,
  type DataISO,
  type IdColoreTurno,
  type TurnoInCella,
  type ReperibilitaInCella,
  type AssenzaInCella,
  type RigaDoc,
  type ContrattoRiga,
  type RepartoDoc,
  type MeseDoc,
  type TurnoDoc,
  type TipologiaAssenzaDoc,
  type ProblemaRiga,
} from '@turni/domain';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { InScrittura } from '../functions/src/comune/admin';
import { creaOPromuoviAdmin } from './crea-primo-admin';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Il solo progetto che il seed accetta: è quello degli emulatori (firebase.json, npm run emulators). */
const PROGETTO = 'demo-turni';
/** Password dei soli utenti dimostrativi, validata dall'emulatore; non è un segreto. Non funziona fuori dagli emulatori. */
const PASSWORD_DEMO = 'Password-demo-1';
/** Chiave API fittizia che l'emulatore di Auth accetta. */
const CHIAVE_API_EMULATORE = 'demo-api-key';

/** Errore d'uso o di stato degli emulatori: messaggio per chi lancia lo script, nessuna modifica fatta. */
class ErroreSeed extends Error {}

const USO = `Uso:
  npm run seed-demo -- --emulatore            dati dimostrativi sugli emulatori già avviati
  npm run seed-demo -- --emulatore --svuota   svuota prima gli emulatori (Auth e Firestore) e ricrea i dati

Il seed non ha un'opzione per progetti reali: gira solo con --emulatore.`;

// ---------------------------------------------------------------------------------------------
// Ambiente: solo gli emulatori
// ---------------------------------------------------------------------------------------------

interface PorteEmulatori {
  readonly auth: number;
  readonly firestore: number;
  readonly functions: number;
}

function porteEmulatori(): PorteEmulatori {
  const configurazione: {
    emulators: {
      auth: { port: number };
      firestore: { port: number };
      functions: { port: number };
    };
  } = JSON.parse(readFileSync(path.join(radice, 'firebase.json'), 'utf8'));
  return {
    auth: configurazione.emulators.auth.port,
    firestore: configurazione.emulators.firestore.port,
    functions: configurazione.emulators.functions.port,
  };
}

/** Forza gli host locali: qualunque valore già presente nel processo viene sostituito. */
function preparaEmulatori(): PorteEmulatori {
  const porte = porteEmulatori();
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = `127.0.0.1:${porte.auth}`;
  process.env['FIRESTORE_EMULATOR_HOST'] = `127.0.0.1:${porte.firestore}`;
  process.env['GCLOUD_PROJECT'] = PROGETTO;
  process.env['METADATA_SERVER_DETECTION'] = 'none';
  // Nessuna credenziale di Google nel processo: anche per errore non si può raggiungere un progetto reale.
  delete process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  return porte;
}

async function verificaEmulatoriAttivi(porte: PorteEmulatori): Promise<void> {
  const servizi: readonly [string, number][] = [
    ['Auth', porte.auth],
    ['Firestore', porte.firestore],
    ['Functions', porte.functions],
  ];
  for (const [nome, porta] of servizi) {
    try {
      await fetch(`http://127.0.0.1:${porta}/`);
    } catch {
      throw new ErroreSeed(
        `L'emulatore ${nome} (porta ${porta}) non risponde: avviare prima «npm run emulators» (o «npm run dev»).`,
      );
    }
  }
}

async function svuotaEmulatori(porte: PorteEmulatori): Promise<void> {
  const risposte = await Promise.all([
    fetch(`http://127.0.0.1:${porte.auth}/emulator/v1/projects/${PROGETTO}/accounts`, {
      method: 'DELETE',
    }),
    fetch(
      `http://127.0.0.1:${porte.firestore}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`,
      { method: 'DELETE' },
    ),
  ]);
  if (risposte.some((risposta) => !risposta.ok)) {
    throw new ErroreSeed('Svuotamento degli emulatori non riuscito.');
  }
}

// ---------------------------------------------------------------------------------------------
// Chiamate alle Functions e ai token dell'emulatore (come fa il browser)
// ---------------------------------------------------------------------------------------------

/** Legge una proprietà di un valore JSON senza asserzioni: undefined se manca o non è un oggetto. */
function campo(valore: unknown, nome: string): unknown {
  return typeof valore === 'object' && valore !== null ? Reflect.get(valore, nome) : undefined;
}

async function accedi(porte: PorteEmulatori, email: string): Promise<string> {
  const risposta = await fetch(
    `http://127.0.0.1:${porte.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${CHIAVE_API_EMULATORE}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD_DEMO, returnSecureToken: true }),
    },
  );
  const corpo: unknown = await risposta.json();
  const idToken = campo(corpo, 'idToken');
  if (!risposta.ok || typeof idToken !== 'string') {
    throw new ErroreSeed(`Accesso di prova non riuscito per ${email}.`);
  }
  return idToken;
}

async function chiamaFunzione(
  porte: PorteEmulatori,
  nome: string,
  idToken: string,
  dati: unknown,
): Promise<unknown> {
  const risposta = await fetch(
    `http://127.0.0.1:${porte.functions}/${PROGETTO}/${REGIONE_FUNZIONI}/${nome}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ data: dati }),
    },
  );
  const corpo: unknown = await risposta.json();
  if (!risposta.ok) {
    // Solo il messaggio dell'errore (in italiano, senza dati personali), mai il contenuto inviato.
    const messaggio = campo(campo(corpo, 'error'), 'message');
    throw new ErroreSeed(
      `${nome} non riuscita: ${typeof messaggio === 'string' ? messaggio : 'errore sconosciuto'}.`,
    );
  }
  return campo(corpo, 'result');
}

function uidDi(risultato: unknown, nome: string): string {
  const uid = campo(risultato, 'uid');
  if (typeof uid !== 'string') {
    throw new ErroreSeed(`${nome}: risposta senza uid.`);
  }
  return uid;
}

function dipendenteIdDi(risultato: unknown): string {
  const id = campo(risultato, 'dipendenteId');
  if (typeof id !== 'string') {
    throw new ErroreSeed('salvaDipendente: risposta senza dipendenteId.');
  }
  return id;
}

// ---------------------------------------------------------------------------------------------
// Dati inventati
// ---------------------------------------------------------------------------------------------

const EMAIL_ADMIN = 'admin.demo@prova.example';
const COORDINATORI = [
  { email: 'coord.medicina@prova.example', nome: 'Marta', cognome: 'Rossi' },
  { email: 'coord.chirurgia@prova.example', nome: 'Luca', cognome: 'Neri' },
] as const;

const NOMI = [
  'Giulia', 'Marco', 'Chiara', 'Luca', 'Sara', 'Andrea',
  'Elena', 'Matteo', 'Francesca', 'Davide', 'Valentina', 'Simone',
] as const; // prettier-ignore
const COGNOMI_MEDICINA = [
  'Bellini', 'Ferraro', 'Marchetti', 'Galli', 'Rinaldi', 'Sartori',
  'Conti', 'Lombardi', 'Morelli', 'Fontana', 'Greco', 'Benedetti',
] as const; // prettier-ignore
const COGNOMI_CHIRURGIA = [
  'Vitale', 'Caruso', 'Ferri', 'Riva', 'Silvestri', 'Testa',
  'Farina', 'Pellegrini', 'Orlando', 'Monti', 'Serra', 'Leone',
] as const; // prettier-ignore
const ORE_SETTIMANALI = [36, 36, 30, 36, 24, 36, 36, 30, 36, 36, 20, 36] as const;

/** Lettere dei mesi nel codice fiscale, da gennaio a dicembre. */
const LETTERE_MESE_CF = 'ABCDEHLMPRST';
const LETTERE_MAIUSCOLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface DefinizioneTurno {
  readonly codice: string;
  readonly tipo: 'turno' | 'reperibilita';
  readonly nome: string;
  readonly colore: IdColoreTurno | null;
  readonly inizio: string;
  readonly fine: string;
  readonly pausaMinuti: number;
}

/** Turni del reparto (U11, UX §5.1) e le due fasce di reperibilità. */
const DEFINIZIONI_TURNI: readonly DefinizioneTurno[] = [
  { codice: 'M1', tipo: 'turno', nome: 'Mattina', colore: 'arancio', inizio: '07:00', fine: '14:00', pausaMinuti: 30 },
  { codice: 'P1', tipo: 'turno', nome: 'Pomeriggio', colore: 'verde', inizio: '14:00', fine: '22:00', pausaMinuti: 30 },
  { codice: 'N1', tipo: 'turno', nome: 'Notte', colore: 'ardesia', inizio: '22:00', fine: '07:00', pausaMinuti: 0 },
  { codice: 'G1', tipo: 'turno', nome: 'Giornata', colore: 'azzurro', inizio: '08:00', fine: '16:00', pausaMinuti: 30 },
  { codice: 'R1', tipo: 'reperibilita', nome: 'Reperibilità diurna', colore: null, inizio: '08:00', fine: '20:00', pausaMinuti: 0 },
  { codice: 'R2', tipo: 'reperibilita', nome: 'Reperibilità notturna', colore: null, inizio: '20:00', fine: '08:00', pausaMinuti: 0 },
]; // prettier-ignore

/** Riposo (R) e le assenze: R e MA sono predefinite e non eliminabili (ARCHITETTURA §5.4). */
interface DefinizioneAssenza {
  readonly codice: string;
  readonly descrizione: string;
  readonly effetto: 'comeRiposo' | 'neutra';
  readonly malattia: boolean;
  readonly predefinita: boolean;
  readonly ordine: number;
}

const ASSENZE_DEMO: readonly DefinizioneAssenza[] = [
  { codice: 'R', descrizione: 'Riposo', effetto: 'comeRiposo', malattia: false, predefinita: true, ordine: 1 },
  { codice: 'MA', descrizione: 'Malattia', effetto: 'neutra', malattia: true, predefinita: true, ordine: 2 },
  { codice: 'F', descrizione: 'Ferie', effetto: 'neutra', malattia: false, predefinita: false, ordine: 3 },
]; // prettier-ignore

/** Nessuna festività locale né nazionale esclusa: il calendario di prova segue quello predefinito. */
const FESTIVITA_DEMO: RepartoDoc['festivita'] = { nazionaliEscluse: [], locali: [] };

/** Cicli di turni di 10 giorni: si ripetono sfalsati per dipendente, con riposi tra un turno e l'altro. */
const CICLO_MISTO = ['N1', 'N1', 'R', 'M1', 'M1', 'R', 'P1', 'P1', 'R', 'R'] as const;
const CICLO_DIURNO = ['G1', 'G1', 'R', 'M1', 'M1', 'R', 'P1', 'P1', 'R', 'R'] as const;

// ---------------------------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------------------------

/** Elemento di una lista che deve esistere (con noUncheckedIndexedAccess l'indice dà undefined). */
function elemento<T>(lista: readonly T[], indice: number): T {
  const valore = lista[indice];
  if (valore === undefined) {
    throw new ErroreSeed(`Indice fuori dalla lista: ${indice}.`);
  }
  return valore;
}

function definizioneTurno(codice: string): DefinizioneTurno {
  const trovata = DEFINIZIONI_TURNI.find((d) => d.codice === codice);
  if (trovata === undefined) {
    throw new ErroreSeed(`Turno sconosciuto: ${codice}.`);
  }
  return trovata;
}

function turnoInCella(codice: string): TurnoInCella {
  const def = definizioneTurno(codice);
  const inizio = oraLocale(def.inizio);
  const fine = oraLocale(def.fine);
  return {
    codice: codiceTurno(def.codice),
    inizio,
    fine,
    pausaMinuti: def.pausaMinuti,
    notturno: eNotturno(inizio, fine),
  };
}

const CELLA_VUOTA: CellaDoc = {
  turno: null,
  assenza: null,
  reperibilita: [],
  orarioReale: null,
  sostituisce: null,
  copertoDa: null,
};

function cella(parziale: Partial<CellaDoc>): CellaDoc {
  return { ...CELLA_VUOTA, ...parziale };
}

function assenzaRiposo(): AssenzaInCella {
  return { codice: codiceAssenza('R'), effetto: 'comeRiposo', malattia: false };
}

function assenzaNeutra(codice: 'MA' | 'F'): AssenzaInCella {
  return {
    codice: codiceAssenza(codice),
    effetto: 'neutra',
    malattia: codice === 'MA',
  };
}

/** Codice fiscale inventato: struttura e carattere di controllo validi secondo il dominio. */
function codiceFiscaleInventato(cognome: string, nome: string, nascita: DataISO): string {
  const [anno = '', mese = '', giorno = ''] = nascita.split('-');
  const prefisso =
    cognome.slice(0, 3).toUpperCase() +
    nome.slice(0, 3).toUpperCase() +
    anno.slice(2) +
    elemento([...LETTERE_MESE_CF], Number(mese) - 1) +
    giorno +
    'L219';
  for (const lettera of LETTERE_MAIUSCOLE) {
    const candidato = prefisso + lettera;
    if (eCodiceFiscaleValido(candidato)) {
      return candidato;
    }
  }
  throw new ErroreSeed('Impossibile costruire un codice fiscale di prova.');
}

// ---------------------------------------------------------------------------------------------
// Piano della griglia: codici di base, poi eventi, poi reperibilità
// ---------------------------------------------------------------------------------------------

interface PersonaPiano {
  readonly dipendenteId: string;
  readonly oreSettimanali: number;
  readonly codiciBase: readonly string[];
}

interface Piano {
  readonly persone: readonly PersonaPiano[];
  /** celle[persona][giorno - 1] */
  readonly celle: CellaDoc[][];
  /** Celle già decise da un evento: non si toccano più. */
  readonly occupate: Set<string>;
}

function chiaveCella(persona: number, giorno: number): string {
  return `${persona}:${giorno}`;
}

function nuovoPiano(persone: readonly PersonaPiano[], giorni: number): Piano {
  const celle = persone.map((persona) =>
    persona.codiciBase
      .slice(0, giorni)
      .map((codice) =>
        codice === 'R'
          ? cella({ assenza: assenzaRiposo() })
          : cella({ turno: turnoInCella(codice) }),
      ),
  );
  return { persone, celle, occupate: new Set<string>() };
}

function assegna(piano: Piano, persona: number, giorno: number, nuova: CellaDoc): void {
  elemento(piano.celle, persona)[giorno - 1] = nuova;
  piano.occupate.add(chiaveCella(persona, giorno));
}

/** Prima persona libera con quel codice di base il giorno dato, esclusi gli indici indicati. */
function trovaPersona(
  piano: Piano,
  giorno: number,
  codice: string,
  escludi: readonly number[] = [],
): number | undefined {
  const indice = piano.persone.findIndex(
    (persona, i) =>
      !piano.occupate.has(chiaveCella(i, giorno)) &&
      elemento(persona.codiciBase, giorno - 1) === codice &&
      !escludi.includes(i),
  );
  return indice === -1 ? undefined : indice;
}

function malattia(piano: Piano, persona: number, giorni: readonly number[]): void {
  for (const giorno of giorni) {
    assegna(piano, persona, giorno, cella({ assenza: assenzaNeutra('MA') }));
  }
}

/** Turno scoperto e coperto: il collega in riposo copre il turno del pomeriggio. */
function sostituzione(piano: Piano, giorno: number): void {
  const assente = trovaPersona(piano, giorno, 'P1');
  const sostituto = assente === undefined ? undefined : trovaPersona(piano, giorno, 'R', [assente]);
  if (assente === undefined || sostituto === undefined) {
    throw new ErroreSeed(`Sostituzione non possibile il giorno ${giorno}.`);
  }
  const idAssente = elemento(piano.persone, assente).dipendenteId;
  const idSostituto = elemento(piano.persone, sostituto).dipendenteId;
  assegna(
    piano,
    assente,
    giorno,
    cella({ turno: turnoInCella('P1'), assenza: assenzaNeutra('F'), copertoDa: idSostituto }),
  );
  assegna(piano, sostituto, giorno, cella({ turno: turnoInCella('P1'), sostituisce: idAssente }));
}

/** Turno scoperto senza sostituto: resta un avviso da gestire in griglia. */
function scoperto(piano: Piano, giorno: number): void {
  const persona = trovaPersona(piano, giorno, 'M1');
  if (persona === undefined) {
    throw new ErroreSeed(`Nessun turno del mattino il giorno ${giorno}.`);
  }
  assegna(
    piano,
    persona,
    giorno,
    cella({ turno: turnoInCella('M1'), assenza: assenzaNeutra('F') }),
  );
}

/** Turno svolto con orari reali diversi da quelli previsti (variazione). */
function variazione(piano: Piano, giorno: number, codice: 'M1' | 'P1'): void {
  const persona = trovaPersona(piano, giorno, codice);
  if (persona === undefined) {
    throw new ErroreSeed(`Nessun turno ${codice} il giorno ${giorno}.`);
  }
  const reale =
    codice === 'M1' ? { inizio: '07:00', fine: '14:30' } : { inizio: '14:00', fine: '22:30' };
  assegna(
    piano,
    persona,
    giorno,
    cella({
      turno: turnoInCella(codice),
      orarioReale: { inizio: oraLocale(reale.inizio), fine: oraLocale(reale.fine) },
    }),
  );
}

/** Reperibilità sui giorni di riposo: due persone in riposo ogni giorno, con qualche chiamata. */
function reperibilita(piano: Piano, giorno: number): void {
  const riposi = piano.persone
    .map((_, indice) => indice)
    .filter(
      (indice) =>
        !piano.occupate.has(chiaveCella(indice, giorno)) &&
        elemento(elemento(piano.persone, indice).codiciBase, giorno - 1) === 'R',
    );
  const [diurna, notturna] = riposi;
  if (diurna !== undefined) {
    const chiamate = giorno % 4 === 0 ? [{ durataMinuti: 90, oraInizio: oraLocale('10:30') }] : [];
    const fascia: ReperibilitaInCella = {
      codice: codiceTurno('R1'),
      inizio: oraLocale('08:00'),
      fine: oraLocale('20:00'),
      chiamate,
      sostituisce: null,
      copertaDa: null,
    };
    elemento(piano.celle, diurna)[giorno - 1] = cella({
      assenza: assenzaRiposo(),
      reperibilita: [fascia],
    });
  }
  if (notturna !== undefined) {
    const chiamate = giorno % 5 === 0 ? [{ durataMinuti: 60, oraInizio: oraLocale('23:00') }] : [];
    const fascia: ReperibilitaInCella = {
      codice: codiceTurno('R2'),
      inizio: oraLocale('20:00'),
      fine: oraLocale('08:00'),
      chiamate,
      sostituisce: null,
      copertaDa: null,
    };
    elemento(piano.celle, notturna)[giorno - 1] = cella({
      assenza: assenzaRiposo(),
      reperibilita: [fascia],
    });
  }
}

/**
 * Eventi dei tre mesi per reparto. `indiceMese`: 0 = due mesi fa, 1 = mese scorso, 2 = mese corrente.
 * Ogni reparto ha almeno una malattia, una sostituzione, una variazione e (nel mese corrente) uno scoperto.
 */
function applicaEventi(piano: Piano, giorni: number, reparto: number, indiceMese: number): void {
  if (reparto === 0 && indiceMese === 0) {
    sostituzione(piano, 9);
    variazione(piano, 3, 'M1');
    variazione(piano, 7, 'P1');
  } else if (reparto === 0 && indiceMese === 1) {
    malattia(piano, 3, [10, 11, 12]);
    sostituzione(piano, 14);
    variazione(piano, 5, 'M1');
  } else if (reparto === 0 && indiceMese === 2) {
    scoperto(piano, 5);
    malattia(piano, 8, [18, 19]);
    variazione(piano, 2, 'M1');
  } else if (reparto === 1 && indiceMese === 0) {
    malattia(piano, 6, [20, 21]);
    variazione(piano, 4, 'P1');
  } else if (reparto === 1 && indiceMese === 1) {
    sostituzione(piano, 6);
    variazione(piano, 8, 'M1');
  } else if (reparto === 1 && indiceMese === 2) {
    sostituzione(piano, 12);
    variazione(piano, 9, 'P1');
  }
  for (let giorno = 1; giorno <= giorni; giorno += 1) {
    reperibilita(piano, giorno);
  }
}

// ---------------------------------------------------------------------------------------------
// Scrittura
// ---------------------------------------------------------------------------------------------

interface RepartoCreato {
  readonly repartoId: string;
  readonly nome: string;
  readonly dipendenteIds: readonly string[];
}

/** Le celle di una persona nel mese, con la chiave del giorno (solo i giorni con contenuto). */
function giorniRiga(
  chiave: ChiaveMese,
  piano: Piano,
  persona: number,
): Partial<Record<ChiaveGiorno, CellaDoc>> {
  const celle = elemento(piano.celle, persona);
  const giorni: Partial<Record<ChiaveGiorno, CellaDoc>> = {};
  giorniDelMese(chiave).forEach((data, indice) => {
    giorni[chiaveGiornoDi(data)] = elemento(celle, indice);
  });
  return giorni;
}

/** Il dominio decide: righe con un blocco non si scrivono (ARCHITETTURA §5.9). */
function controllaMese(righe: readonly Omit<RigaDoc, 'aggiornatoIl'>[], chiave: ChiaveMese): void {
  const problemi: ProblemaRiga[] = [
    ...righe.flatMap((riga) => validaRiga(riga, { chiaveMese: chiave })),
    ...validaMese(righe),
  ];
  const blocchi = problemi.filter((p) => p.livello === 'blocco');
  if (blocchi.length > 0) {
    const codici = [...new Set(blocchi.map((p) => p.codice))].join(', ');
    throw new ErroreSeed(`Dati dimostrativi non validi per ${chiave}: ${codici}.`);
  }
}

async function creaReparto(db: Firestore, nome: string, idCoordinatore: string): Promise<string> {
  const adesso = FieldValue.serverTimestamp();
  const rif = db.collection('reparti').doc();
  const doc: InScrittura<RepartoDoc> = {
    nome,
    coordinatoreUid: idCoordinatore,
    configurazione: { passo: 'completata' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: adesso,
    creatoDa: idCoordinatore,
    aggiornatoIl: adesso,
    aggiornatoDa: idCoordinatore,
  };
  await rif.create(doc);
  const batch = db.batch();
  for (const def of DEFINIZIONI_TURNI) {
    const turno: InScrittura<TurnoDoc> = {
      codice: codiceTurno(def.codice),
      tipo: def.tipo,
      nome: def.nome,
      colore: def.colore,
      inizio: oraLocale(def.inizio),
      fine: oraLocale(def.fine),
      pausaMinuti: def.pausaMinuti,
      notturno: eNotturno(oraLocale(def.inizio), oraLocale(def.fine)),
      attivo: true,
      ordine: DEFINIZIONI_TURNI.indexOf(def) + 1,
      creatoIl: adesso,
      aggiornatoIl: adesso,
    };
    batch.create(rif.collection('turni').doc(def.codice), turno);
  }
  for (const def of ASSENZE_DEMO) {
    const assenza: InScrittura<TipologiaAssenzaDoc> = {
      codice: codiceAssenza(def.codice),
      descrizione: def.descrizione,
      effetto: def.effetto,
      malattia: def.malattia,
      predefinita: def.predefinita,
      attivo: true,
      ordine: def.ordine,
      creatoIl: adesso,
      aggiornatoIl: adesso,
    };
    batch.create(rif.collection('assenze').doc(def.codice), assenza);
  }
  await batch.commit();
  return rif.id;
}

async function scriviMese(
  db: Firestore,
  repartoId: string,
  chiave: ChiaveMese,
  idCoordinatore: string,
  piano: Piano,
): Promise<void> {
  const anno = Number(chiave.slice(0, 4));
  const mese = Number(chiave.slice(5, 7));
  const adesso = FieldValue.serverTimestamp();
  const righe: Omit<RigaDoc, 'aggiornatoIl'>[] = piano.persone.map((persona, indice) => ({
    dipendenteId: persona.dipendenteId,
    contratto: contrattoDemo(persona.oreSettimanali),
    giorni: giorniRiga(chiave, piano, indice),
    versione: 1,
    aggiornatoDa: idCoordinatore,
  }));
  controllaMese(righe, chiave);

  const rifMese = db.collection(`reparti/${repartoId}/mesi`).doc(chiave);
  const mesDoc: InScrittura<MeseDoc> = {
    chiave,
    anno,
    mese,
    stato: 'bozza',
    calendario: calendarioMese(chiave, FESTIVITA_DEMO, 'inizio'),
    creatoIl: adesso,
    creatoDa: idCoordinatore,
    aggiornatoIl: adesso,
    aggiornatoDa: idCoordinatore,
    convalidatoIl: null,
    convalidatoDa: null,
    convalidatoDaNome: null,
  };
  const batch = db.batch();
  batch.create(rifMese, mesDoc);
  for (const riga of righe) {
    const scrittura: InScrittura<RigaDoc> = { ...riga, aggiornatoIl: adesso };
    batch.create(rifMese.collection('righe').doc(riga.dipendenteId), scrittura);
  }
  await batch.commit();
}

function contrattoDemo(oreSettimanali: number): ContrattoRiga {
  return { oreSettimanali, dataAssunzione: null, dataCessazione: null };
}

// ---------------------------------------------------------------------------------------------
// Programma
// ---------------------------------------------------------------------------------------------

async function creaReparti(
  porte: PorteEmulatori,
  db: Firestore,
  coordinatori: readonly { readonly uid: string; readonly token: string }[],
): Promise<RepartoCreato[]> {
  const nomiReparti = ['Medicina (dati demo)', 'Chirurgia (dati demo)'] as const;
  const cognomi = [COGNOMI_MEDICINA, COGNOMI_CHIRURGIA] as const;
  const creati: RepartoCreato[] = [];

  for (const [indiceReparto, nome] of nomiReparti.entries()) {
    const coordinatore = elemento(coordinatori, indiceReparto);
    const repartoId = await creaReparto(db, nome, coordinatore.uid);
    const cognomiReparto = elemento(cognomi, indiceReparto);

    const dipendenteIds: string[] = [];
    for (let indice = 0; indice < NOMI.length; indice += 1) {
      const nomePersona = elemento(NOMI, indice);
      const cognomePersona = elemento(cognomiReparto, indice);
      const nascita = dataISO(
        `${1972 + ((indice * 3) % 22)}-${String((indice % 12) + 1).padStart(2, '0')}-${String(5 + indice).padStart(2, '0')}`,
      );
      const esclusi = indiceReparto === 1 && indice === 11 ? ['N1'] : [];
      const risultato = await chiamaFunzione(porte, 'salvaDipendente', coordinatore.token, {
        repartoId,
        dipendenteId: null,
        anagrafica: {
          nome: nomePersona,
          cognome: cognomePersona,
          oreSettimanali: elemento(ORE_SETTIMANALI, indice),
          turniEsclusi: esclusi,
          dataAssunzione: null,
          dataCessazione: null,
          attivo: true,
        },
        privati: {
          codiceFiscale: codiceFiscaleInventato(cognomePersona, nomePersona, nascita),
          dataNascita: nascita,
          email: null,
        },
      });
      dipendenteIds.push(dipendenteIdDi(risultato));
    }
    creati.push({ repartoId, nome, dipendenteIds });
  }
  return creati;
}

async function principale(): Promise<number> {
  let valori;
  try {
    valori = parseArgs({
      options: {
        emulatore: { type: 'boolean', default: false },
        svuota: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    console.error(`Argomenti non riconosciuti.\n\n${USO}`);
    return 1;
  }
  if (!valori.emulatore) {
    console.error(`Il seed gira solo sugli emulatori: manca --emulatore.\n\n${USO}`);
    return 1;
  }

  const porte = preparaEmulatori();
  await verificaEmulatoriAttivi(porte);

  const app = initializeApp({ projectId: PROGETTO }, 'seed-demo');
  try {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const pieni =
      !(await db.collection('reparti').limit(1).get()).empty ||
      !(await db.collection('utenti').limit(1).get()).empty;
    // --svuota cancella sempre Auth e Firestore, anche se Firestore è vuoto ma restano utenti in Auth
    // (altrimenti la creazione del coordinatore fallirebbe per email duplicata).
    if (valori.svuota) {
      await svuotaEmulatori(porte);
    } else if (pieni) {
      throw new ErroreSeed(
        'Negli emulatori ci sono già dati: usare --svuota per ricrearli, oppure riavviare «npm run emulators».',
      );
    }

    // ADMIN: stessa procedura dello script crea-primo-admin, poi una password nota (solo emulatore).
    const admin = await creaOPromuoviAdmin(auth, db, {
      email: EMAIL_ADMIN,
      nome: 'Anna',
      cognome: 'Verdi',
    });
    await auth.updateUser(admin.uid, { password: PASSWORD_DEMO });
    const tokenAdmin = await accedi(porte, EMAIL_ADMIN);

    // Coordinatori: creaCoordinatore (callable) con il token dell'ADMIN.
    const coordinatori: { uid: string; token: string }[] = [];
    for (const coordinatore of COORDINATORI) {
      const risultato = await chiamaFunzione(porte, 'creaCoordinatore', tokenAdmin, {
        email: coordinatore.email,
        nome: coordinatore.nome,
        cognome: coordinatore.cognome,
      });
      const uid = uidDi(risultato, 'creaCoordinatore');
      await auth.updateUser(uid, { password: PASSWORD_DEMO });
      coordinatori.push({ uid, token: await accedi(porte, coordinatore.email) });
    }

    const reparti = await creaReparti(porte, db, coordinatori);

    // Mesi: due mesi fa e il mese scorso convalidati, il mese corrente in bozza.
    const chiavi = [-2, -1, 0].map((passo) => spostaMese(chiaveMese(meseCorrente()), passo));
    const riepilogo: string[] = [];
    for (const [indiceReparto, reparto] of reparti.entries()) {
      const coordinatore = elemento(coordinatori, indiceReparto);
      const persone: PersonaPiano[] = reparto.dipendenteIds.map((dipendenteId, indice) => ({
        dipendenteId,
        oreSettimanali: elemento(ORE_SETTIMANALI, indice),
        codiciBase: Array.from({ length: 31 }, (_, giorno) =>
          elemento(indice % 4 === 3 ? CICLO_DIURNO : CICLO_MISTO, (giorno + indice) % 10),
        ),
      }));
      for (const [indiceMese, chiave] of chiavi.entries()) {
        const giorni = giorniDelMese(chiave).length;
        const piano = nuovoPiano(persone, giorni);
        applicaEventi(piano, giorni, indiceReparto, indiceMese);
        await scriviMese(db, reparto.repartoId, chiave, coordinatore.uid, piano);
        const convalidato = indiceMese < 2;
        if (convalidato) {
          await chiamaFunzione(porte, 'convalidaMese', coordinatore.token, {
            repartoId: reparto.repartoId,
            chiaveMese: chiave,
          });
        }
        riepilogo.push(`${reparto.nome} ${chiave}: ${convalidato ? 'convalidato' : 'in bozza'}`);
      }
    }

    console.log('Dati dimostrativi creati sugli emulatori (progetto demo-turni).');
    console.log(`ADMIN: ${EMAIL_ADMIN}`);
    for (const coordinatore of COORDINATORI) {
      console.log(`Coordinatore: ${coordinatore.email}`);
    }
    console.log(`Password di tutti gli utenti demo: ${PASSWORD_DEMO}`);
    for (const riga of riepilogo) {
      console.log(riga);
    }
    return 0;
  } finally {
    await deleteApp(app);
  }
}

const eseguitoDirettamente =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (eseguitoDirettamente) {
  principale().then(
    (codice) => {
      process.exitCode = codice;
    },
    (e: unknown) => {
      if (e instanceof ErroreSeed) {
        console.error(e.message);
      } else {
        const codice =
          typeof e === 'object' && e !== null && 'code' in e ? ` [${String(e.code)}]` : '';
        console.error(`Errore${codice}: ${e instanceof Error ? e.message : String(e)}`);
      }
      process.exitCode = 1;
    },
  );
}
