// Test della revisione 0.2 (rilievo 1): dimostra un difetto, fallisce finché non viene corretto.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('.env.example', () => {
  it('copiato in .env non attiva gli emulatori: USE_EMULATORS non deve essere true di default', () => {
    const righe = readFileSync(path.join(radice, '.env.example'), 'utf8').split('\n');
    const riga = righe.find((r) => r.startsWith('USE_EMULATORS='));
    expect(riga).toBeDefined();
    expect(riga).not.toBe('USE_EMULATORS=true');
  });
});
