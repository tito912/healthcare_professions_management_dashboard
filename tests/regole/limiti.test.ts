// Limiti delle Security Rules su transazioni e batch (ARCHITETTURA §7 «Note per lo step 1.1», PIANO 1.1
// criterio 3, review 0.1 rilievo 18): al massimo 20 accessi a documenti (get/getAfter/exists) per
// richiesta e 1.000 espressioni. Le righe di un mese leggono gli stessi tre documenti (utente, reparto,
// mese): la prova dice se l'emulatore li conta una volta sola.
import { MAX_RIGHE_PER_TRANSAZIONE, CHIAVI_GIORNO } from '@turni/domain';
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CELLA_ESEMPIO,
  COORD_A,
  ISTANTE_FISSO,
  MESE_BOZZA,
  REPARTO_A,
  UID,
  ambiente,
  dbDi,
  mese,
  oraServer,
  riga,
  semina,
  type Dati,
} from './aiuti';

const RIGHE_REPARTO_GRANDE = 40;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-limiti');
});
afterAll(async () => {
  await env.cleanup();
});

const comeA = () => dbDi(env, COORD_A);
const percorsoMese = (mid: string) => `reparti/${REPARTO_A}/mesi/${mid}`;
const percorsoRiga = (mid: string, did: string) => `${percorsoMese(mid)}/righe/${did}`;
const idDipendenti = (n: number) =>
  Array.from({ length: n }, (_, i) => `dip${String(i + 1).padStart(3, '0')}`);

/** Un mese pieno: tutti i 31 giorni con turno, reperibilità con chiamata e orario reale. */
const GIORNI_PIENI: Dati = Object.fromEntries(CHIAVI_GIORNO.map((g) => [g, CELLA_ESEMPIO]));

describe('«Salva bozza»: transazione sulle righe di un mese', () => {
  beforeEach(async () => {
    await semina(env, async (db) => {
      const batch = db.batch();
      for (const did of idDipendenti(RIGHE_REPARTO_GRANDE)) {
        batch.set(db.doc(percorsoRiga(MESE_BOZZA, did)), riga(did, UID.coordA, {}, ISTANTE_FISSO));
      }
      await batch.commit();
    });
  });

  it(`consentita con ${RIGHE_REPARTO_GRANDE} righe piene (31 giorni ciascuna)`, async () => {
    const db = comeA();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        const meseDoc = await tx.get(db.doc(percorsoMese(MESE_BOZZA)));
        expect(meseDoc.get('stato')).toBe('bozza');
        const righe = await Promise.all(
          idDipendenti(RIGHE_REPARTO_GRANDE).map((did) =>
            tx.get(db.doc(percorsoRiga(MESE_BOZZA, did))),
          ),
        );
        for (const r of righe) {
          tx.update(r.ref, {
            versione: Number(r.get('versione')) + 1,
            giorni: GIORNI_PIENI,
            aggiornatoIl: oraServer(),
            aggiornatoDa: UID.coordA,
          });
        }
      }),
    );
  });

  it('respinta per intero se una sola riga non incrementa la versione', async () => {
    const db = comeA();
    const batch = db.batch();
    idDipendenti(RIGHE_REPARTO_GRANDE).forEach((did, i) => {
      batch.update(db.doc(percorsoRiga(MESE_BOZZA, did)), {
        versione: i === 17 ? 1 : 2,
        aggiornatoIl: oraServer(),
        aggiornatoDa: UID.coordA,
      });
    });
    await assertFails(batch.commit());
  });
});

describe('«Aggiungi mese»: batch con il mese e le righe create (getAfter sul mese)', () => {
  beforeEach(async () => {
    await semina(env);
  });

  async function aggiungiMese(mid: string, n: number): Promise<void> {
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc(percorsoMese(mid)), mese(mid, UID.coordA));
    for (const did of idDipendenti(n)) {
      batch.set(db.doc(percorsoRiga(mid, did)), riga(did, UID.coordA));
    }
    await batch.commit();
  }

  it(`consentito con ${RIGHE_REPARTO_GRANDE} righe`, async () => {
    await assertSucceeds(aggiungiMese('2026-12', RIGHE_REPARTO_GRANDE));
  });

  it(`consentito con MAX_RIGHE_PER_TRANSAZIONE (${MAX_RIGHE_PER_TRANSAZIONE}) righe`, async () => {
    await assertSucceeds(aggiungiMese('2027-01', MAX_RIGHE_PER_TRANSAZIONE));
  });
});
