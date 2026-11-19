// Scritture di consuntivo sulle righe (PIANO 3.1b criterio 1, D2, L4): orari reali, assenze, turni scoperti,
// sostituzioni e chiamate si scrivono dal browser nelle righe del mese in bozza, con «Salva bozza»; non esiste una
// callable di variazione. Le regole controllano forma di primo livello e autorizzazione: la forma della cella è
// del dominio (validaRiga, validaMese), quindi una cella con un valore sbagliato passa dalle regole (L4) ed è
// intercettata dal trigger e da convalidaMese (functions/test/consuntivo.emu.test.ts).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ADMIN,
  CELLA_ESEMPIO,
  COORD_A,
  COORD_B,
  DIP_1,
  ISTANTE_FISSO,
  MESE_BOZZA,
  MESE_CONVALIDATO,
  REPARTO_A,
  UID,
  ambiente,
  dbDi,
  oraServer,
  riga,
  semina,
  type Attore,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-consuntivo');
});
afterAll(async () => {
  await env.cleanup();
});

const DIP_2 = 'dip2';
const percorsoMese = (mid: string) => `reparti/${REPARTO_A}/mesi/${mid}`;
const percorsoRiga = (mid: string, did: string) => `${percorsoMese(mid)}/righe/${did}`;

const vuota: Dati = {
  turno: null,
  assenza: null,
  reperibilita: [],
  orarioReale: null,
  sostituisce: null,
  copertoDa: null,
};
const M1 = { codice: 'M1', inizio: '07:00', fine: '14:00', pausaMinuti: 30, notturno: false };
const reperibilita = (altro: Dati = {}) => ({
  codice: 'R2',
  inizio: '20:00',
  fine: '08:00',
  chiamate: [],
  sostituisce: null,
  copertaDa: null,
  ...altro,
});

// Le celle del consuntivo, come le scrive la griglia.
const MALATTIA = { codice: 'MA', effetto: 'neutra', malattia: true };
const ORARIO_REALE: Dati = {
  ...vuota,
  turno: M1,
  orarioReale: { inizio: '07:00', fine: '14:30' },
};
const SCOPERTO: Dati = { ...vuota, turno: M1, assenza: MALATTIA };
const COPERTO: Dati = { ...SCOPERTO, copertoDa: DIP_2 };
const SOSTITUTO: Dati = { ...vuota, turno: M1, sostituisce: DIP_1 };
const CELLE: readonly (readonly [string, Dati])[] = [
  ['orario reale', ORARIO_REALE],
  ['malattia su un turno (turno scoperto)', SCOPERTO],
  ['turno scoperto coperto da un collega', COPERTO],
  ['turno del sostituto', SOSTITUTO],
  ['ferie', { ...vuota, assenza: { codice: 'F', effetto: 'neutra', malattia: false } }],
  [
    'chiamata in reperibilità',
    {
      ...vuota,
      reperibilita: [reperibilita({ chiamate: [{ durataMinuti: 45, oraInizio: '23:10' }] })],
    },
  ],
  [
    'reperibilità scoperta e coperta',
    { ...vuota, assenza: MALATTIA, reperibilita: [reperibilita({ copertaDa: DIP_2 })] },
  ],
];

const comune = (versione: number, chi: string = UID.coordA) => ({
  versione,
  aggiornatoIl: oraServer(),
  aggiornatoDa: chi,
});

function preparaDueRighe(mid: string, statoConvalidato: boolean) {
  return semina(env, async (db) => {
    await db
      .doc(percorsoRiga(mid, DIP_2))
      .set(riga(DIP_2, UID.coordA, { versione: statoConvalidato ? 5 : 3 }, ISTANTE_FISSO));
  });
}

beforeEach(async () => {
  await preparaDueRighe(MESE_BOZZA, false);
});

