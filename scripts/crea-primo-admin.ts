// Crea o promuove un utente ad ADMIN data l'email (ARCHITETTURA §3, PIANO 1.1 criterio 8).
// Admin SDK con le credenziali predefinite dell'applicazione; nessun segreto nel repository.
//
// Sugli emulatori (avviati con `npm run emulators`), da un altro terminale:
//   npm run crea-primo-admin -- --emulatore --email admin@esempio.it --nome Anna --cognome Verdi
// Su un progetto reale (prima: `gcloud auth application-default login`):
//   npm run crea-primo-admin -- --project <id> --email admin@esempio.it --nome Anna --cognome Verdi
//   Lo script chiede di digitare l'ID del progetto: senza la conferma esatta non modifica nulla.
//
// Effetti: utente Auth creato (con una password casuale che nessuno conosce) o esistente; claim
// { ruolo: 'ADMIN' } al posto dei claim precedenti; utente abilitato; utenti/{uid} con ruolo ADMIN e
// attivo; voce `utente.creato` nel registro radice con autore SISTEMA. Per un utente esistente revoca i
// token: il nuovo ruolo vale dal prossimo accesso. La password si sceglie con «Password dimenticata?».
// Non stampa l'email né altri dati personali: solo l'uid.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  analizzaInput,
  schemaEmailAccesso,
  schemaNomePersona,
  type UtenteDoc,
  type VoceRegistroDoc,
} from '@turni/domain';
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { InScrittura } from '../functions/src/comune/admin';
import { passwordCasuale } from '../functions/src/utenti/password';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USO = `Uso:
  npm run crea-primo-admin -- --emulatore --email <email> [--nome <nome> --cognome <cognome>]
  npm run crea-primo-admin -- --project <id> --email <email> [--nome <nome> --cognome <cognome>]

  --emulatore       usa gli emulatori di Auth e Firestore (porte di firebase.json), progetto demo-turni
  --project <id>    progetto Firebase reale (credenziali predefinite dell'applicazione); chiede conferma
  --nome, --cognome obbligatori se l'utente non ha ancora il documento utenti/{uid}`;

/** Errore d'uso: messaggio per chi esegue lo script, nessuna modifica fatta. */
class ErroreUso extends Error {}

// ---------------------------------------------------------------------------------------------
// Logica: crea o promuove (esportata per i dati dimostrativi dello step 4.3)
// ---------------------------------------------------------------------------------------------

export interface DatiAdmin {
  readonly email: string;
  readonly nome: string | null;
  readonly cognome: string | null;
}

export interface EsitoAdmin {
  readonly uid: string;
  /** true: utente Auth creato ora; false: utente esistente promosso. */
  readonly creato: boolean;
  /** Reparti di cui l'utente è ancora coordinatore: un ADMIN non li modifica, vanno riassegnati. */
  readonly repartiCoordinati: number;
}

async function utentePerEmail(auth: Auth, email: string): Promise<UserRecord | null> {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'code' in e && e.code === 'auth/user-not-found') {
      return null;
    }
    throw e;
  }
}

