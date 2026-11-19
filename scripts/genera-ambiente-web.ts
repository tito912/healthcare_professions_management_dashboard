// Genera apps/web/src/environments/environment.ts dalle variabili FIREBASE_* (vedi .env.example).
// Angular non legge i file .env: questo script lo fa al posto suo, prima di start, build, typecheck e test.
// Non stampa mai i valori: solo i nomi delle variabili mancanti.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fileEnv = path.join(radice, '.env');
// La destinazione si può deviare solo per i test del predeploy (tests/regole/predeploy-hosting.test.ts).
const fileDestinazione =
  process.env['AMBIENTE_WEB_DESTINAZIONE'] ??
  path.join(radice, 'apps/web/src/environments/environment.ts');

// Le variabili già presenti nel processo hanno la precedenza sul file .env.
if (existsSync(fileEnv)) {
  process.loadEnvFile(fileEnv);
}

const usaEmulatori = parseBooleano(process.env['USE_EMULATORS'], 'USE_EMULATORS');
// Con l'argomento --deploy (lo passa lo script build:deploy, lanciato dal predeploy di Hosting in firebase.json) una
// variabile FIREBASE_* mancante, o USE_EMULATORS=true, è un errore: senza questo controllo il build passa con soli
// avvisi e il deploy pubblicherebbe un'app che non si collega a nulla (audit 4.4, I4). È un argomento e non una
// variabile d'ambiente perché la CLI Firebase non esegue un predeploy che contiene «=» (audit 4.4, R1).
const richiedeConfigurazione = process.argv.slice(2).includes('--deploy');
const mancanti: string[] = [];

function parseBooleano(valore: string | undefined, nome: string): boolean {
  if (valore === undefined || valore === '' || valore === 'false') {
    return false;
  }
  if (valore === 'true') {
    return true;
  }
  throw new Error(`${nome} deve essere true o false.`);
}

function leggi(nome: string, predefinito: string): string {
  const valore = process.env[nome];
  if (valore !== undefined && valore !== '') {
    return valore;
  }
  if (!usaEmulatori) {
    mancanti.push(nome);
    console.warn(`Variabile ${nome} non impostata: l'app web userà un valore vuoto.`);
  }
  return predefinito;
}

// Con gli emulatori i valori sono di prova: nessun progetto reale viene toccato.
const progetto = leggi('FIREBASE_PROJECT_ID', usaEmulatori ? 'demo-turni' : '');
// Con gli emulatori non si deve mai puntare a un progetto reale (review 0.2, rilievo 1).
if (usaEmulatori && !progetto.startsWith('demo-')) {
  throw new Error(
    'USE_EMULATORS=true richiede FIREBASE_PROJECT_ID non impostato o con prefisso demo-.',
  );
}
if (richiedeConfigurazione && usaEmulatori) {
  throw new Error('Il deploy richiede USE_EMULATORS=false: l’app punterebbe agli emulatori.');
}
const finestraRaw = process.env['FINESTRA_MESI_MODIFICABILI'];
const finestra =
  finestraRaw !== undefined && finestraRaw !== '' ? Number(finestraRaw) : usaEmulatori ? 24 : 2;
if (!Number.isInteger(finestra) || finestra < 1) {
  throw new Error('FINESTRA_MESI_MODIFICABILI deve essere un intero positivo.');
}

const configurazione = {
  apiKey: leggi('FIREBASE_API_KEY', usaEmulatori ? 'demo-api-key' : ''),
  authDomain: leggi('FIREBASE_AUTH_DOMAIN', usaEmulatori ? `${progetto}.firebaseapp.com` : ''),
  projectId: progetto,
  storageBucket: leggi('FIREBASE_STORAGE_BUCKET', usaEmulatori ? `${progetto}.appspot.com` : ''),
  messagingSenderId: leggi('FIREBASE_MESSAGING_SENDER_ID', ''),
  appId: leggi('FIREBASE_APP_ID', usaEmulatori ? '1:000000000000:web:demo' : ''),
};

if (richiedeConfigurazione && mancanti.length > 0) {
  throw new Error(
    `Configurazione Firebase incompleta per il deploy. Variabili mancanti: ${mancanti.join(', ')} (vedi .env.example).`,
  );
}

const contenuto = `// File generato da scripts/genera-ambiente-web.ts. Non modificare a mano; ignorato da git.
export interface AmbienteWeb {
  readonly usaEmulatori: boolean;
  readonly finestraMesiModificabili: number;
  readonly firebase: {
    readonly apiKey: string;
    readonly authDomain: string;
    readonly projectId: string;
    readonly storageBucket: string;
    readonly messagingSenderId: string;
    readonly appId: string;
  };
}

export const ambiente: AmbienteWeb = {
  usaEmulatori: ${usaEmulatori},
  finestraMesiModificabili: ${finestra},
  firebase: ${JSON.stringify(configurazione, null, 4).replace(/\n/g, '\n  ')},
};
`;

mkdirSync(path.dirname(fileDestinazione), { recursive: true });
writeFileSync(fileDestinazione, contenuto);
console.log(
  `Ambiente web scritto (emulatori: ${usaEmulatori ? 'sì' : 'no'}, progetto: ${progetto || 'non impostato'}).`,
);
