import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Test sull'emulatore (npm run test:rules): Security Rules e Functions (*.emu.test.ts).
// passWithNoTests: finché non ci sono test lo script passa.
export default defineConfig({
  root: radice,
  resolve: {
    alias: {
      '@turni/domain': path.join(radice, 'packages/domain/src/index.ts'),
    },
  },
  test: {
    include: ['tests/regole/**/*.test.ts', 'functions/test/**/*.emu.test.ts'],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
