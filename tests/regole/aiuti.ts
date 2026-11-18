// Strumenti comuni dei test delle Security Rules (npm run test:rules, emulatore Firestore).
// Si usa l'API compat dell'SDK web perché @firebase/rules-unit-testing restituisce un'istanza compat:
// così i tipi tornano senza conversioni forzate.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

export type Db = firebase.firestore.Firestore;
export type Dati = Record<string, unknown>;

export const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const regoleFirestore = readFileSync(path.join(radice, 'firestore.rules'), 'utf8');

/** Ogni file di test usa un proprio progetto demo: i dati non si mescolano tra file. */
export function ambiente(projectId: string): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({ projectId, firestore: { rules: regoleFirestore } });
}

/** Valore che le regole confrontano con request.time. */
export function oraServer(): firebase.firestore.FieldValue {
  return firebase.firestore.FieldValue.serverTimestamp();
}

/** Istante fisso per i dati preparati (diverso da request.time). */
export const ISTANTE_FISSO = firebase.firestore.Timestamp.fromMillis(1_763_380_800_000);

export function eliminaCampo(): firebase.firestore.FieldValue {
  return firebase.firestore.FieldValue.delete();
}

// ---------------------------------------------------------------------------------------------
// Chi agisce
// ---------------------------------------------------------------------------------------------

export const UID = {
  admin: 'uidAdmin',
  adminSpento: 'uidAdminSpento',
  coordA: 'uidCoordA',
  coordB: 'uidCoordB',
  senzaClaim: 'uidSenzaClaim',
  senzaClaimConDoc: 'uidSenzaClaimConDoc',
  claimNonValido: 'uidClaimNonValido',
  claimSenzaDoc: 'uidClaimSenzaDoc',
} as const;

export interface Attore {
  /** Nome leggibile nel titolo del test. */
  readonly nome: string;
  /** null = non autenticato. */
  readonly uid: string | null;
  readonly claims: Dati;
  /** Modifica dei dati di base prima dell'operazione (es. utente disattivato). */
  readonly prepara?: (db: Db) => Promise<void>;
}

export const ANONIMO: Attore = { nome: 'anonimo', uid: null, claims: {} };
export const ADMIN: Attore = { nome: 'ADMIN', uid: UID.admin, claims: { ruolo: 'ADMIN' } };
/** Coordinatore A: proprietario di repartoA e repartoC. */
export const COORD_A: Attore = {
  nome: 'coordinatore A',
  uid: UID.coordA,
  claims: { ruolo: 'COORDINATORE' },
};
/** Coordinatore B: proprietario di repartoB, estraneo a repartoA. */
export const COORD_B: Attore = {
  nome: 'coordinatore B',
  uid: UID.coordB,
  claims: { ruolo: 'COORDINATORE' },
};

/** Varianti della colonna «Senza ruolo» della matrice (ARCHITETTURA §7). */
export const SENZA_RUOLO: readonly Attore[] = [
  { nome: 'autenticato senza claim', uid: UID.senzaClaim, claims: {} },
  {
    nome: 'senza claim ma con documento utente attivo',
    uid: UID.senzaClaimConDoc,
    claims: {},
  },
  { nome: 'claim non valido', uid: UID.claimNonValido, claims: { ruolo: 'SUPERADMIN' } },
  {
    nome: 'claim ADMIN senza documento utente',
    uid: UID.claimSenzaDoc,
    claims: { ruolo: 'ADMIN' },
  },
  {
    nome: 'claim ADMIN su utente COORDINATORE (token e documento discordi)',
    uid: UID.coordA,
    claims: { ruolo: 'ADMIN' },
  },
  { nome: 'ADMIN disattivato', uid: UID.adminSpento, claims: { ruolo: 'ADMIN' } },
  {
    nome: 'coordinatore A disattivato (proprietario)',
    uid: UID.coordA,
    claims: { ruolo: 'COORDINATORE' },
    prepara: async (db) => {
      await db.doc(`utenti/${UID.coordA}`).update({ attivo: false });
    },
  },
];

