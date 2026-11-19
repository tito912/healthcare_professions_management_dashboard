// Registro attività: raccolta del reparto, raccolta radice e collection group (ARCHITETTURA §5.13, §7).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import firebase from 'firebase/compat/app';
import { ADMIN, COORD_A, COORD_B, ISTANTE_FISSO, REPARTO_A, ambiente, dbDi, semina } from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-registro');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

describe('registroAttivita', () => {
  it('ADMIN: collection group filtrato per reparto', async () => {
    await assertSucceeds(
      dbDi(env, ADMIN)
        .collectionGroup('registroAttivita')
        .where('repartoId', '==', REPARTO_A)
        .get(),
    );
  });

  it('coordinatore: niente collection group, nemmeno filtrato sul proprio reparto', async () => {
    await assertFails(
      dbDi(env, COORD_A)
        .collectionGroup('registroAttivita')
        .where('repartoId', '==', REPARTO_A)
        .get(),
    );
  });

  it('coordinatore: il registro del proprio reparto sì, quello di un altro no', async () => {
    await assertSucceeds(
      dbDi(env, COORD_A).collection(`reparti/${REPARTO_A}/registroAttivita`).get(),
    );
    await assertFails(dbDi(env, COORD_B).collection(`reparti/${REPARTO_A}/registroAttivita`).get());
  });

  it('le query della pagina Registro (filtri, periodo, ordine, limite) sono ammesse ad ADMIN e coordinatore', async () => {
    const da = ISTANTE_FISSO;
    const a = firebase.firestore.Timestamp.fromMillis(4_000_000_000_000);
    await assertSucceeds(
      dbDi(env, ADMIN)
        .collectionGroup('registroAttivita')
        .where('repartoId', '==', REPARTO_A)
        .where('autoreUid', '==', null)
        .where('tipo', '==', 'pulizia.eseguita')
        .where('il', '>=', da)
        .where('il', '<', a)
        .orderBy('il', 'desc')
        .limit(51)
        .get(),
    );
    await assertSucceeds(
      dbDi(env, COORD_A)
        .collection(`reparti/${REPARTO_A}/registroAttivita`)
        .where('autoreUid', '==', COORD_A.uid)
        .where('tipo', '==', 'mese.convalidato')
        .where('il', '<=', a)
        .orderBy('il', 'desc')
        .limit(50)
        .get(),
    );
  });

  it('coordinatore: il registro radice no, né in lettura puntuale né in elenco', async () => {
    await assertFails(dbDi(env, COORD_A).doc('registroAttivita/voce0').get());
    await assertFails(dbDi(env, COORD_A).collection('registroAttivita').get());
  });

  it.each(['righe', 'turni', 'dipendenti', 'privato', 'riepiloghi', 'mail', 'utenti'])(
    'collection group %s: negato a tutti, anche all’ADMIN',
    async (raccolta) => {
      for (const attore of [ADMIN, COORD_A]) {
        await assertFails(dbDi(env, attore).collectionGroup(raccolta).get());
      }
    },
  );
});
