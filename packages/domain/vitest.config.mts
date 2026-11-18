import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utili.ts'],
      reporter: ['text-summary', 'text'],
      // PIANO 2.1, criterio 14: copertura delle righe del pacchetto almeno al 95%.
      thresholds: { lines: 95 },
    },
  },
});
