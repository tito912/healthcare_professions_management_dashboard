// Cifratura dei dati riservati e HMAC del codice fiscale, senza emulatori né KMS veri.
import * as logger from 'firebase-functions/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurazioneMancanteError } from '../src/dipendenti/cifratura/ambiente';
import {
  aadCodiceFiscale,
  aadDataNascita,
  creaCifratore,
} from '../src/dipendenti/cifratura/cifratore';
import {
  CHIAVE_EMULATORE,
  CifratoreEmulatore,
} from '../src/dipendenti/cifratura/cifratore-emulatore';
import { CifratoreKms, type ClienteKms } from '../src/dipendenti/cifratura/cifratore-kms';
import {
  CHIAVE_HMAC_EMULATORE,
  hmacCodiceFiscale,
  sceltaChiaveHmac,
} from '../src/dipendenti/cifratura/hmac';

vi.mock('firebase-functions/logger', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../src/comune/parametri', () => ({
  KMS_CHIAVE_DIPENDENTI: { name: 'KMS_CHIAVE_DIPENDENTI', value: () => '' },
  HMAC_CF_CHIAVE: { name: 'HMAC_CF_CHIAVE', value: () => '' },
}));

const CF = 'BNCLRA80A41H501D';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
});
afterEach(() => vi.unstubAllEnvs());

describe('CifratoreEmulatore', () => {
  it('cifra e decifra, con testo cifrato che non contiene il testo in chiaro', async () => {
    const cifratore = new CifratoreEmulatore();
    const risultato = await cifratore.cifra(CF, 'd1:codiceFiscale');
    expect(risultato.chiave).toBe(CHIAVE_EMULATORE);
    expect(risultato.cifrato).not.toContain(CF);
    expect(Buffer.from(risultato.cifrato, 'base64').toString('utf8')).not.toContain(CF);
    await expect(cifratore.decifra(risultato.cifrato, 'd1:codiceFiscale')).resolves.toBe(CF);
  });

  it('due cifrature dello stesso testo differiscono (IV casuale)', async () => {
    const cifratore = new CifratoreEmulatore();
    const a = await cifratore.cifra(CF, 'x');
    const b = await cifratore.cifra(CF, 'x');
    expect(a.cifrato).not.toBe(b.cifrato);
  });

  it('con un altro contesto (AAD) la decifratura fallisce, senza riportare il testo', async () => {
    const cifratore = new CifratoreEmulatore();
    const { cifrato } = await cifratore.cifra(CF, 'd1:codiceFiscale');
    await expect(cifratore.decifra(cifrato, 'd2:codiceFiscale')).rejects.toThrow(
      'Decifratura non riuscita.',
    );
    await expect(cifratore.decifra(cifrato, 'd1:dataNascita')).rejects.toThrow();
  });

  it('un testo cifrato manomesso non si decifra', async () => {
    const cifratore = new CifratoreEmulatore();
    const { cifrato } = await cifratore.cifra(CF, 'x');
    const dati = Buffer.from(cifrato, 'base64');
    dati[dati.length - 1] = (dati[dati.length - 1] ?? 0) ^ 1;
    await expect(cifratore.decifra(dati.toString('base64'), 'x')).rejects.toThrow();
  });

  it('fuori dall’emulatore non si può istanziare', () => {
    vi.stubEnv('FUNCTIONS_EMULATOR', '');
    expect(() => new CifratoreEmulatore()).toThrow(/solo sull’emulatore/);
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    expect(() => new CifratoreEmulatore()).toThrow();
  });

  it('gli AAD legano il dato al dipendente e al campo', () => {
    expect(aadCodiceFiscale('d1')).toBe('d1:codiceFiscale');
    expect(aadDataNascita('d1')).toBe('d1:dataNascita');
  });
});

describe('creaCifratore', () => {
  it('sull’emulatore usa la cifratura locale anche se il KMS è configurato', () => {
    expect(creaCifratore({ emulatore: true, chiaveKms: 'projects/p/…' })).toBeInstanceOf(
      CifratoreEmulatore,
    );
  });

  it('fuori dall’emulatore con KMS configurato usa Cloud KMS', () => {
    vi.stubEnv('FUNCTIONS_EMULATOR', '');
    expect(creaCifratore({ emulatore: false, chiaveKms: 'projects/p/…' })).toBeInstanceOf(
      CifratoreKms,
    );
  });

  it.each(['', '   '])(
    'fuori dall’emulatore senza KMS («%s») lancia e non ripiega mai sulla cifratura finta',
    (chiaveKms) => {
      vi.stubEnv('FUNCTIONS_EMULATOR', '');
      expect(() => creaCifratore({ emulatore: false, chiaveKms })).toThrow(
        ConfigurazioneMancanteError,
      );
      expect(logger.error).toHaveBeenCalledWith('Cifratura non configurata: manca il parametro', {
        parametro: 'KMS_CHIAVE_DIPENDENTI',
      });
    },
  );
});

