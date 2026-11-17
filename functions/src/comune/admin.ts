// Admin SDK, inizializzato al primo uso: importare le funzioni (test unitari, analisi del deploy) non
// apre connessioni. Sull'emulatore le variabili FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST,
// impostate dalla suite, collegano l'SDK agli emulatori.
import type { Istante } from '@turni/domain';
import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';

function app(): App {
  return getApps().some((a) => a.name === '[DEFAULT]') ? getApp() : initializeApp();
}

export function db(): Firestore {
  return getFirestore(app());
}

export function auth(): Auth {
  return getAuth(app());
}

/** Valore dei campi Istante in scrittura: l'ora la mette il server. */
export function oraServer(): FieldValue {
  return FieldValue.serverTimestamp();
}

/**
 * Forma di un documento di ARCHITETTURA §5 in scrittura: i campi Istante diventano serverTimestamp().
 * Così le scritture delle Functions sono controllate dal compilatore sugli stessi tipi del dominio.
 */
export type InScrittura<T> = {
  [K in keyof T]: T[K] extends Istante
    ? FieldValue
    : T[K] extends Istante | null
      ? FieldValue | null
      : T[K];
};

export function rifUtente(uid: string): DocumentReference {
  return db().collection('utenti').doc(uid);
}

export function rifReparto(repartoId: string): DocumentReference {
  return db().collection('reparti').doc(repartoId);
}