export async function creaOPromuoviAdmin(
  auth: Auth,
  db: Firestore,
  dati: DatiAdmin,
): Promise<EsitoAdmin> {
  // Prima tutte le verifiche, poi le scritture: un errore d'uso non lascia nulla a metà.
  const esistente = await utentePerEmail(auth, dati.email);
  const documento =
    esistente === null ? null : await db.collection('utenti').doc(esistente.uid).get();
  let scrittura:
    { readonly tipo: 'aggiorna' } | { readonly tipo: 'crea'; nome: string; cognome: string };
  if (documento?.exists === true) {
    scrittura = { tipo: 'aggiorna' };
  } else if (dati.nome !== null && dati.cognome !== null) {
    scrittura = { tipo: 'crea', nome: dati.nome, cognome: dati.cognome };
  } else {
    throw new ErroreUso(
      'L’utente non ha ancora il documento utenti/{uid}: servono --nome e --cognome.',
    );
  }

  // Ordine «a prova di guasto»: con il claim ADMIN ma senza il documento coerente le regole e le
  // callable non riconoscono l'utente; rieseguire lo script completa l'operazione.
  const record =
    esistente ??
    (await auth.createUser({
      email: dati.email,
      password: passwordCasuale(),
      emailVerified: false,
    }));
  await auth.setCustomUserClaims(record.uid, { ruolo: 'ADMIN' });
  if (record.disabled) {
    await auth.updateUser(record.uid, { disabled: false });
  }

  const adesso = FieldValue.serverTimestamp();
  const rifUtente = db.collection('utenti').doc(record.uid);
  const batch = db.batch();
  if (scrittura.tipo === 'aggiorna') {
    const modifica: Partial<InScrittura<UtenteDoc>> = {
      ruolo: 'ADMIN',
      attivo: true,
      aggiornatoIl: adesso,
      ...(dati.nome === null ? {} : { nome: dati.nome }),
      ...(dati.cognome === null ? {} : { cognome: dati.cognome }),
    };
    batch.update(rifUtente, modifica);
  } else {
    const nuovo: InScrittura<UtenteDoc> = {
      nome: scrittura.nome,
      cognome: scrittura.cognome,
      email: record.email ?? dati.email,
      ruolo: 'ADMIN',
      attivo: true,
      creatoIl: adesso,
      creatoDa: null,
      aggiornatoIl: adesso,
    };
    batch.create(rifUtente, nuovo);
  }
  const voce: InScrittura<VoceRegistroDoc> = {
    il: adesso,
    tipo: 'utente.creato',
    autoreUid: null,
    autoreNome: null,
    autoreRuolo: 'SISTEMA',
    repartoId: null,
    chiaveMese: null,
    dipendenteId: null,
    dettagli: {
      uid: record.uid,
      ruolo: 'ADMIN',
      origine: 'crea-primo-admin',
      utenteEsistente: esistente !== null,
    },
  };
  batch.create(db.collection('registroAttivita').doc(), voce);
  await batch.commit();

  if (esistente !== null) {
    await auth.revokeRefreshTokens(record.uid);
  }
  const reparti = await db
    .collection('reparti')
    .where('coordinatoreUid', '==', record.uid)
    .count()
    .get();
  return { uid: record.uid, creato: esistente === null, repartiCoordinati: reparti.data().count };
}

// ---------------------------------------------------------------------------------------------
// Riga di comando
// ---------------------------------------------------------------------------------------------

interface Destinazione {
  readonly tipo: 'emulatore' | 'reale';
  readonly progetto: string;
}

function porteEmulatori(): { auth: number; firestore: number } {
  const configurazione: { emulators: { auth: { port: number }; firestore: { port: number } } } =
    JSON.parse(readFileSync(path.join(radice, 'firebase.json'), 'utf8'));
  return {
    auth: configurazione.emulators.auth.port,
    firestore: configurazione.emulators.firestore.port,
  };
}

function scegliDestinazione(emulatore: boolean, progetto: string | undefined): Destinazione {
  if (emulatore) {
    const porte = porteEmulatori();
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ||= `127.0.0.1:${porte.auth}`;
    process.env['FIRESTORE_EMULATOR_HOST'] ||= `127.0.0.1:${porte.firestore}`;
  }
  const conAuth = (process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '') !== '';
  const conFirestore = (process.env['FIRESTORE_EMULATOR_HOST'] ?? '') !== '';
  if (conAuth !== conFirestore) {
    // Metà delle scritture andrebbe al progetto reale: mai.
    throw new ErroreUso(
      'Configurazione mista: impostare entrambe o nessuna tra FIREBASE_AUTH_EMULATOR_HOST e FIRESTORE_EMULATOR_HOST.',
    );
  }
  if (conAuth) {
    // Sugli emulatori non servono credenziali: le librerie Google non cercano il server dei metadati
    // di Compute Engine (attesa di qualche secondo e avviso MetadataLookupWarning).
    process.env['METADATA_SERVER_DETECTION'] ||= 'none';
    return {
      tipo: 'emulatore',
      progetto: progetto ?? process.env['GCLOUD_PROJECT'] ?? 'demo-turni',
    };
  }
  if (progetto === undefined || progetto === '') {
    throw new ErroreUso('Indicare --emulatore oppure --project <id>.');
  }
  return { tipo: 'reale', progetto };
}