describe('mese in bozza: il coordinatore proprietario scrive il consuntivo', () => {
  it.each(CELLE)('consentito: %s', async (_caso, cella) => {
    await assertSucceeds(
      dbDi(env, COORD_A)
        .doc(percorsoRiga(MESE_BOZZA, DIP_1))
        .update({ ...comune(4), 'giorni.07': cella }),
    );
  });

  it('consentito: più giorni e più campi nella stessa scrittura, anche togliendo un orario reale', async () => {
    const db = dbDi(env, COORD_A);
    await assertSucceeds(
      db.doc(percorsoRiga(MESE_BOZZA, DIP_1)).update({
        ...comune(4),
        'giorni.13': SCOPERTO,
        'giorni.14': SCOPERTO,
        'giorni.15': SCOPERTO,
        'giorni.05': { ...CELLA_ESEMPIO, orarioReale: null },
      }),
    );
  });

  it('consentito: sostituzione, due righe nella stessa transazione, e la sua rimozione', async () => {
    const db = dbDi(env, COORD_A);
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        const a = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, DIP_1)));
        const b = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, DIP_2)));
        tx.update(a.ref, { ...comune(Number(a.get('versione')) + 1), 'giorni.07': COPERTO });
        tx.update(b.ref, { ...comune(Number(b.get('versione')) + 1), 'giorni.07': SOSTITUTO });
      }),
    );
    await assertSucceeds(
      db.runTransaction(async (tx) => {
        const a = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, DIP_1)));
        const b = await tx.get(db.doc(percorsoRiga(MESE_BOZZA, DIP_2)));
        tx.update(a.ref, {
          ...comune(Number(a.get('versione')) + 1),
          'giorni.07': SCOPERTO,
        });
        tx.update(b.ref, { ...comune(Number(b.get('versione')) + 1), 'giorni.07': vuota });
      }),
    );
  });

  it('le regole non guardano dentro la cella (L4): un valore sbagliato passa, lo ferma il dominio', async () => {
    await assertSucceeds(
      dbDi(env, COORD_A)
        .doc(percorsoRiga(MESE_BOZZA, DIP_1))
        .update({ ...comune(4), 'giorni.07': { turno: 'sbagliato' } }),
    );
  });
});

describe.each<[string, Attore]>([
  ['un coordinatore non proprietario', COORD_B],
  ['l’ADMIN (sola consultazione)', ADMIN],
])('mese in bozza: %s non scrive il consuntivo', (_nome, chi) => {
  it.each(CELLE)('negato: %s', async (_caso, cella) => {
    await assertFails(
      dbDi(env, chi)
        .doc(percorsoRiga(MESE_BOZZA, DIP_1))
        .update({ ...comune(4, chi.uid ?? ''), 'giorni.07': cella }),
    );
  });

  it('negato: anche con aggiornatoDa del proprietario e riga nuova', async () => {
    await assertFails(
      dbDi(env, chi)
        .doc(percorsoRiga(MESE_BOZZA, DIP_1))
        .update({ ...comune(4), 'giorni.07': ORARIO_REALE }),
    );
    await assertFails(
      dbDi(env, chi)
        .doc(percorsoRiga(MESE_BOZZA, 'dip9'))
        .set(riga('dip9', chi.uid ?? '', { giorni: { '07': ORARIO_REALE } })),
    );
  });
});

