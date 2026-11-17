// Registro attività: raccolta del reparto, raccolta radice e collection group (ARCHITETTURA §5.13, §7).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ADMIN, COORD_A, COORD_B, REPARTO_A, ambiente, dbDi, semina } from './aiuti';

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

  it('coordinatore: il registro radice no, né in lettura puntuale né in elenco', async () => {
    await assertFails(dbDi(env, COORD_A).doc('registroAttivita/voce0').get());
    await assertFails(dbDi(env, COORD_A).collection('registroAttivita').get());
  });
});
