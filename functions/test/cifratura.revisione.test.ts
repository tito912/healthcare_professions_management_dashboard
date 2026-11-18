// Test aggiunti dalla review dello step 1.4 (docs/review/1.4.md, rilievo 1). Dimostrano un difetto: oggi
// falliscono. `FUNCTIONS_EMULATOR` non è una variabile riservata della CLI Firebase (firebase-tools,
// lib/functions/env.js: RESERVED_KEYS e RESERVED_PREFIXES non la contengono), quindi una riga
// `FUNCTIONS_EMULATOR=true` in `functions/.env` o `functions/.env.<progetto>` arriva anche in produzione.
// Lì nessun emulatore è attivo (niente FIRESTORE_EMULATOR_HOST, progetto vero e non `demo-*`), eppure oggi
// si attivano la cifratura locale con la chiave nel codice e la chiave HMAC di prova, senza alcun errore.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurazioneMancanteError } from '../src/dipendenti/cifratura/ambiente';
import { cifratoreCorrente } from '../src/dipendenti/cifratura/cifratore';
import { CifratoreEmulatore } from '../src/dipendenti/cifratura/cifratore-emulatore';
import { chiaveHmacCorrente, segretiDellaFunzione } from '../src/dipendenti/cifratura/hmac';

vi.mock('firebase-functions/logger', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
// Produzione senza configurazione: né la chiave KMS né il secret HMAC.
vi.mock('../src/comune/parametri', () => ({
  KMS_CHIAVE_DIPENDENTI: { name: 'KMS_CHIAVE_DIPENDENTI', value: () => '' },
  HMAC_CF_CHIAVE: { name: 'HMAC_CF_CHIAVE', value: () => '' },
}));

/** Ambiente di una Cloud Function di 2a generazione con `FUNCTIONS_EMULATOR=true` arrivato da un file .env. */
function produzioneConVariabileSbagliata(): void {
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'ospedale-turni-prod');
  vi.stubEnv('K_SERVICE', 'salvadipendente');
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined);
  vi.stubEnv('HMAC_CF_CHIAVE', undefined);
}

/** Ambiente dell'emulatore delle Functions avviato da `npm run emulators` o `npm run test:rules`. */
function emulatoreVero(): void {
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'demo-turni');
  vi.stubEnv('K_SERVICE', 'salvaDipendente');
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  vi.stubEnv('HMAC_CF_CHIAVE', undefined);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe('review 1.4, rilievo 1: la cifratura finta non si attiva fuori dall’emulatore', () => {
  it('FUNCTIONS_EMULATOR=true senza emulatori: niente CifratoreEmulatore, errore di configurazione', () => {
    produzioneConVariabileSbagliata();
    expect(() => cifratoreCorrente()).toThrow(ConfigurazioneMancanteError);
  });

  it('FUNCTIONS_EMULATOR=true senza emulatori: niente chiave HMAC di prova, errore di configurazione', () => {
    produzioneConVariabileSbagliata();
    expect(() => chiaveHmacCorrente()).toThrow(ConfigurazioneMancanteError);
  });

  it('FUNCTIONS_EMULATOR=true al deploy: il secret HMAC resta dichiarato alla funzione', () => {
    produzioneConVariabileSbagliata();
    expect(segretiDellaFunzione().map((secret) => secret.name)).toEqual(['HMAC_CF_CHIAVE']);
  });

  it('controllo: sull’emulatore vero la cifratura locale resta disponibile', () => {
    emulatoreVero();
    expect(cifratoreCorrente()).toBeInstanceOf(CifratoreEmulatore);
    expect(segretiDellaFunzione()).toEqual([]);
  });
});
