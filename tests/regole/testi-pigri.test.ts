// Test della revisione 4.1b (rilievo 1): dimostra un difetto, fallisce finché non viene corretto.
// Controllo statico del grafo degli import: i testi di una pagina pesante devono raggiungere
// solo il codice di quella pagina, anche in modo indiretto. La regola ESLint vede solo gli import diretti;
// qui si seguono gli import statici relativi (gli `import()` dinamici delle rotte non contano).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '../../apps/web/src/app');
const TESTO_DI_PAGINA = /testi\/it-[a-z-]+$/;

function risolvi(da: string, relativo: string): string | null {
  const base = resolve(dirname(da), relativo);
  for (const candidato of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidato)) return candidato;
  }
  return null;
}

function importStatici(file: string): string[] {
  const sorgente = readFileSync(file, 'utf8');
  const trovati: string[] = [];
  const re = /^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gm;
  for (const m of sorgente.matchAll(re)) {
    const specificatore = m[1];
    if (specificatore !== undefined && specificatore.startsWith('.')) trovati.push(specificatore);
  }
  return trovati;
}

/** File dei testi di pagina raggiunti dall'entry seguendo gli import statici relativi. */
function testiRaggiunti(entry: string): Map<string, string> {
  const via = new Map<string, string>(); // testo -> primo file che lo importa
  const visti = new Set<string>();
  const coda = [entry];
  while (coda.length > 0) {
    const file = coda.pop();
    if (file === undefined || visti.has(file)) continue;
    visti.add(file);
    for (const spec of importStatici(file)) {
      const dest = risolvi(file, spec);
      if (dest === null) continue;
      const nome = dest.slice(RADICE.length + 1).replace(/\.ts$/, '');
      if (TESTO_DI_PAGINA.test(nome)) {
        if (!via.has(nome)) via.set(nome, file.slice(RADICE.length + 1));
        continue; // i file dei testi non importano altro che tipi
      }
      coda.push(dest);
    }
  }
  return via;
}

const PAGINE: readonly (readonly [string, string, readonly string[]])[] = [
  ['banca ore', 'pagine/banca-ore/banca-ore.ts', ['testi/it-banca-ore']],
  [
    'dettaglio dipendente',
    'pagine/dettaglio-dipendente/dettaglio-dipendente.ts',
    ['testi/it-dettaglio-dipendente'],
  ],
  [
    'configurazione',
    'pagine/reparto/configurazione/configurazione.ts',
    ['testi/it-configurazione'],
  ],
  ['griglia', 'pagine/griglia/griglia.page.ts', ['testi/it-griglia']],
  ['report', 'pagine/report/report.ts', ['testi/it-report']],
  ['report di tutti i reparti', 'pagine/report/report-tutti.ts', ['testi/it-report']],
  ['registro', 'pagine/registro/registro.ts', ['testi/it-registro']],
  ['home', 'pagine/home/home.ts', ['testi/it-report']],
  ['dipendenti', 'pagine/dipendenti/dipendenti.ts', []],
  ['utenti', 'pagine/utenti/utenti.ts', []],
  ['guscio (bundle iniziale)', 'app.routes.ts', []],
];

describe('testi delle pagine pesanti: nessun caricamento indiretto', () => {
  for (const [nome, entry, consentiti] of PAGINE) {
    it(`${nome} raggiunge solo i propri testi`, () => {
      const raggiunti = [...testiRaggiunti(join(RADICE, entry))].map(
        ([t, da]) => `${t} (via ${da})`,
      );
      const extra = raggiunti.filter((r) => !consentiti.some((c) => r.startsWith(`${c} `)));
      expect(extra).toEqual([]);
    });
  }
});
