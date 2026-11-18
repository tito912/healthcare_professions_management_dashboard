// Condizioni delle celle «C» di reparti/{rid}/mesi/{mid}/righe/{did} (ARCHITETTURA §5.9, §7, D2, L4).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  CELLA_ESEMPIO,
  COORD_A,
  DIP_1,
  ISTANTE_FISSO,
  MESE_BOZZA,
  MESE_CONVALIDATO,
  REPARTO_A,
  REPARTO_B,
  UID,
  ambiente,
  dbDi,
  eliminaCampo,
  mese,
  oraServer,
  riga,
  semina,
  senzaCampo,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-righe');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);
const percorsoMese = (mid: string, rid = REPARTO_A) => `reparti/${rid}/mesi/${mid}`;
const percorsoRiga = (mid: string, did: string, rid = REPARTO_A) =>
  `${percorsoMese(mid, rid)}/righe/${did}`;
const contratto = (altro: Dati) => ({
  contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null, ...altro },
});

describe('righe: create', () => {
  it('consentito: «Aggiungi mese», mese e righe nello stesso batch (getAfter)', async () => {
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc(percorsoMese('2026-12')), mese('2026-12', UID.coordA));
    batch.set(db.doc(percorsoRiga('2026-12', DIP_1)), riga(DIP_1, UID.coordA));
    batch.set(db.doc(percorsoRiga('2026-12', 'dip2')), riga('dip2', UID.coordA));
    await assertSucceeds(batch.commit());
  });

  it.each<[string, Dati]>([
    ['riga vuota', riga('dip2', UID.coordA)],
    [
      'riga con celle complete',
      riga('dip2', UID.coordA, { giorni: { '01': CELLA_ESEMPIO, '31': CELLA_ESEMPIO } }),
    ],
    ['ore settimanali a mezz’ora', riga('dip2', UID.coordA, contratto({ oreSettimanali: 36.5 }))],
    [
      'date di assunzione e cessazione',
      riga(
        'dip2',
        UID.coordA,
        contratto({ dataAssunzione: '2026-11-10', dataCessazione: '2026-11-20' }),
      ),
    ],
  ])('consentito: %s', async (_caso, dati) => {
    await assertSucceeds(comeA().doc(percorsoRiga(MESE_BOZZA, 'dip2')).set(dati));
  });

  it.each<[string, Dati]>([
    ['versione iniziale 2', riga('dip2', UID.coordA, { versione: 2 })],
    ['dipendenteId diverso dall’ID', riga('dip3', UID.coordA)],
    ['aggiornatoDa altrui', riga('dip2', UID.coordB)],
    ['aggiornatoIl diverso da request.time', riga('dip2', UID.coordA, {}, ISTANTE_FISSO)],
    ['giorno 32', riga('dip2', UID.coordA, { giorni: { '32': CELLA_ESEMPIO } })],
    ['giorno 00', riga('dip2', UID.coordA, { giorni: { '00': CELLA_ESEMPIO } })],
    ['giorno senza zero', riga('dip2', UID.coordA, { giorni: { '5': CELLA_ESEMPIO } })],
    ['giorni come lista', riga('dip2', UID.coordA, { giorni: [] })],
    ['contratto con un campo in più', riga('dip2', UID.coordA, contratto({ nome: 'Mario' }))],
    [
      'contratto senza cessazione',
      riga('dip2', UID.coordA, { contratto: { oreSettimanali: 36, dataAssunzione: null } }),
    ],
    ['ore settimanali 0', riga('dip2', UID.coordA, contratto({ oreSettimanali: 0 }))],
    ['ore settimanali 49', riga('dip2', UID.coordA, contratto({ oreSettimanali: 49 }))],
    ['ore settimanali 36,25', riga('dip2', UID.coordA, contratto({ oreSettimanali: 36.25 }))],
    ['ore settimanali come stringa', riga('dip2', UID.coordA, contratto({ oreSettimanali: '36' }))],
    [
      'data di assunzione non valida',
      riga('dip2', UID.coordA, contratto({ dataAssunzione: '2026-13-01' })),
    ],
    [
      'data di cessazione non stringa',
      riga('dip2', UID.coordA, contratto({ dataCessazione: 20261120 })),
    ],
    ['campo in più (nome del dipendente)', riga('dip2', UID.coordA, { nome: 'Mario Bianchi' })],
    ['campo mancante', senzaCampo(riga('dip2', UID.coordA), 'contratto')],
  ])('negato: %s', async (_caso, dati) => {
    await assertFails(comeA().doc(percorsoRiga(MESE_BOZZA, 'dip2')).set(dati));
  });

  it('negato: riga nuova su un mese convalidato (D2)', async () => {
    await assertFails(
      comeA().doc(percorsoRiga(MESE_CONVALIDATO, 'dip2')).set(riga('dip2', UID.coordA)),
    );
  });

  it('negato: riga sotto un mese inesistente', async () => {
    await assertFails(comeA().doc(percorsoRiga('2027-05', DIP_1)).set(riga(DIP_1, UID.coordA)));
  });

  it('negato: righe nel reparto di B, anche con il mese nello stesso batch', async () => {
    const db = comeA();
    await assertFails(
      db.doc(percorsoRiga(MESE_BOZZA, 'dip2', REPARTO_B)).set(riga('dip2', UID.coordA)),
    );
    const batch = db.batch();
    batch.set(db.doc(percorsoMese('2026-12', REPARTO_B)), mese('2026-12', UID.coordA));
    batch.set(db.doc(percorsoRiga('2026-12', 'dip2', REPARTO_B)), riga('dip2', UID.coordA));
    await assertFails(batch.commit());
  });
});

