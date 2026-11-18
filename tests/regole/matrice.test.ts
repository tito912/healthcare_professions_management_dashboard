// Matrice delle Security Rules di ARCHITETTURA §7, cella per cella: ogni riga è un'operazione su un
// percorso, ogni colonna un tipo di utente. Le celle «C» sono provate qui nel caso che soddisfa le
// condizioni; i casi negati delle condizioni sono nei file per raccolta (reparti, turni, …).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ADMIN,
  ANONIMO,
  COORD_A,
  COORD_B,
  DIP_1,
  MESE_BOZZA,
  REPARTO_A,
  REPARTO_C,
  SENZA_RUOLO,
  UID,
  ambiente,
  assenza,
  dbDi,
  generico,
  mese,
  oraServer,
  reparto,
  riga,
  semina,
  senzaRegole,
  turno,
  utente,
  type Attore,
  type Db,
} from './aiuti';

interface Atteso {
  readonly anonimo: boolean;
  readonly senzaRuolo: boolean;
  readonly admin: boolean;
  readonly coordP: boolean;
  /** null: non applicabile (—). */
  readonly coordA: boolean | null;
}

interface Caso {
  readonly percorso: string;
  readonly operazione: string;
  readonly atteso: Atteso;
  /** uid: chi agisce ('anonimo' se non autenticato). */
  readonly esegui: (db: Db, uid: string) => Promise<unknown>;
}

const NESSUNO: Atteso = {
  anonimo: false,
  senzaRuolo: false,
  admin: false,
  coordP: false,
  coordA: false,
};
const LETTORI: Atteso = { ...NESSUNO, admin: true, coordP: true };
const SOLO_PROPRIETARIO: Atteso = { ...NESSUNO, coordP: true };
const SOLO_ADMIN: Atteso = { ...NESSUNO, admin: true };

const RA = `reparti/${REPARTO_A}`;

function letture(percorsoDoc: string, raccolta: string, atteso: Atteso): Caso[] {
  return [
    { percorso: percorsoDoc, operazione: 'get', atteso, esegui: (db) => db.doc(percorsoDoc).get() },
    {
      percorso: raccolta,
      operazione: 'list',
      atteso,
      esegui: (db) => db.collection(raccolta).get(),
    },
  ];
}

/** Raccolte scritte solo dalle Functions: lettura come indicato, nessuna scrittura dal browser. */
function soloFunctions(percorsoDoc: string, raccolta: string, lettura: Atteso): Caso[] {
  return [
    ...letture(percorsoDoc, raccolta, lettura),
    {
      percorso: raccolta,
      operazione: 'create',
      atteso: NESSUNO,
      esegui: (db) => db.doc(`${raccolta}/nuovo`).set(generico()),
    },
    {
      percorso: percorsoDoc,
      operazione: 'update',
      atteso: NESSUNO,
      esegui: (db) => db.doc(percorsoDoc).update({ valore: 2 }),
    },
    {
      percorso: percorsoDoc,
      operazione: 'delete',
      atteso: NESSUNO,
      esegui: (db) => db.doc(percorsoDoc).delete(),
    },
  ];
}

function altroCoordinatore(uid: string): string {
  return uid === UID.coordA ? UID.coordB : UID.coordA;
}

