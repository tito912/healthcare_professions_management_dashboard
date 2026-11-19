// Strumenti per i test sugli emulatori (npm run test:rules): Admin SDK di prova, svuotamento,
// utenti di prova e client web autenticati che chiamano le callable come farà il browser.
// Si rifiuta di partire fuori da `firebase emulators:exec` o su un progetto che non è demo-*.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIONE_FUNZIONI } from '@turni/domain';
import {
  deleteApp as eliminaAppAdmin,
  initializeApp as inizializzaAdmin,
} from 'firebase-admin/app';
import { getAuth as authAdmin, type Auth } from 'firebase-admin/auth';
import {
  Timestamp,
  getFirestore as firestoreAdmin,
  type Firestore,
} from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  type Auth as AuthWeb,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore as FirestoreWeb,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';

export const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function variabile(nome: string): string {
  const valore = process.env[nome];
  if (valore === undefined || valore === '') {
    throw new Error(`${nome} non impostata: eseguire i test con npm run test:rules.`);
  }
  return valore;
}

export const PROGETTO = variabile('GCLOUD_PROJECT');
if (!PROGETTO.startsWith('demo-')) {
  throw new Error('I test sugli emulatori usano solo progetti demo-*.');
}
export const HOST_AUTH = variabile('FIREBASE_AUTH_EMULATOR_HOST');
export const HOST_FIRESTORE = variabile('FIRESTORE_EMULATOR_HOST');

interface ConfigurazioneEmulatori {
  readonly emulators: { readonly functions: { readonly port: number } };
}
const configurazione: ConfigurazioneEmulatori = JSON.parse(
  readFileSync(path.join(radice, 'firebase.json'), 'utf8'),
);
export const PORTA_FUNCTIONS = configurazione.emulators.functions.port;

// ---------------------------------------------------------------------------------------------
// Admin SDK di prova (prepara i dati e verifica gli effetti, senza regole)
// ---------------------------------------------------------------------------------------------

export interface AdminDiProva {
  readonly auth: Auth;
  readonly db: Firestore;
  chiudi(): Promise<void>;
}

let contatoreApp = 0;

export function adminDiProva(): AdminDiProva {
  contatoreApp += 1;
  const app = inizializzaAdmin({ projectId: PROGETTO }, `admin-di-prova-${contatoreApp}`);
  return { auth: authAdmin(app), db: firestoreAdmin(app), chiudi: () => eliminaAppAdmin(app) };
}

const TENTATIVI_SVUOTAMENTO = 8;
const ATTESA_INIZIALE_SVUOTAMENTO_MS = 100;

const attendi = (ms: number) => new Promise<void>((risolvi) => setTimeout(risolvi, ms));

/**
 * Una DELETE con cui l'emulatore di Firestore risponde 409 (o 5xx) perché una transazione di un trigger
 * del test precedente è ancora in corso: è transitoria e si supera riprovando dopo una breve attesa.
 */
function erroreTransitorio(stato: number): boolean {
  return stato === 409 || stato >= 500;
}

async function eliminaConRitentativi(nome: string, url: string): Promise<void> {
  let attesa = ATTESA_INIZIALE_SVUOTAMENTO_MS;
  let ultimoStato = 0;
  for (let tentativo = 1; tentativo <= TENTATIVI_SVUOTAMENTO; tentativo += 1) {
    const risposta = await fetch(url, { method: 'DELETE' });
    if (risposta.ok) return;
    ultimoStato = risposta.status;
    if (!erroreTransitorio(ultimoStato)) break;
    await attendi(attesa);
    attesa = Math.min(attesa * 2, 2000);
  }
  throw new Error(`Svuotamento di ${nome} non riuscito (HTTP ${ultimoStato}).`);
}

/**
 * Svuota Auth e Firestore del progetto demo con le API degli emulatori.
 * Riprova sugli errori transitori (HTTP 409 e 5xx) con attesa crescente; ogni altro errore è subito fatale.
 */
export async function svuotaEmulatori(): Promise<void> {
  await Promise.all([
    eliminaConRitentativi('Auth', `http://${HOST_AUTH}/emulator/v1/projects/${PROGETTO}/accounts`),
    eliminaConRitentativi(
      'Firestore',
      `http://${HOST_FIRESTORE}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`,
    ),
  ]);
}

