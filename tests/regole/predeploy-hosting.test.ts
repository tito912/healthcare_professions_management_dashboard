// Predeploy di Hosting (audit 4.4, R1): la CLI Firebase passa l'intera riga a cross-env-shell come un solo
// argomento; se la riga contiene `=` viene letta come un'assegnazione di variabile, non lancia nulla ed esce con 0.
// Questi test leggono firebase.json e lanciano il predeploy come lo lancia la CLI (lifecycleHooks.runCommand di
// firebase-tools 14.27.0), senza deploy e senza emulatori. I casi riusciti non scrivono l'ambiente vero del
// repository: la destinazione di genera-ambiente-web.ts è deviata su una cartella temporanea.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { radice } from './aiuti';

interface ConfigurazioneHosting {
  readonly hosting: { readonly predeploy?: readonly string[] };
}

const configurazione: ConfigurazioneHosting = JSON.parse(
  readFileSync(path.join(radice, 'firebase.json'), 'utf8'),
);
const predeploy = configurazione.hosting.predeploy ?? [];

const cartellaTemporanea = mkdtempSync(path.join(tmpdir(), 'predeploy-hosting-'));
afterAll(() => rmSync(cartellaTemporanea, { recursive: true, force: true }));

const requireDaFirebaseTools = createRequire(
  createRequire(path.join(radice, 'package.json')).resolve('firebase-tools/package.json'),
);
const crossEnvShell = path.resolve(
  requireDaFirebaseTools.resolve('cross-env'),
  '..',
  'bin',
  'cross-env-shell.js',
);

const variabiliFirebase = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
] as const;

const configurazioneCompleta: Record<string, string> = {
  FIREBASE_API_KEY: 'chiave-finta',
  FIREBASE_AUTH_DOMAIN: 'progetto-finto.firebaseapp.com',
  FIREBASE_PROJECT_ID: 'progetto-finto',
  FIREBASE_STORAGE_BUCKET: 'progetto-finto.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '123456789',
  FIREBASE_APP_ID: '1:123456789:web:finto',
};

/** Ambiente del processo figlio: variabili vuote (non assenti) così il file .env non le riempie. */
function ambiente(variabili: Record<string, string>): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = { ...process.env, USE_EMULATORS: 'false' };
  for (const nome of variabiliFirebase) {
    base[nome] = '';
  }
  return { ...base, ...variabili };
}

/** Come lifecycleHooks.runCommand di firebase-tools 14.27.0: stesso comando tradotto, shell, nessun deploy. */
function lanciaCome(comando: string, env: NodeJS.ProcessEnv) {
  const escapato = comando.replace(/"/g, '\\"');
  const tradotto = `"${process.execPath}" "${crossEnvShell}" "${escapato}"`;
  return spawnSync(tradotto, [], { cwd: radice, env, shell: true, encoding: 'utf8' });
}

describe('hosting: predeploy in firebase.json', () => {
  it('c’è almeno un comando e nessuno contiene «=» (la CLI non lo eseguirebbe)', () => {
    expect(predeploy.length).toBeGreaterThan(0);
    for (const comando of predeploy) {
      expect(comando, comando).not.toContain('=');
    }
  });

  it('lancia lo script build:deploy del web, che esiste in apps/web/package.json', () => {
    const pacchetto: { scripts: Record<string, string> } = JSON.parse(
      readFileSync(path.join(radice, 'apps/web/package.json'), 'utf8'),
    );
    expect(predeploy).toEqual(['npm run build:deploy -w @turni/web']);
    expect(pacchetto.scripts['build:deploy']).toContain('--deploy');
  });

  describe('lanciato come la CLI, senza deploy', () => {
    const comando = predeploy[0] ?? '';

    it('senza nessuna variabile FIREBASE_* esce con un errore e non costruisce', () => {
      const esito = lanciaCome(comando, ambiente({}));
      expect(esito.status).not.toBe(0);
      expect(esito.stderr).toContain('Configurazione Firebase incompleta per il deploy');
      expect(esito.stdout + esito.stderr).not.toContain('Building');
    }, 120_000);

    it('con una sola variabile mancante esce con un errore che la nomina', () => {
      const { FIREBASE_APP_ID: _escluso, ...quasiTutte } = configurazioneCompleta;
      const esito = lanciaCome(comando, ambiente(quasiTutte));
      expect(esito.status).not.toBe(0);
      expect(esito.stderr).toContain('FIREBASE_APP_ID');
    }, 120_000);

    it('con USE_EMULATORS=true esce con un errore', () => {
      const esito = lanciaCome(
        comando,
        ambiente({ ...configurazioneCompleta, USE_EMULATORS: 'true' }),
      );
      expect(esito.status).not.toBe(0);
    }, 120_000);
  });

  describe('lo script di generazione con --deploy', () => {
    function lanciaScript(variabili: Record<string, string>, ...argomenti: string[]) {
      const destinazione = path.join(cartellaTemporanea, 'environment.ts');
      const esito = spawnSync('npx', ['tsx', 'scripts/genera-ambiente-web.ts', ...argomenti], {
        cwd: radice,
        env: { ...ambiente(variabili), AMBIENTE_WEB_DESTINAZIONE: destinazione },
        encoding: 'utf8',
      });
      return { esito, destinazione };
    }

    it('con la configurazione completa riesce e scrive l’ambiente', () => {
      const { esito, destinazione } = lanciaScript(configurazioneCompleta, '--deploy');
      expect(esito.status).toBe(0);
      const contenuto = readFileSync(destinazione, 'utf8');
      expect(contenuto).toContain('usaEmulatori: false');
      expect(contenuto).toContain('progetto-finto');
    }, 60_000);

    it('senza --deploy le variabili mancanti restano un avviso (build locale)', () => {
      const { esito } = lanciaScript({});
      expect(esito.status).toBe(0);
      expect(esito.stderr).toContain('non impostata');
    }, 60_000);

    it('con --deploy e una variabile mancante esce con 1', () => {
      const { esito } = lanciaScript(
        { ...configurazioneCompleta, FIREBASE_API_KEY: '' },
        '--deploy',
      );
      expect(esito.status).toBe(1);
      expect(esito.stderr).toContain('FIREBASE_API_KEY');
    }, 60_000);
  });
});