const CASI: readonly Caso[] = [
  // utenti/{uid}
  {
    percorso: 'utenti/{uid}',
    operazione: 'get del proprio documento',
    atteso: { ...LETTORI, coordA: true },
    esegui: (db, uid) => db.doc(`utenti/${uid}`).get(),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'get di un altro utente',
    atteso: SOLO_ADMIN,
    esegui: (db, uid) => db.doc(`utenti/${altroCoordinatore(uid)}`).get(),
  },
  {
    percorso: 'utenti',
    operazione: 'list',
    atteso: SOLO_ADMIN,
    esegui: (db) => db.collection('utenti').get(),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'create di un altro utente',
    atteso: NESSUNO,
    esegui: (db) => db.doc('utenti/uidNuovo').set(utente('COORDINATORE', true, oraServer())),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'create o set del proprio documento come ADMIN',
    atteso: NESSUNO,
    esegui: (db, uid) => db.doc(`utenti/${uid}`).set(utente('ADMIN', true, oraServer())),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'update del proprio ruolo',
    atteso: NESSUNO,
    esegui: (db, uid) => db.doc(`utenti/${uid}`).update({ ruolo: 'ADMIN' }),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'update di attivo di un altro utente',
    atteso: NESSUNO,
    esegui: (db, uid) => db.doc(`utenti/${altroCoordinatore(uid)}`).update({ attivo: false }),
  },
  {
    percorso: 'utenti/{uid}',
    operazione: 'delete',
    atteso: NESSUNO,
    esegui: (db, uid) => db.doc(`utenti/${altroCoordinatore(uid)}`).delete(),
  },

  // reparti/{rid}
  { percorso: RA, operazione: 'get', atteso: LETTORI, esegui: (db) => db.doc(RA).get() },
  {
    percorso: 'reparti',
    operazione: 'list filtrata su coordinatoreUid == uid',
    atteso: { ...LETTORI, coordA: true },
    esegui: (db, uid) => db.collection('reparti').where('coordinatoreUid', '==', uid).get(),
  },
  {
    percorso: 'reparti',
    operazione: 'list senza filtro',
    atteso: SOLO_ADMIN,
    esegui: (db) => db.collection('reparti').get(),
  },
  {
    percorso: 'reparti/{rid}',
    operazione: 'create con sé come coordinatore',
    atteso: { ...SOLO_PROPRIETARIO, coordA: null },
    esegui: (db, uid) => db.doc('reparti/repartoNuovo').set(reparto(uid)),
  },
  {
    percorso: RA,
    operazione: 'update del nome',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db, uid) =>
      db.doc(RA).update({ nome: 'Cardiologia 2', aggiornatoIl: oraServer(), aggiornatoDa: uid }),
  },
  { percorso: RA, operazione: 'delete', atteso: NESSUNO, esegui: (db) => db.doc(RA).delete() },

  // turni
  ...letture(`${RA}/turni/M1`, `${RA}/turni`, LETTORI),
  {
    percorso: `${RA}/turni/{codice}`,
    operazione: 'create',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) =>
      db
        .doc(`${RA}/turni/P1`)
        .set(turno('P1', { nome: 'Pomeriggio', inizio: '14:00', fine: '22:00' })),
  },
  {
    percorso: `${RA}/turni/M1`,
    operazione: 'update',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) =>
      db.doc(`${RA}/turni/M1`).update({ nome: 'Mattina lunga', aggiornatoIl: oraServer() }),
  },
  {
    percorso: `reparti/${REPARTO_C}/turni/M1`,
    operazione: 'delete (configurazione in corso)',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) => db.doc(`reparti/${REPARTO_C}/turni/M1`).delete(),
  },

  // assenze
  ...letture(`${RA}/assenze/F`, `${RA}/assenze`, LETTORI),
  {
    percorso: `${RA}/assenze/{codice}`,
    operazione: 'create',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) =>
      db.doc(`${RA}/assenze/PS`).set(assenza('PS', { descrizione: 'Permesso studio' })),
  },
  {
    percorso: `${RA}/assenze/F`,
    operazione: 'update',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) =>
      db.doc(`${RA}/assenze/F`).update({ descrizione: 'Ferie estive', aggiornatoIl: oraServer() }),
  },
  {
    percorso: `reparti/${REPARTO_C}/assenze/F`,
    operazione: 'delete (configurazione in corso)',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db) => db.doc(`reparti/${REPARTO_C}/assenze/F`).delete(),
  },

  // dipendenti: scritti solo da salvaDipendente
  ...soloFunctions(`${RA}/dipendenti/${DIP_1}`, `${RA}/dipendenti`, LETTORI),

  // privato/dati: nessun accesso dal browser
  ...soloFunctions(
    `${RA}/dipendenti/${DIP_1}/privato/dati`,
    `${RA}/dipendenti/${DIP_1}/privato`,
    NESSUNO,
  ),

  // mesi
  ...letture(`${RA}/mesi/${MESE_BOZZA}`, `${RA}/mesi`, LETTORI),
  {
    percorso: `${RA}/mesi/{mid}`,
    operazione: 'create in bozza',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db, uid) => db.doc(`${RA}/mesi/2026-12`).set(mese('2026-12', uid)),
  },
  {
    percorso: `${RA}/mesi/${MESE_BOZZA}`,
    operazione: 'update del calendario in bozza',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db, uid) =>
      db.doc(`${RA}/mesi/${MESE_BOZZA}`).update({
        calendario: {
          festivita: { '08': { id: 'immacolata', nome: 'Immacolata' } },
          attribuzioneNotte: 'fine',
        },
        aggiornatoIl: oraServer(),
        aggiornatoDa: uid,
      }),
  },
  {
    percorso: `${RA}/mesi/${MESE_BOZZA}`,
    operazione: 'delete',
    atteso: NESSUNO,
    esegui: (db) => db.doc(`${RA}/mesi/${MESE_BOZZA}`).delete(),
  },

  // righe
  ...letture(`${RA}/mesi/${MESE_BOZZA}/righe/${DIP_1}`, `${RA}/mesi/${MESE_BOZZA}/righe`, LETTORI),
  {
    percorso: `${RA}/mesi/${MESE_BOZZA}/righe/{did}`,
    operazione: 'create su mese in bozza',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db, uid) => db.doc(`${RA}/mesi/${MESE_BOZZA}/righe/dip2`).set(riga('dip2', uid)),
  },
  {
    percorso: `${RA}/mesi/${MESE_BOZZA}/righe/${DIP_1}`,
    operazione: 'update con versione + 1',
    atteso: SOLO_PROPRIETARIO,
    esegui: (db, uid) =>
      db.doc(`${RA}/mesi/${MESE_BOZZA}/righe/${DIP_1}`).update({
        versione: 4,
        giorni: {},
        aggiornatoIl: oraServer(),
        aggiornatoDa: uid,
      }),
  },
  {
    percorso: `${RA}/mesi/${MESE_BOZZA}/righe/${DIP_1}`,
    operazione: 'delete',
    atteso: NESSUNO,
    esegui: (db) => db.doc(`${RA}/mesi/${MESE_BOZZA}/righe/${DIP_1}`).delete(),
  },

  // derivati e registro del reparto: lettura, nessuna scrittura
  ...soloFunctions(`${RA}/riepiloghi/${MESE_BOZZA}_${DIP_1}`, `${RA}/riepiloghi`, LETTORI),
  ...soloFunctions(`${RA}/bancaOre/2026_${DIP_1}`, `${RA}/bancaOre`, LETTORI),
  ...soloFunctions(`${RA}/report/2026-B6`, `${RA}/report`, LETTORI),
  ...soloFunctions(`${RA}/registroAttivita/voce1`, `${RA}/registroAttivita`, LETTORI),

  // registro radice e collection group: solo ADMIN
  ...soloFunctions('registroAttivita/voce0', 'registroAttivita', SOLO_ADMIN),
  {
    percorso: 'collection group registroAttivita',
    operazione: 'list',
    atteso: SOLO_ADMIN,
    esegui: (db) => db.collectionGroup('registroAttivita').get(),
  },

  // indice dei codici fiscali, coda email, percorsi non previsti: nessun accesso
  ...soloFunctions('indiceCodiciFiscali/hmac1', 'indiceCodiciFiscali', NESSUNO),
  ...soloFunctions('mail/mail1', 'mail', NESSUNO),
  ...soloFunctions('altro/doc1', 'altro', NESSUNO),
];

