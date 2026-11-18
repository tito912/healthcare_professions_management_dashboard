import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Test sull'emulatore (npm run test:rules): Security Rules, Functions (*.emu.test.ts) e script.
// Un file alla volta: Functions e script condividono gli emulatori di Auth e Firestore del progetto
// demo-turni; i test delle regole usano ciascuno un proprio progetto demo-regole-*.
export default defineConfig({
  root: radice,
  resolve: {
    alias: {
      '@turni/domain': path.join(radice, 'packages/domain/src/index.ts'),
    },
  },
  test: {
    include: [
      'tests/regole/**/*.test.ts',
      'functions/test/**/*.emu.test.ts',
      'scripts/**/*.emu.test.ts',
    ],
    fileParallelism: false,
    // Con gli emulatori non servono credenziali: si evita che le librerie Google cerchino il server dei
    // metadati di Compute Engine (attesa inutile e avvisi MetadataLookupWarning nei test).
    env: { METADATA_SERVER_DETECTION: 'none' },
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
