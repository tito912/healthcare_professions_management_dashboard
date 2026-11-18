// Dati dei dipendenti (PIANO 1.4, criterio 6): i dati riservati (`privato/dati`) e l'indice dei codici fiscali
// non si leggono né si scrivono dal browser per nessun ruolo; il documento pubblico si legge ma non si scrive
// (lo scrive solo salvaDipendente, con l'Admin SDK). La matrice dello step 1.1 copre già le celle; qui si
// provano i casi mirati con i documenti nella forma che salvaDipendente scrive davvero.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ADMIN,
  ANONIMO,
  COORD_A,
  COORD_B,
  DIP_1,
  REPARTO_A,
  SENZA_RUOLO,
  ambiente,
  dbDi,
  oraServer,
  semina,
  type Attore,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-dipendenti');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

/** Alcune varianti (utente disattivato) modificano i dati di base prima dell'operazione. */
async function prepara(attore: Attore): Promise<void> {
  const operazione = attore.prepara;
  if (operazione !== undefined) {
    await env.withSecurityRulesDisabled(async (contesto) => {
      await operazione(contesto.firestore());
    });
  }
}

const TUTTI: readonly Attore[] = [ANONIMO, ...SENZA_RUOLO, ADMIN, COORD_A, COORD_B];
const PERCORSO_PRIVATO = `reparti/${REPARTO_A}/dipendenti/${DIP_1}/privato/dati`;
const PERCORSO_DIPENDENTE = `reparti/${REPARTO_A}/dipendenti/${DIP_1}`;

/** `privato/dati` come lo scrive salvaDipendente (ARCHITETTURA §5.6). */
function datiPrivati(quando: unknown): Record<string, unknown> {
  return {
    codiceFiscaleCifrato: 'AAECAw==',
    dataNascitaCifrata: 'BAUGBw==',
    hmacCodiceFiscale: 'a'.repeat(64),
    email: 'laura.bianchi@ospedale.it',
    chiaveKms: 'emulatore-non-sicura',
    aggiornatoIl: quando,
  };
}

function dipendente(quando: unknown): Record<string, unknown> {
  return {
    nome: 'Laura',
    cognome: 'Bianchi',
    oreSettimanali: 36,
    turniEsclusi: ['N1'],
    dataAssunzione: null,
    dataCessazione: null,
    attivo: true,
    creatoIl: quando,
    aggiornatoIl: quando,
    aggiornatoDa: 'uidCoordA',
  };
}

describe('privato/dati: illeggibile e non scrivibile dal browser', () => {
  it.each(TUTTI.map((a) => [a.nome, a] as const))('%s: nessun accesso', async (_nome, attore) => {
    await prepara(attore);
    const db = dbDi(env, attore);
    await assertFails(db.doc(PERCORSO_PRIVATO).get());
    await assertFails(db.collection(`${PERCORSO_DIPENDENTE}/privato`).get());
    await assertFails(db.doc(PERCORSO_PRIVATO).set(datiPrivati(oraServer())));
    await assertFails(db.doc(PERCORSO_PRIVATO).set(datiPrivati(oraServer()), { merge: true }));
    await assertFails(db.doc(PERCORSO_PRIVATO).update({ email: 'altra@esempio.it' }));
    await assertFails(db.doc(PERCORSO_PRIVATO).delete());
  });

  it('nemmeno con una query mirata sul contenuto (email, hmac) né con il collection group', async () => {
    for (const attore of [ADMIN, COORD_A]) {
      const db = dbDi(env, attore);
      await assertFails(
        db
          .collection(`${PERCORSO_DIPENDENTE}/privato`)
          .where('email', '==', 'dipendente@esempio.it')
          .get(),
      );
      await assertFails(
        db.collectionGroup('privato').where('hmacCodiceFiscale', '==', 'abc').get(),
      );
      await assertFails(db.collectionGroup('privato').get());
    }
  });

  it('un dipendente nuovo: il browser non può creare i suoi dati riservati nemmeno nel proprio reparto', async () => {
    await assertFails(
      dbDi(env, COORD_A)
        .doc(`reparti/${REPARTO_A}/dipendenti/nuovo/privato/dati`)
        .set(datiPrivati(oraServer())),
    );
  });
});

describe('indiceCodiciFiscali: illeggibile e non scrivibile dal browser', () => {
  const indice = (quando: unknown) => ({
    repartoId: REPARTO_A,
    dipendenteId: DIP_1,
    creatoIl: quando,
  });

  it.each(TUTTI.map((a) => [a.nome, a] as const))('%s: nessun accesso', async (_nome, attore) => {
    await prepara(attore);
    const db = dbDi(env, attore);
    await assertFails(db.doc('indiceCodiciFiscali/hmac1').get());
    // Un codice fiscale non ancora presente: la lettura deve fallire comunque, così non si scopre
    // l'esistenza di un doppione provando valori.
    await assertFails(db.doc(`indiceCodiciFiscali/${'b'.repeat(64)}`).get());
    await assertFails(db.collection('indiceCodiciFiscali').get());
    await assertFails(db.doc(`indiceCodiciFiscali/${'b'.repeat(64)}`).set(indice(oraServer())));
    await assertFails(db.doc('indiceCodiciFiscali/hmac1').delete());
  });
});

describe('dipendenti: leggibili da ADMIN e coordinatore proprietario, mai scrivibili dal browser', () => {
  it('lettura: sì per ADMIN e coordinatore proprietario, no per gli altri', async () => {
    await assertSucceeds(dbDi(env, ADMIN).doc(PERCORSO_DIPENDENTE).get());
    await assertSucceeds(dbDi(env, COORD_A).doc(PERCORSO_DIPENDENTE).get());
    await assertSucceeds(dbDi(env, COORD_A).collection(`reparti/${REPARTO_A}/dipendenti`).get());
    await assertFails(dbDi(env, COORD_B).doc(PERCORSO_DIPENDENTE).get());
    await assertFails(dbDi(env, COORD_B).collection(`reparti/${REPARTO_A}/dipendenti`).get());
    await assertFails(dbDi(env, ANONIMO).doc(PERCORSO_DIPENDENTE).get());
    for (const attore of SENZA_RUOLO) {
      await prepara(attore);
      await assertFails(dbDi(env, attore).doc(PERCORSO_DIPENDENTE).get());
    }
  });

  it.each(TUTTI.map((a) => [a.nome, a] as const))(
    '%s: nessuna scrittura (nemmeno con un documento identico a quello del server)',
    async (_nome, attore) => {
      await prepara(attore);
      const db = dbDi(env, attore);
      await assertFails(
        db.doc(`reparti/${REPARTO_A}/dipendenti/nuovo`).set(dipendente(oraServer())),
      );
      await assertFails(db.doc(PERCORSO_DIPENDENTE).set(dipendente(oraServer())));
      await assertFails(db.doc(PERCORSO_DIPENDENTE).update({ oreSettimanali: 30 }));
      await assertFails(db.doc(PERCORSO_DIPENDENTE).update({ attivo: false }));
      await assertFails(db.doc(PERCORSO_DIPENDENTE).delete());
    },
  );

  it('i dati letti dal browser non contengono nulla di riservato', async () => {
    const istantanea = await dbDi(env, COORD_A).doc(PERCORSO_DIPENDENTE).get();
    const campi = Object.keys(istantanea.data() ?? {});
    expect(campi).not.toEqual(
      expect.arrayContaining(['codiceFiscale', 'dataNascita', 'email', 'hmacCodiceFiscale']),
    );
  });
});