let env: RulesTestEnvironment;
/** I dati di base si riscrivono solo dopo una scrittura riuscita o una preparazione. */
let sporco = true;

beforeAll(async () => {
  env = await ambiente('demo-regole-matrice');
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  if (sporco) {
    await semina(env);
    sporco = false;
  }
});

async function verifica(attore: Attore, caso: Caso, consentito: boolean): Promise<void> {
  if (attore.prepara !== undefined) {
    sporco = true;
    await senzaRegole(env, attore.prepara);
  }
  const promessa = caso.esegui(dbDi(env, attore), attore.uid ?? 'anonimo');
  if (consentito) {
    sporco = true;
    await assertSucceeds(promessa);
  } else {
    await assertFails(promessa);
  }
}

function segno(consentito: boolean): string {
  return consentito ? '✓' : '✗';
}

describe.each(CASI)('$percorso — $operazione', (caso) => {
  it(`anonimo ${segno(caso.atteso.anonimo)}`, () => verifica(ANONIMO, caso, caso.atteso.anonimo));

  it.each(SENZA_RUOLO)(`senza ruolo ${segno(caso.atteso.senzaRuolo)}: $nome`, (attore) =>
    verifica(attore, caso, caso.atteso.senzaRuolo),
  );

  it(`ADMIN ${segno(caso.atteso.admin)}`, () => verifica(ADMIN, caso, caso.atteso.admin));

  it(`COORD-P ${segno(caso.atteso.coordP)}`, () => verifica(COORD_A, caso, caso.atteso.coordP));

  const coordA = caso.atteso.coordA;
  if (coordA !== null) {
    it(`COORD-A ${segno(coordA)} (coordinatore B sul reparto di A)`, () =>
      verifica(COORD_B, caso, coordA));
  }
});
