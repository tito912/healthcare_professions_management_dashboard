// storage.rules: il browser non accede mai a Cloud Storage (ARCHITETTURA §6-§7).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { ADMIN, ANONIMO, COORD_A, REPARTO_A, radice, type Attore } from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-regole-storage',
    storage: { rules: readFileSync(path.join(radice, 'storage.rules'), 'utf8') },
  });
  await env.withSecurityRulesDisabled(async (contesto) => {
    await contesto
      .storage()
      .ref(`report/${REPARTO_A}/2026-B6/reparto.xlsx`)
      .putString('contenuto di prova');
  });
});

afterAll(async () => {
  await env.cleanup();
});

function storageDi(attore: Attore) {
  return attore.uid === null
    ? env.unauthenticatedContext().storage()
    : env.authenticatedContext(attore.uid, attore.claims).storage();
}

describe.each([ANONIMO, ADMIN, COORD_A])('Storage: $nome', (attore) => {
  it('non legge i file dei report', async () => {
    await assertFails(
      storageDi(attore).ref(`report/${REPARTO_A}/2026-B6/reparto.xlsx`).getDownloadURL(),
    );
  });

  it('non elenca i file dei report', async () => {
    await assertFails(storageDi(attore).ref(`report/${REPARTO_A}`).listAll());
  });

  it('non carica file', async () => {
    // UploadTask è solo «thenable»: then() lo trasforma in una Promise.
    await assertFails(
      storageDi(attore)
        .ref(`report/${REPARTO_A}/nuovo.xlsx`)
        .putString('x')
        .then(() => undefined),
    );
  });

  it('non elimina file', async () => {
    await assertFails(storageDi(attore).ref(`report/${REPARTO_A}/2026-B6/reparto.xlsx`).delete());
  });
});