/** Chiede di digitare l'ID del progetto. Input chiuso senza risposta = nessuna conferma. */
function confermaProgettoReale(progetto: string): Promise<boolean> {
  return new Promise((risolvi) => {
    const lettore = createInterface({ input: process.stdin, output: process.stdout });
    let risposto = false;
    lettore.on('close', () => {
      if (!risposto) {
        process.stdout.write('\n');
        risolvi(false);
      }
    });
    lettore.question(
      `ATTENZIONE: verranno modificati Authentication e Firestore del progetto reale «${progetto}».\n` +
        'Digita l’ID del progetto per confermare: ',
      (risposta) => {
        risposto = true;
        lettore.close();
        risolvi(risposta.trim() === progetto);
      },
    );
  });
}

function leggiArgomenti(): {
  destinazione: Destinazione;
  dati: DatiAdmin;
} {
  let valori;
  try {
    valori = parseArgs({
      options: {
        email: { type: 'string' },
        nome: { type: 'string' },
        cognome: { type: 'string' },
        project: { type: 'string' },
        emulatore: { type: 'boolean', default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    throw new ErroreUso('Argomenti non riconosciuti.');
  }
  const email = analizzaInput(schemaEmailAccesso, valori.email);
  if (!email.valido) {
    throw new ErroreUso('--email mancante o non valida.');
  }
  const nome = valori.nome === undefined ? null : analizzaInput(schemaNomePersona, valori.nome);
  const cognome =
    valori.cognome === undefined ? null : analizzaInput(schemaNomePersona, valori.cognome);
  if ((nome !== null && !nome.valido) || (cognome !== null && !cognome.valido)) {
    throw new ErroreUso('--nome e --cognome: da 1 a 60 caratteri.');
  }
  return {
    destinazione: scegliDestinazione(valori.emulatore, valori.project),
    dati: {
      email: email.valore,
      nome: nome?.valido === true ? nome.valore : null,
      cognome: cognome?.valido === true ? cognome.valore : null,
    },
  };
}

async function principale(): Promise<number> {
  let argomenti;
  try {
    argomenti = leggiArgomenti();
  } catch (e) {
    if (e instanceof ErroreUso) {
      console.error(`${e.message}\n\n${USO}`);
      return 1;
    }
    throw e;
  }
  const { destinazione, dati } = argomenti;

  if (destinazione.tipo === 'reale' && !(await confermaProgettoReale(destinazione.progetto))) {
    console.error('Conferma non valida: nessuna modifica.');
    return 1;
  }

  const app = initializeApp(
    destinazione.tipo === 'reale'
      ? { credential: applicationDefault(), projectId: destinazione.progetto }
      : { projectId: destinazione.progetto },
    'crea-primo-admin',
  );
  try {
    const esito = await creaOPromuoviAdmin(getAuth(app), getFirestore(app), dati);
    const dove =
      destinazione.tipo === 'emulatore'
        ? `emulatori, progetto ${destinazione.progetto}`
        : `progetto ${destinazione.progetto}`;
    console.log(
      `${esito.creato ? 'ADMIN creato' : 'Utente esistente promosso ad ADMIN'} (${dove}): uid ${esito.uid}.`,
    );
    if (esito.creato) {
      console.log(
        'Per scegliere la password usare «Password dimenticata?» nella pagina di accesso.',
      );
    } else {
      console.log('I token precedenti sono revocati: il ruolo ADMIN vale dal prossimo accesso.');
    }
    if (esito.repartiCoordinati > 0) {
      console.log(
        `Attenzione: è ancora coordinatore di ${esito.repartiCoordinati} reparti, che come ADMIN non può modificare. Riassegnarli con «Riassegna reparto».`,
      );
    }
    return 0;
  } catch (e) {
    if (e instanceof ErroreUso) {
      console.error(e.message);
      return 1;
    }
    throw e;
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
      // Codice e messaggio dell'errore dell'SDK (credenziali, rete): nessun dato dell'utente.
      const codice =
        typeof e === 'object' && e !== null && 'code' in e ? ` [${String(e.code)}]` : '';
      console.error(`Errore${codice}: ${e instanceof Error ? e.message : String(e)}`);
      process.exitCode = 2;
    },
  );
}
