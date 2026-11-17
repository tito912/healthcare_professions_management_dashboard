import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const qui = path.dirname(fileURLToPath(import.meta.url));

// Test unitari senza emulatori. I test sull'emulatore (*.emu.test.ts) girano con npm run test:rules.
export default defineConfig({
  resolve: {
    alias: {
      '@turni/domain': path.join(qui, '../packages/domain/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.emu.test.ts'],
  },
});