export const PASSWORD_DI_PROVA = 'Password-di-prova-1';

export interface UtenteDiProva {
  readonly uid: string;
  /** Claim `ruolo`; null = nessun claim. */
  readonly ruolo: string | null;
  /** Documento utenti/{uid}; null = nessun documento. */
  readonly documento: { readonly ruolo: string; readonly attivo: boolean } | null;
  readonly disabilitato?: boolean;
}

export function emailDi(uid: string): string {
  return `${uid.toLowerCase()}@prova.example`;
}

/** Crea l'utente Auth (con password nota), il claim e il documento utenti/{uid}. */
export async function creaUtente(admin: AdminDiProva, utente: UtenteDiProva): Promise<void> {
  await admin.auth.createUser({
    uid: utente.uid,
    email: emailDi(utente.uid),
    password: PASSWORD_DI_PROVA,
    disabled: utente.disabilitato ?? false,
  });
  if (utente.ruolo !== null) {
    await admin.auth.setCustomUserClaims(utente.uid, { ruolo: utente.ruolo });
  }
  if (utente.documento !== null) {
    await admin.db.doc(`utenti/${utente.uid}`).set({
      nome: 'Nome',
      cognome: utente.uid,
      email: emailDi(utente.uid),
      ruolo: utente.documento.ruolo,
      attivo: utente.documento.attivo,
      creatoIl: Timestamp.fromMillis(0),
      creatoDa: null,
      aggiornatoIl: Timestamp.fromMillis(0),
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Client web (come il browser): Auth, Firestore con le regole vere, callable
// ---------------------------------------------------------------------------------------------

export interface ClienteWeb {
  readonly app: FirebaseApp;
  readonly auth: AuthWeb;
  readonly db: FirestoreWeb;
  readonly functions: Functions;
  chiama(funzione: string, dati: unknown): Promise<unknown>;
  chiudi(): Promise<void>;
}

export function clienteWeb(): ClienteWeb {
  contatoreApp += 1;
  const app = initializeApp(
    { apiKey: 'demo-api-key', projectId: PROGETTO, authDomain: `${PROGETTO}.firebaseapp.com` },
    `cliente-web-${contatoreApp}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST_AUTH}`, { disableWarnings: true });
  const db = getFirestore(app);
  const [hostFirestore = '127.0.0.1', portaFirestore = '8080'] = HOST_FIRESTORE.split(':');
  connectFirestoreEmulator(db, hostFirestore, Number(portaFirestore));
  const functions = getFunctions(app, REGIONE_FUNZIONI);
  connectFunctionsEmulator(functions, '127.0.0.1', PORTA_FUNCTIONS);
  return {
    app,
    auth,
    db,
    functions,
    chiama: async (funzione, dati) => (await httpsCallable(functions, funzione)(dati)).data,
    chiudi: () => deleteApp(app),
  };
}

/** Client web autenticato con email e password dell'utente di prova. */
export async function accedi(uid: string): Promise<ClienteWeb> {
  const cliente = clienteWeb();
  await signInWithEmailAndPassword(cliente.auth, emailDi(uid), PASSWORD_DI_PROVA);
  return cliente;
}

export interface CodiceOob {
  readonly email: string;
  readonly requestType: string;
  readonly oobCode: string;
}

function eCodiceOob(valore: unknown): valore is CodiceOob {
  return (
    typeof valore === 'object' &&
    valore !== null &&
    'email' in valore &&
    typeof valore.email === 'string' &&
    'requestType' in valore &&
    typeof valore.requestType === 'string' &&
    'oobCode' in valore &&
    typeof valore.oobCode === 'string'
  );
}

/** Codici (`oobCode`) delle email che l'emulatore Auth avrebbe inviato, es. reimpostazione password. */
export async function codiciOob(): Promise<readonly CodiceOob[]> {
  const risposta = await fetch(`http://${HOST_AUTH}/emulator/v1/projects/${PROGETTO}/oobCodes`);
  const corpo: unknown = await risposta.json();
  if (typeof corpo !== 'object' || corpo === null || !('oobCodes' in corpo)) {
    return [];
  }
  const elenco: unknown = corpo.oobCodes;
  return Array.isArray(elenco) ? elenco.filter(eCodiceOob) : [];
}