const contesti = new WeakMap<RulesTestEnvironment, Map<string, RulesTestContext>>();

/** Istanza Firestore dell'attore (i contesti sono riusati per non creare centinaia di app). */
export function dbDi(env: RulesTestEnvironment, attore: Attore): Db {
  let perAmbiente = contesti.get(env);
  if (perAmbiente === undefined) {
    perAmbiente = new Map();
    contesti.set(env, perAmbiente);
  }
  const chiave = `${attore.uid ?? '-'}|${JSON.stringify(attore.claims)}`;
  let contesto = perAmbiente.get(chiave);
  if (contesto === undefined) {
    contesto =
      attore.uid === null
        ? env.unauthenticatedContext()
        : env.authenticatedContext(attore.uid, attore.claims);
    perAmbiente.set(chiave, contesto);
  }
  return contesto.firestore();
}

// ---------------------------------------------------------------------------------------------
// Documenti validi (ARCHITETTURA §5), con il tempo dato: oraServer() per le scritture del browser,
// ISTANTE_FISSO per i dati preparati.
// ---------------------------------------------------------------------------------------------

export const REPARTO_A = 'repartoA'; // coordA, configurazione completata
export const REPARTO_B = 'repartoB'; // coordB, configurazione completata
export const REPARTO_C = 'repartoC'; // coordA, configurazione in corso (passo 'turni')
export const MESE_BOZZA = '2026-11';
export const MESE_CONVALIDATO = '2026-10';
export const DIP_1 = 'dip1';

type Tempo = unknown;

export function utente(ruolo: string, attivo: boolean, quando: Tempo = ISTANTE_FISSO): Dati {
  return {
    nome: 'Nome',
    cognome: 'Cognome',
    email: 'utente@esempio.it',
    ruolo,
    attivo,
    creatoIl: quando,
    creatoDa: null,
    aggiornatoIl: quando,
  };
}

