// Revisione 4.3: il seed dimostrativo non deve mai poter raggiungere un progetto reale. Il processo parte
// con variabili d'ambiente ostili (credenziali inesistenti, progetto reale) e deve fermarsi senza scrivere.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lanciaSeed(argomenti: readonly string[], env: Record<string, string>) {
  return spawnSync('npx', ['tsx', 'scripts/seed-demo.ts', ...argomenti], {
    cwd: radice,
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      PATH: process.env['PATH'] ?? '',
      HOME: process.env['HOME'] ?? '',
      GOOGLE_APPLICATION_CREDENTIALS: '/percorso/inesistente.json',
      GCLOUD_PROJECT: 'progetto-reale-di-prova',
      ...env,
    },
  });
}

describe('seed-demo: bloccato fuori dall’emulatore', () => {
  it('senza --emulatore esce con errore e spiega l’uso', () => {
    const esito = lanciaSeed([], {});
    expect(esito.status).toBe(1);
    expect(esito.stderr).toContain('manca --emulatore');
  });

  it('un’opzione per un progetto reale non esiste', () => {
    const esito = lanciaSeed(['--emulatore', '--project', 'progetto-reale-di-prova'], {});
    expect(esito.status).toBe(1);
    expect(esito.stderr).toContain('Argomenti non riconosciuti');
  });

  it('con --emulatore e senza emulatori in ascolto non contatta altri host', () => {
    const esito = lanciaSeed(['--emulatore'], {
      FIRESTORE_EMULATOR_HOST: '',
      FIREBASE_AUTH_EMULATOR_HOST: 'host-reale.example:443',
    });
    // Le porte di firebase.json sono quelle degli emulatori di questo test: se sono in ascolto il seed
    // trova i servizi; il punto è che non esce mai verso host-reale.example.
    expect(esito.stderr + esito.stdout).not.toContain('host-reale.example');
  });
});