describe('CifratoreKms', () => {
  const CHIAVE = 'projects/p/locations/europe-west12/keyRings/k/cryptoKeys/dipendenti';

  function clienteFinto() {
    const encrypt = vi.fn<ClienteKms['encrypt']>(() =>
      Promise.resolve([
        { ciphertext: new Uint8Array([1, 2, 3, 250]), name: `${CHIAVE}/cryptoKeyVersions/3` },
      ]),
    );
    const decrypt = vi.fn<ClienteKms['decrypt']>(() =>
      Promise.resolve([{ plaintext: new TextEncoder().encode(CF) }]),
    );
    return { encrypt, decrypt };
  }

  it('encrypt: nome della chiave, testo e AAD in byte; risposta in base64 con la versione della chiave', async () => {
    const cliente = clienteFinto();
    const cifratore = new CifratoreKms(CHIAVE, () => Promise.resolve(cliente));
    const risultato = await cifratore.cifra(CF, 'd1:codiceFiscale');
    expect(cliente.encrypt).toHaveBeenCalledTimes(1);
    const richiesta = cliente.encrypt.mock.calls[0]?.[0];
    expect(richiesta?.name).toBe(CHIAVE);
    expect(Buffer.from(richiesta?.plaintext ?? []).toString('utf8')).toBe(CF);
    expect(Buffer.from(richiesta?.additionalAuthenticatedData ?? []).toString('utf8')).toBe(
      'd1:codiceFiscale',
    );
    expect(risultato).toEqual({
      cifrato: Buffer.from([1, 2, 3, 250]).toString('base64'),
      chiave: `${CHIAVE}/cryptoKeyVersions/3`,
    });
  });

  it('decrypt: il testo cifrato torna in byte, con lo stesso AAD', async () => {
    const cliente = clienteFinto();
    const cifratore = new CifratoreKms(CHIAVE, () => Promise.resolve(cliente));
    const cifrato = Buffer.from([1, 2, 3, 250]).toString('base64');
    await expect(cifratore.decifra(cifrato, 'd1:codiceFiscale')).resolves.toBe(CF);
    const richiesta = cliente.decrypt.mock.calls[0]?.[0];
    expect(richiesta?.name).toBe(CHIAVE);
    expect([...(richiesta?.ciphertext ?? [])]).toEqual([1, 2, 3, 250]);
    expect(Buffer.from(richiesta?.additionalAuthenticatedData ?? []).toString('utf8')).toBe(
      'd1:codiceFiscale',
    );
  });

  it('il client si crea una volta sola', async () => {
    const crea = vi.fn(() => Promise.resolve(clienteFinto()));
    const cifratore = new CifratoreKms(CHIAVE, crea);
    await cifratore.cifra('a', 'x');
    await cifratore.cifra('b', 'x');
    expect(crea).toHaveBeenCalledTimes(1);
  });

  it('una risposta senza contenuto è un errore', async () => {
    const cliente = clienteFinto();
    cliente.encrypt.mockResolvedValueOnce([{ ciphertext: null }]);
    const cifratore = new CifratoreKms(CHIAVE, () => Promise.resolve(cliente));
    await expect(cifratore.cifra('a', 'x')).rejects.toThrow('Risposta KMS senza contenuto.');
  });
});

describe('HMAC del codice fiscale', () => {
  const chiave = 'k'.repeat(40);

  it('è esadecimale di 64 caratteri e deterministico', () => {
    const hmac = hmacCodiceFiscale(chiave, CF);
    expect(hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(hmacCodiceFiscale(chiave, CF)).toBe(hmac);
  });

  it('normalizza: maiuscole e spazi non cambiano l’HMAC', () => {
    expect(hmacCodiceFiscale(chiave, ' bnclra 80a41 h501d ')).toBe(hmacCodiceFiscale(chiave, CF));
  });

  it('codici fiscali diversi e chiavi diverse danno HMAC diversi', () => {
    expect(hmacCodiceFiscale(chiave, 'RSSMRA85T10A562S')).not.toBe(hmacCodiceFiscale(chiave, CF));
    expect(hmacCodiceFiscale('h'.repeat(40), CF)).not.toBe(hmacCodiceFiscale(chiave, CF));
  });

  it('valore noto (HMAC-SHA256 calcolato a parte)', () => {
    // python3 -c "import hmac,hashlib;print(hmac.new(b'k'*40,b'BNCLRA80A41H501D',hashlib.sha256).hexdigest())"
    expect(hmacCodiceFiscale(chiave, CF)).toBe(
      'e5500a23cc01146938ae423a9ef5cf1965c53e8282cee54c854fc5bcbe3e265e',
    );
  });

  describe('scelta della chiave', () => {
    it('sull’emulatore: il secret se c’è, altrimenti la chiave di prova', () => {
      expect(sceltaChiaveHmac('s'.repeat(40), true)).toBe('s'.repeat(40));
      expect(sceltaChiaveHmac('', true)).toBe(CHIAVE_HMAC_EMULATORE);
    });

    it('fuori dall’emulatore un secret vuoto o corto è un errore, mai la chiave di prova', () => {
      expect(sceltaChiaveHmac('s'.repeat(40), false)).toBe('s'.repeat(40));
      for (const secret of ['', 'corta', 's'.repeat(31)]) {
        expect(() => sceltaChiaveHmac(secret, false)).toThrow(ConfigurazioneMancanteError);
      }
    });
  });
});
