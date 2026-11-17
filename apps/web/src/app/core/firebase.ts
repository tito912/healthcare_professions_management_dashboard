// Inizializzazione Firebase (SDK web modulare). Pigra: il primo utilizzo crea i servizi.
// Configurazione da environment.ts, generato da scripts/genera-ambiente-web.ts a partire da FIREBASE_*.
import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, connectAuthEmulator, initializeAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import { REGIONE_FUNZIONI } from '@turni/domain';
import { ambiente } from '../../environments/environment';

export interface ServiziFirebase {
  readonly auth: Auth;
  readonly db: Firestore;
  readonly funzioni: Functions;
}

let servizi: ServiziFirebase | undefined;

export function serviziFirebase(): ServiziFirebase {
  if (servizi) {
    return servizi;
  }
  const app = initializeApp(ambiente.firebase);
  // Sessione del browser: l'accesso non sopravvive alla chiusura della scheda.
  const auth = initializeAuth(app, { persistence: browserSessionPersistence });
  // Cache solo in memoria: nessun dato del reparto resta nel browser tra una sessione e l'altra.
  const db = initializeFirestore(app, { localCache: memoryLocalCache() });
  const funzioni = getFunctions(app, REGIONE_FUNZIONI);

  if (ambiente.usaEmulatori) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(funzioni, '127.0.0.1', 5001);
  }

  servizi = { auth, db, funzioni };
  return servizi;
}