describe('righe: update', () => {
  const aggiorna = (mid: string, campi: Dati) =>
    comeA()
      .doc(percorsoRiga(mid, DIP_1))
      .update({ aggiornatoIl: oraServer(), aggiornatoDa: UID.coordA, ...campi });

  it.each<[string, Dati]>([
    ['versione + 1 con una cella nuova', { versione: 4, 'giorni.06': CELLA_ESEMPIO }],
    ['versione + 1 con un giorno svuotato', { versione: 4, 'giorni.05': eliminaCampo() }],
    ['versione + 1 e contratto allineato', { versione: 4, ...contratto({ oreSettimanali: 30 }) }],
  ])('consentito: %s', async (_caso, campi) => {
    await assertSucceeds(aggiorna(MESE_BOZZA, campi));
  });

  it.each<[string, Dati]>([
    ['versione non incrementata', { versione: 3, giorni: {} }],
    ['versione + 2', { versione: 5 }],
    ['versione all’indietro', { versione: 2 }],
    ['senza versione', {}],
    ['cambio di dipendenteId', { versione: 4, dipendenteId: 'dip2' }],
    ['aggiornatoDa altrui', { versione: 4, aggiornatoDa: UID.coordB }],
    ['aggiornatoIl diverso da request.time', { versione: 4, aggiornatoIl: ISTANTE_FISSO }],
    ['giorno 32', { versione: 4, 'giorni.32': CELLA_ESEMPIO }],
    ['campo in più', { versione: 4, valida: true }],
  ])('negato: %s', async (_caso, campi) => {
    await assertFails(aggiorna(MESE_BOZZA, campi));
  });

  it('negato: scrittura su una riga di un mese convalidato (D2)', async () => {
    await assertFails(aggiorna(MESE_CONVALIDATO, { versione: 6, 'giorni.03': CELLA_ESEMPIO }));
    await assertFails(
      comeA()
        .doc(percorsoRiga(MESE_CONVALIDATO, DIP_1))
        .set(riga(DIP_1, UID.coordA, { versione: 6 })),
    );
  });

  // Review 1.1, rilievo 4: non distingue get() da getAfter() nella regola della riga, perché la
  // scrittura del mese è negata già da sola. Prova di regressione del batch; la difesa vera è che lo
  // stato del mese non cambia mai dal browser («negato su mese convalidato» in mesi.test.ts).
  it('negato: riapertura del mese e modifica della riga in un batch (basta la regola del mese)', async () => {
    const db = comeA();
    const batch = db.batch();
    batch.update(db.doc(percorsoMese(MESE_CONVALIDATO)), {
      stato: 'bozza',
      aggiornatoIl: oraServer(),
      aggiornatoDa: UID.coordA,
    });
    batch.update(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_1)), {
      versione: 6,
      aggiornatoIl: oraServer(),
      aggiornatoDa: UID.coordA,
    });
    await assertFails(batch.commit());
  });

  it('consentito: sostituzione, due righe salvate nella stessa transazione', async () => {
    await semina(env, async (db) => {
      await db
        .doc(percorsoRiga(MESE_BOZZA, 'dip2'))
        .set(riga('dip2', UID.coordA, {}, ISTANTE_FISSO));
    });
    const db = comeA();
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        const meseDoc = await tx.get(db.doc(percorsoMese(MESE_BOZZA)));
        const a = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, DIP_1)));
        const b = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, 'dip2')));
        if (meseDoc.get('stato') !== 'bozza') throw new Error('mese non in bozza');
        const comune = { aggiornatoIl: oraServer(), aggiornatoDa: UID.coordA };
        tx.update(a.ref, {
          ...comune,
          versione: Number(a.get('versione')) + 1,
          'giorni.07': { ...CELLA_ESEMPIO, copertoDa: 'dip2' },
        });
        tx.update(b.ref, {
          ...comune,
          versione: Number(b.get('versione')) + 1,
          'giorni.07': { ...CELLA_ESEMPIO, sostituisce: DIP_1 },
        });
      }),
    );
  });
});
