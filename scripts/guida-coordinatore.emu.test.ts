// Revisione 4.3: la guida del coordinatore deve dire ciò che fa l'app. Qui i testi dell'interfaccia sono
// la fonte di verità (apps/web/src/app/testi/it-griglia.ts).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const guida = readFileSync(path.join(radice, 'docs/GUIDA-COORDINATORE.md'), 'utf8').replace(
  /\s+/g,
  ' ',
);
const testiGriglia = readFileSync(
  path.join(radice, 'apps/web/src/app/testi/it-griglia.ts'),
  'utf8',
);

describe('guida del coordinatore e interfaccia', () => {
  it('gli avvisi non impediscono la convalida (come dice il dialogo)', () => {
    expect(testiGriglia).toContain('Gli avvisi non impediscono la convalida');
    expect(guida).not.toMatch(/devono essere risolti prima della convalida/);
  });

  it('un clic sul giorno festivo mostra lo storico di 5 anni, non «le festività dell’anno»', () => {
    expect(testiGriglia).toContain('Storico degli ultimi 5 anni');
    expect(guida).not.toMatch(/Un clic sul giorno mostra le festività dell'anno/);
  });
});