export function reparto(uid: string, altro: Dati = {}, quando: Tempo = oraServer()): Dati {
  return {
    nome: 'Cardiologia',
    coordinatoreUid: uid,
    configurazione: { passo: 'turni' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: quando,
    creatoDa: uid,
    aggiornatoIl: quando,
    aggiornatoDa: uid,
    ...altro,
  };
}

export function turno(codice: string, altro: Dati = {}, quando: Tempo = oraServer()): Dati {
  return {
    codice,
    tipo: 'turno',
    nome: 'Mattina',
    colore: 'azzurro',
    inizio: '07:00',
    fine: '14:00',
    pausaMinuti: 30,
    notturno: false,
    attivo: true,
    ordine: 1,
    creatoIl: quando,
    aggiornatoIl: quando,
    ...altro,
  };
}

export function reperibilita(codice: string, altro: Dati = {}, quando: Tempo = oraServer()): Dati {
  return turno(
    codice,
    {
      tipo: 'reperibilita',
      nome: 'Reperibilità notte',
      colore: null,
      inizio: '20:00',
      fine: '08:00',
      pausaMinuti: 0,
      notturno: true,
      ...altro,
    },
    quando,
  );
}

export function assenza(codice: string, altro: Dati = {}, quando: Tempo = oraServer()): Dati {
  const predefinite: Record<string, Dati> = {
    R: { descrizione: 'Riposo', effetto: 'comeRiposo', malattia: false, predefinita: true },
    MA: { descrizione: 'Malattia', effetto: 'neutra', malattia: true, predefinita: true },
  };
  return {
    codice,
    descrizione: 'Ferie',
    effetto: 'neutra',
    malattia: false,
    predefinita: false,
    attivo: true,
    ordine: 3,
    ...predefinite[codice],
    creatoIl: quando,
    aggiornatoIl: quando,
    ...altro,
  };
}

export function mese(
  chiave: string,
  uid: string,
  altro: Dati = {},
  quando: Tempo = oraServer(),
): Dati {
  const [anno, numero] = chiave.split('-').map(Number);
  return {
    chiave,
    anno,
    mese: numero,
    stato: 'bozza',
    calendario: { festivita: {}, attribuzioneNotte: 'inizio' },
    creatoIl: quando,
    creatoDa: uid,
    aggiornatoIl: quando,
    aggiornatoDa: uid,
    convalidatoIl: null,
    convalidatoDa: null,
    convalidatoDaNome: null,
    ...altro,
  };
}

/** Una cella completa: la forma interna non è verificata dalle regole (L4), ma deve passare. */
export const CELLA_ESEMPIO: Dati = {
  turno: { codice: 'M1', inizio: '07:00', fine: '14:00', pausaMinuti: 30, notturno: false },
  assenza: null,
  reperibilita: [
    {
      codice: 'R2',
      inizio: '20:00',
      fine: '08:00',
      chiamate: [{ durataMinuti: 45, oraInizio: '23:10' }],
      sostituisce: null,
      copertaDa: null,
    },
  ],
  orarioReale: { inizio: '07:00', fine: '14:30' },
  sostituisce: null,
  copertoDa: null,
};

export function riga(
  did: string,
  uid: string,
  altro: Dati = {},
  quando: Tempo = oraServer(),
): Dati {
  return {
    dipendenteId: did,
    contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
    giorni: {},
    versione: 1,
    aggiornatoDa: uid,
    aggiornatoIl: quando,
    ...altro,
  };
}

/** Copia del documento senza il campo indicato. */
export function senzaCampo(dati: Dati, campo: string): Dati {
  const copia = { ...dati };
  delete copia[campo];
  return copia;
}

/** Documento generico per le raccolte non scrivibili dal browser. */
export function generico(altro: Dati = {}): Dati {
  return { dipendenteId: DIP_1, valore: 1, ...altro };
}

// ---------------------------------------------------------------------------------------------
// Dati di base
// ---------------------------------------------------------------------------------------------

const F = ISTANTE_FISSO;

export const DATI_BASE: readonly (readonly [string, Dati])[] = [
  [`utenti/${UID.admin}`, utente('ADMIN', true)],
  [`utenti/${UID.adminSpento}`, utente('ADMIN', false)],
  [`utenti/${UID.coordA}`, utente('COORDINATORE', true)],
  [`utenti/${UID.coordB}`, utente('COORDINATORE', true)],
  [`utenti/${UID.senzaClaimConDoc}`, utente('COORDINATORE', true)],
  [`utenti/${UID.claimNonValido}`, utente('SUPERADMIN', true)],

  [`reparti/${REPARTO_A}`, reparto(UID.coordA, { configurazione: { passo: 'completata' } }, F)],
  [`reparti/${REPARTO_B}`, reparto(UID.coordB, { configurazione: { passo: 'completata' } }, F)],
  [`reparti/${REPARTO_C}`, reparto(UID.coordA, {}, F)],

  [`reparti/${REPARTO_A}/turni/M1`, turno('M1', {}, F)],
  [`reparti/${REPARTO_A}/turni/R2`, reperibilita('R2', {}, F)],
  [`reparti/${REPARTO_B}/turni/M1`, turno('M1', {}, F)],
  [`reparti/${REPARTO_C}/turni/M1`, turno('M1', {}, F)],

  [`reparti/${REPARTO_A}/assenze/R`, assenza('R', {}, F)],
  [`reparti/${REPARTO_A}/assenze/MA`, assenza('MA', {}, F)],
  [`reparti/${REPARTO_A}/assenze/F`, assenza('F', {}, F)],
  [`reparti/${REPARTO_B}/assenze/R`, assenza('R', {}, F)],
  [`reparti/${REPARTO_C}/assenze/R`, assenza('R', {}, F)],
  [`reparti/${REPARTO_C}/assenze/MA`, assenza('MA', {}, F)],
  [`reparti/${REPARTO_C}/assenze/F`, assenza('F', {}, F)],

  [
    `reparti/${REPARTO_A}/dipendenti/${DIP_1}`,
    {
      nome: 'Mario',
      cognome: 'Bianchi',
      oreSettimanali: 36,
      turniEsclusi: [],
      dataAssunzione: null,
      dataCessazione: null,
      attivo: true,
      creatoIl: F,
      aggiornatoIl: F,
      aggiornatoDa: UID.coordA,
    },
  ],
  [
    `reparti/${REPARTO_A}/dipendenti/${DIP_1}/privato/dati`,
    {
      codiceFiscaleCifrato: 'cifrato',
      dataNascitaCifrata: 'cifrata',
      hmacCodiceFiscale: 'abc',
      email: 'dipendente@esempio.it',
      chiaveKms: 'emulatore-non-sicura',
      aggiornatoIl: F,
    },
  ],

  [`reparti/${REPARTO_A}/mesi/${MESE_BOZZA}`, mese(MESE_BOZZA, UID.coordA, {}, F)],
  [
    `reparti/${REPARTO_A}/mesi/${MESE_BOZZA}/righe/${DIP_1}`,
    riga(DIP_1, UID.coordA, { versione: 3, giorni: { '05': CELLA_ESEMPIO } }, F),
  ],
  [
    `reparti/${REPARTO_A}/mesi/${MESE_CONVALIDATO}`,
    mese(
      MESE_CONVALIDATO,
      UID.coordA,
      {
        stato: 'convalidato',
        convalidatoIl: F,
        convalidatoDa: UID.coordA,
        convalidatoDaNome: 'N C',
      },
      F,
    ),
  ],
  [
    `reparti/${REPARTO_A}/mesi/${MESE_CONVALIDATO}/righe/${DIP_1}`,
    riga(DIP_1, UID.coordA, { versione: 5 }, F),
  ],
  [`reparti/${REPARTO_B}/mesi/${MESE_BOZZA}`, mese(MESE_BOZZA, UID.coordB, {}, F)],
  [`reparti/${REPARTO_B}/mesi/${MESE_BOZZA}/righe/dip9`, riga('dip9', UID.coordB, {}, F)],

  [`reparti/${REPARTO_A}/riepiloghi/${MESE_BOZZA}_${DIP_1}`, generico()],
  [`reparti/${REPARTO_A}/bancaOre/2026_${DIP_1}`, generico()],
  [`reparti/${REPARTO_A}/report/2026-B6`, generico()],
  [
    `reparti/${REPARTO_A}/registroAttivita/voce1`,
    { tipo: 'reparto.assegnato', repartoId: REPARTO_A, il: F },
  ],
  [`registroAttivita/voce0`, { tipo: 'utente.creato', repartoId: null, il: F }],
  [`indiceCodiciFiscali/hmac1`, { repartoId: REPARTO_A, dipendenteId: DIP_1, creatoIl: F }],
  [`mail/mail1`, { to: ['dipendente@esempio.it'], message: { subject: 'Report' } }],
  [`altro/doc1`, { valore: 1 }],
];

/** Svuota l'emulatore e scrive i dati di base, poi le aggiunte facoltative, senza regole. */
export async function semina(
  env: RulesTestEnvironment,
  aggiunte?: (db: Db) => Promise<void>,
): Promise<void> {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (contesto) => {
    const db = contesto.firestore();
    const batch = db.batch();
    for (const [percorso, dati] of DATI_BASE) {
      batch.set(db.doc(percorso), dati);
    }
    await batch.commit();
    if (aggiunte !== undefined) {
      await aggiunte(db);
    }
  });
}

/** Esegue fn con le regole disattivate (preparazione di un caso). */
export async function senzaRegole(
  env: RulesTestEnvironment,
  fn: (db: Db) => Promise<void>,
): Promise<void> {
  await env.withSecurityRulesDisabled((contesto) => fn(contesto.firestore()));
}
