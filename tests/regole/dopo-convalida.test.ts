// Dopo la convalida il mese è in sola lettura totale (D2, D18; PIANO 2.3 criterio 7): ogni scrittura dal browser su
// mese e righe è respinta, per ogni operazione e per ogni chi (coordinatore proprietario, altro coordinatore,
// ADMIN). La lettura resta consentita al proprietario e all'ADMIN. La prova con la convalida fatta dalla callable
// vera è in functions/test/mesi.emu.test.ts.
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
  MESE_BOZZA,
  MESE_CONVALIDATO,
  REPARTO_A,
  UID,
  ambiente,
  dbDi,
  eliminaCampo,
  mese,
  oraServer,
  riga,
  semina,
  type Attore,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-dopo-convalida');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const percorsoMese = `reparti/${REPARTO_A}/mesi/${MESE_CONVALIDATO}`;
const percorsoRiga = (did: string) => `${percorsoMese}/righe/${did}`;
const CHI: readonly Attore[] = [COORD_A, COORD_B, ADMIN];

describe('mese convalidato: lettura', () => {
  it('il proprietario e l’ADMIN leggono mese e righe', async () => {
    for (const chi of [COORD_A, ADMIN]) {
      await assertSucceeds(dbDi(env, chi).doc(percorsoMese).get());
      await assertSucceeds(dbDi(env, chi).doc(percorsoRiga(DIP_1)).get());
      await assertSucceeds(dbDi(env, chi).collection(`${percorsoMese}/righe`).get());
    }
  });
});

describe.each(CHI.map((chi) => [chi.nome, chi] as const))(
  'mese convalidato: scritture di %s sul mese',
  (_nome, chi) => {
    const db = () => dbDi(env, chi);
    const campi: [string, Dati][] = [
      ['calendario', { calendario: { festivita: {}, attribuzioneNotte: 'fine' } }],
      ['stato in bozza (riapertura)', { stato: 'bozza' }],
      [
        'stato in bozza con i campi di convalida a null',
        {
          stato: 'bozza',
          convalidatoIl: null,
          convalidatoDa: null,
          convalidatoDaNome: null,
        },
      ],
      ['autore della convalida', { convalidatoDa: UID.coordB }],
      ['nome dell’autore della convalida', { convalidatoDaNome: 'Altro Nome' }],
      ['data di convalida', { convalidatoIl: oraServer() }],
      ['solo aggiornatoIl e aggiornatoDa', {}],
    ];

    it.each(campi)('negato: update di %s', async (_caso, modifica) => {
      await assertFails(
        db()
          .doc(percorsoMese)
          .update({ aggiornatoIl: oraServer(), aggiornatoDa: chi.uid ?? '', ...modifica }),
      );
    });

    it('negato: set completo come mese in bozza', async () => {
      await assertFails(db().doc(percorsoMese).set(mese(MESE_CONVALIDATO, UID.coordA)));
    });

    it('negato: eliminazione del mese', async () => {
      await assertFails(db().doc(percorsoMese).delete());
    });

    it('negato: eliminazione di un campo di convalida', async () => {
      await assertFails(db().doc(percorsoMese).update({ convalidatoDaNome: eliminaCampo() }));
    });
  },
);

describe.each(CHI.map((chi) => [chi.nome, chi] as const))(
  'mese convalidato: scritture di %s sulle righe',
  (_nome, chi) => {
    const db = () => dbDi(env, chi);
    const base = () => ({ aggiornatoIl: oraServer(), aggiornatoDa: chi.uid ?? '' });

    it.each<[string, Dati]>([
      ['una cella nuova', { versione: 6, 'giorni.03': CELLA_ESEMPIO }],
      ['un giorno svuotato', { versione: 6, 'giorni.03': eliminaCampo() }],
      ['il contratto', { versione: 6, 'contratto.oreSettimanali': 30 }],
      ['solo la versione', { versione: 6 }],
    ])('negato: update di %s', async (_caso, modifica) => {
      await assertFails(
        db()
          .doc(percorsoRiga(DIP_1))
          .update({ ...base(), ...modifica }),
      );
    });

    it('negato: set completo della riga esistente e di una riga nuova', async () => {
      await assertFails(
        db()
          .doc(percorsoRiga(DIP_1))
          .set(riga(DIP_1, chi.uid ?? '', { versione: 6 })),
      );
      await assertFails(
        db()
          .doc(percorsoRiga('dip2'))
          .set(riga('dip2', chi.uid ?? '')),
      );
    });

    it('negato: eliminazione della riga', async () => {
      await assertFails(db().doc(percorsoRiga(DIP_1)).delete());
    });

    it('negato: batch con righe nuove e vecchie', async () => {
      const batch = db().batch();
      batch.set(db().doc(percorsoRiga('dip2')), riga('dip2', chi.uid ?? ''));
      batch.update(db().doc(percorsoRiga(DIP_1)), { ...base(), versione: 6 });
      await assertFails(batch.commit());
    });

    it('negato: transazione che legge e riscrive la riga', async () => {
      const connessione = db();
      await assertFails(
        connessione.runTransaction(async (tx) => {
          const corrente = await tx.get(connessione.doc(percorsoRiga(DIP_1)));
          tx.update(connessione.doc(percorsoRiga(DIP_1)), {
            ...base(),
            versione: Number(corrente.get('versione')) + 1,
          });
        }),
      );
    });
  },
);

describe('mese convalidato: nessun aggiramento', () => {
  it('negato: riaprire il mese e scrivere la riga nello stesso batch', async () => {
    const db = dbDi(env, COORD_A);
    const batch = db.batch();
    batch.update(db.doc(percorsoMese), {
      stato: 'bozza',
      aggiornatoIl: oraServer(),
      aggiornatoDa: UID.coordA,
    });
    batch.set(db.doc(percorsoRiga('dip2')), riga('dip2', UID.coordA));
    await assertFails(batch.commit());
  });

  it('negato: ricreare il mese dopo l’eliminazione non esiste, perché l’eliminazione è negata', async () => {
    const db = dbDi(env, COORD_A);
    await assertFails(db.doc(percorsoMese).delete());
    await assertFails(db.doc(percorsoMese).set(mese(MESE_CONVALIDATO, UID.coordA)));
  });

  it('i documenti derivati e il registro non si scrivono dal browser nemmeno per un mese convalidato', async () => {
    const db = dbDi(env, COORD_A);
    await assertFails(
      db.doc(`reparti/${REPARTO_A}/riepiloghi/${MESE_CONVALIDATO}_${DIP_1}`).set({ valida: true }),
    );
    await assertFails(db.collection(`reparti/${REPARTO_A}/registroAttivita`).add({ tipo: 'x' }));
  });

  it('per confronto: lo stesso mese in bozza resta modificabile dal proprietario', async () => {
    await assertSucceeds(
      dbDi(env, COORD_A).doc(`reparti/${REPARTO_A}/mesi/${MESE_BOZZA}/righe/${DIP_1}`).update({
        versione: 4,
        'giorni.06': CELLA_ESEMPIO,
        aggiornatoIl: oraServer(),
        aggiornatoDa: UID.coordA,
      }),
    );
  });
});