describe('mese convalidato (D2): nessuna scrittura di consuntivo, da nessuno', () => {
  beforeEach(async () => {
    await preparaDueRighe(MESE_CONVALIDATO, true);
  });

  describe.each<[string, Attore]>([
    ['il proprietario', COORD_A],
    ['un altro coordinatore', COORD_B],
    ['l’ADMIN', ADMIN],
  ])('%s', (_nome, chi) => {
    it.each(CELLE)('negato: %s', async (_caso, cella) => {
      await assertFails(
        dbDi(env, chi)
          .doc(percorsoRiga(MESE_CONVALIDATO, DIP_1))
          .update({ ...comune(6, chi.uid ?? ''), 'giorni.07': cella }),
      );
    });
  });

  it('negato: sostituzione su due righe, scritta con una transazione o un batch', async () => {
    const db = dbDi(env, COORD_A);
    await assertFails(
      db.runTransaction(async (tx) => {
        const a = await tx.get(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_1)));
        const b = await tx.get(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_2)));
        tx.update(a.ref, { ...comune(Number(a.get('versione')) + 1), 'giorni.07': COPERTO });
        tx.update(b.ref, { ...comune(Number(b.get('versione')) + 1), 'giorni.07': SOSTITUTO });
      }),
    );
    const batch = db.batch();
    batch.update(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_1)), {
      ...comune(6),
      'giorni.07': COPERTO,
    });
    batch.update(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_2)), {
      ...comune(6),
      'giorni.07': SOSTITUTO,
    });
    await assertFails(batch.commit());
  });

  it('negato: riscrivere la riga intera con set, o con la sola versione', async () => {
    const db = dbDi(env, COORD_A);
    await assertFails(
      db
        .doc(percorsoRiga(MESE_CONVALIDATO, DIP_1))
        .set(riga(DIP_1, UID.coordA, { versione: 6, giorni: { '07': ORARIO_REALE } })),
    );
    await assertFails(db.doc(percorsoRiga(MESE_CONVALIDATO, DIP_1)).update({ ...comune(6) }));
  });
});

describe('forma di primo livello: respinta anche sul mese in bozza', () => {
  it.each<[string, Dati]>([
    ['versione non incrementata', { ...comune(3), 'giorni.07': ORARIO_REALE }],
    ['versione + 2', { ...comune(5), 'giorni.07': ORARIO_REALE }],
    ['giorno 32', { ...comune(4), 'giorni.32': ORARIO_REALE }],
    ['giorno 00', { ...comune(4), 'giorni.00': ORARIO_REALE }],
    ['giorni come lista', { ...comune(4), giorni: [ORARIO_REALE] }],
    ['giorni come testo', { ...comune(4), giorni: 'x' }],
    ['giorni nullo', { ...comune(4), giorni: null }],
    ['campo in più nella riga', { ...comune(4), nomeDipendente: 'Mario' }],
    ['dipendenteId cambiato', { ...comune(4), dipendenteId: DIP_2 }],
    ['aggiornatoDa altrui', { ...comune(4, UID.coordB), 'giorni.07': ORARIO_REALE }],
    [
      'aggiornatoIl diverso da request.time',
      { versione: 4, aggiornatoDa: UID.coordA, aggiornatoIl: ISTANTE_FISSO },
    ],
    ['contratto con un campo in più', { ...comune(4), 'contratto.nome': 'Mario' }],
    ['ore settimanali non valide', { ...comune(4), 'contratto.oreSettimanali': 0 }],
  ])('negato: %s', async (_caso, campi) => {
    await assertFails(dbDi(env, COORD_A).doc(percorsoRiga(MESE_BOZZA, DIP_1)).update(campi));
  });

  it('negato: una riga nuova con i giorni di forma sbagliata', async () => {
    await assertFails(
      dbDi(env, COORD_A)
        .doc(percorsoRiga(MESE_BOZZA, 'dip9'))
        .set(riga('dip9', UID.coordA, { giorni: [] })),
    );
  });

  it('negato: cancellare la riga di un mese in bozza (le righe non si eliminano)', async () => {
    await assertFails(dbDi(env, COORD_A).doc(percorsoRiga(MESE_BOZZA, DIP_1)).delete());
  });
});

describe('riepiloghi, banca ore e registro: mai dal browser', () => {
  it.each<[string, Attore]>([
    ['proprietario', COORD_A],
    ['ADMIN', ADMIN],
  ])('negato: il %s non scrive i documenti derivati', async (_nome, chi) => {
    const db = dbDi(env, chi);
    await assertFails(
      db.doc(`reparti/${REPARTO_A}/riepiloghi/${MESE_BOZZA}_${DIP_1}`).set({ saldoMinuti: 0 }),
    );
    await assertFails(
      db.doc(`reparti/${REPARTO_A}/bancaOre/2026_${DIP_1}`).set({ saldoAnnoMinuti: 0 }),
    );
    await assertFails(
      db.doc(`reparti/${REPARTO_A}/registroAttivita/x`).set({ tipo: 'consuntivo.modificato' }),
    );
  });
});
