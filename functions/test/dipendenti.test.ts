// salvaDipendente e leggiDatiPrivati con un Firestore in memoria e un KMS simulato, senza emulatori:
// transazione, doppioni, spostamento dell'indice, autorizzazioni, registro e, soprattutto, nessun dato
// personale nei log. Il percorso con Firestore e regole vere è in dipendenti.emu.test.ts.
import * as logger from 'firebase-functions/logger';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { leggiDatiPrivati } from '../src/dipendenti/leggi-dati-privati';
import { salvaDipendente } from '../src/dipendenti/salva-dipendente';
import { finto } from './firestore-finto';
import { richiesta } from './richiesta';

const ambiente = vi.hoisted(() => ({ kms: '', segreto: '' }));
const kmsFinto = vi.hoisted(() => ({
  chiamate: [] as { operazione: string; name: string; aad: string }[],
}));

vi.mock('firebase-functions/logger', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../src/comune/parametri', () => ({
  KMS_CHIAVE_DIPENDENTI: { name: 'KMS_CHIAVE_DIPENDENTI', value: () => ambiente.kms },
  HMAC_CF_CHIAVE: { name: 'HMAC_CF_CHIAVE', value: () => ambiente.segreto },
}));
vi.mock('../src/comune/admin', async () => {
  const { finto: f } = await import('./firestore-finto');
  return {
    db: () => f.db,
    oraServer: () => 'oraServer',
    rifUtente: (uid: string) => f.rif(`utenti/${uid}`),
    rifReparto: (id: string) => f.rif(`reparti/${id}`),
  };
});
// Cloud KMS simulato: il testo cifrato dipende dal contesto (AAD), come in KMS.
vi.mock('@google-cloud/kms', () => ({
  KeyManagementServiceClient: class {
    encrypt(r: { name: string; plaintext: Uint8Array; additionalAuthenticatedData: Uint8Array }) {
      const aad = Buffer.from(r.additionalAuthenticatedData).toString('utf8');
      kmsFinto.chiamate.push({ operazione: 'encrypt', name: r.name, aad });
      const cifrato = Buffer.from(`${aad}|${Buffer.from(r.plaintext).toString('utf8')}`)
        .reverse()
        .toString('base64');
      return Promise.resolve([
        { ciphertext: Buffer.from(cifrato, 'utf8'), name: `${r.name}/cryptoKeyVersions/1` },
      ]);
    }
    decrypt(r: { name: string; ciphertext: Uint8Array; additionalAuthenticatedData: Uint8Array }) {
      const aad = Buffer.from(r.additionalAuthenticatedData).toString('utf8');
      kmsFinto.chiamate.push({ operazione: 'decrypt', name: r.name, aad });
      const chiaro = Buffer.from(Buffer.from(r.ciphertext).toString('utf8'), 'base64')
        .reverse()
        .toString('utf8');
      if (!chiaro.startsWith(`${aad}|`)) {
        return Promise.reject(
          Object.assign(new Error('Decrypt failed per ' + chiaro), { code: 3 }),
        );
      }
      return Promise.resolve([{ plaintext: Buffer.from(chiaro.slice(aad.length + 1), 'utf8') }]);
    }
  },
}));

const COORD_A = { uid: 'uCoordA', ruolo: 'COORDINATORE' } as const;
const COORD_B = { uid: 'uCoordB', ruolo: 'COORDINATORE' } as const;
const ADMIN = { uid: 'uAdmin', ruolo: 'ADMIN' } as const;

const CF = 'BNCLRA80A41H501D';
const CF_ALTRO = 'RSSMRA85T10A562S';
const NASCITA = '1980-01-01';
const EMAIL = 'laura.bianchi@ospedale.it';
const SEGRETO = 'k'.repeat(40);
const CHIAVE_KMS = 'projects/p/locations/europe-west12/keyRings/anello/cryptoKeys/dipendenti';

const anagrafica = {
  nome: 'Laura',
  cognome: 'Bianchi',
  oreSettimanali: 36,
  turniEsclusi: ['N1'],
  dataAssunzione: null,
  dataCessazione: null,
  attivo: true,
};
const privati = { codiceFiscale: CF, dataNascita: NASCITA, email: EMAIL };

function creazione(cambi: Record<string, unknown> = {}): unknown {
  return { repartoId: 'repA', dipendenteId: null, anagrafica, privati, ...cambi };
}

const salva = (data: unknown, chi: { uid: string; ruolo: string } | null = COORD_A) =>
  salvaDipendente.run(richiesta(data, chi));
const leggi = (data: unknown, chi: { uid: string; ruolo: string } | null = COORD_A) =>
  leggiDatiPrivati.run(richiesta(data, chi));

function seminaUtente(uid: string, ruolo: string, attivo = true): void {
  finto.imposta(`utenti/${uid}`, { nome: 'Anna', cognome: 'Verdi', ruolo, attivo });
}

/** Tutto ciò che è finito nei log. */
function log(): string {
  return JSON.stringify([
    vi.mocked(logger.info).mock.calls,
    vi.mocked(logger.warn).mock.calls,
    vi.mocked(logger.error).mock.calls,
  ]);
}

const DATI_PERSONALI = [
  CF,
  CF.toLowerCase(),
  'Laura',
  'Bianchi',
  EMAIL,
  NASCITA,
  '1980',
  CF_ALTRO,
  'laura.bianchi',
];

function nessunDatoPersonaleNeiLog(): void {
  const testoLog = log();
  for (const dato of DATI_PERSONALI) {
    expect(testoLog).not.toContain(dato);
  }
}

function vociRegistro(tipo?: string): Record<string, unknown>[] {
  return finto
    .sotto('reparti/repA/registroAttivita/')
    .map(([, dati]) => dati)
    .filter((d) => tipo === undefined || d['tipo'] === tipo);
}

const indici = () => finto.sotto('indiceCodiciFiscali/');
const dipendentiDi = (reparto: string) =>
  finto.sotto(`reparti/${reparto}/dipendenti/`).filter(([path]) => !path.includes('/privato/'));

beforeEach(() => {
  finto.azzera();
  vi.clearAllMocks();
  kmsFinto.chiamate.length = 0;
  ambiente.kms = '';
  ambiente.segreto = '';
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'demo-turni');
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080');
  seminaUtente('uCoordA', 'COORDINATORE');
  seminaUtente('uCoordB', 'COORDINATORE');
  seminaUtente('uAdmin', 'ADMIN');
  finto.imposta('reparti/repA', { coordinatoreUid: 'uCoordA' });
  finto.imposta('reparti/repB', { coordinatoreUid: 'uCoordB' });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime('2026-11-18T10:00:00Z');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('salvaDipendente: creazione', () => {
  it('crea documento pubblico, dati riservati cifrati, indice e voce di registro', async () => {
    const { dipendenteId } = await salva(creazione());
    expect(dipendenteId).toMatch(/^auto/);

    const pubblico = finto.documenti.get(`reparti/repA/dipendenti/${dipendenteId}`);
    expect(pubblico).toMatchObject({
      nome: 'Laura',
      cognome: 'Bianchi',
      oreSettimanali: 36,
      turniEsclusi: ['N1'],
      attivo: true,
      aggiornatoDa: 'uCoordA',
      creatoIl: 'oraServer',
    });
    // Il documento pubblico non contiene nulla di riservato.
    expect(JSON.stringify(pubblico)).not.toMatch(/BNCLRA|1980|laura\.bianchi/);

    const privato = finto.documenti.get(`reparti/repA/dipendenti/${dipendenteId}/privato/dati`);
    expect(privato).toMatchObject({ email: EMAIL, chiaveKms: 'emulatore-non-sicura' });
    expect(privato?.['hmacCodiceFiscale']).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(privato)).not.toContain(CF);
    expect(JSON.stringify(privato)).not.toContain(NASCITA);

    expect(indici()).toEqual([
      [
        `indiceCodiciFiscali/${String(privato?.['hmacCodiceFiscale'])}`,
        { repartoId: 'repA', dipendenteId, creatoIl: 'oraServer' },
      ],
    ]);
    expect(vociRegistro()).toMatchObject([
      {
        tipo: 'dipendente.salvato',
        autoreUid: 'uCoordA',
        autoreRuolo: 'COORDINATORE',
        repartoId: 'repA',
        dipendenteId,
        dettagli: { azione: 'creato' },
      },
    ]);
    nessunDatoPersonaleNeiLog();
  });

  it('il codice fiscale in minuscolo e con spazi dà lo stesso indice', async () => {
    const { dipendenteId } = await salva(creazione());
    const hmac = finto.documenti.get(`reparti/repA/dipendenti/${dipendenteId}/privato/dati`)?.[
      'hmacCodiceFiscale'
    ];
    finto.azzera();
    seminaUtente('uCoordA', 'COORDINATORE');
    finto.imposta('reparti/repA', { coordinatoreUid: 'uCoordA' });
    const { dipendenteId: altro } = await salva(
      creazione({ privati: { ...privati, codiceFiscale: ' bnclra 80a41 h501d ' } }),
    );
    expect(
      finto.documenti.get(`reparti/repA/dipendenti/${altro}/privato/dati`)?.['hmacCodiceFiscale'],
    ).toBe(hmac);
  });

  it('i dati riservati si leggono in chiaro con leggiDatiPrivati e la lettura è nel registro', async () => {
    const { dipendenteId } = await salva(creazione());
    await expect(leggi({ repartoId: 'repA', dipendenteId })).resolves.toEqual({
      codiceFiscale: CF,
      dataNascita: NASCITA,
      email: EMAIL,
    });
    expect(vociRegistro('dipendente.datiPrivatiLetti')).toMatchObject([
      {
        autoreUid: 'uCoordA',
        dipendenteId,
        dettagli: { campi: 'codiceFiscale,dataNascita,email' },
      },
    ]);
    nessunDatoPersonaleNeiLog();
  });

  it('senza email salva null', async () => {
    const { dipendenteId } = await salva(creazione({ privati: { ...privati, email: '  ' } }));
    expect(
      finto.documenti.get(`reparti/repA/dipendenti/${dipendenteId}/privato/dati`)?.['email'],
    ).toBeNull();
  });

  it('in creazione i dati riservati sono obbligatori e non si salva nulla', async () => {
    await expect(salva(creazione({ privati: null }))).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { codice: 'INPUT_NON_VALIDO' },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    expect(indici()).toEqual([]);
  });
});

describe('salvaDipendente: doppioni', () => {
  it('un secondo dipendente con lo stesso codice fiscale è respinto e non scrive nulla', async () => {
    await salva(creazione());
    const prima = new Map(finto.documenti);
    await expect(
      salva(creazione({ anagrafica: { ...anagrafica, nome: 'Altra' } })),
    ).rejects.toMatchObject({
      code: 'already-exists',
      details: { codice: 'CF_DUPLICATO' },
    });
    expect(finto.documenti).toEqual(prima);
    nessunDatoPersonaleNeiLog();
  });

  it('il doppione in un altro reparto è respinto senza dire dove si trova', async () => {
    await salva(creazione());
    let lanciato: unknown;
    try {
      await salva(creazione({ repartoId: 'repB' }), COORD_B);
    } catch (e) {
      lanciato = e;
    }
    expect(lanciato).toMatchObject({ code: 'already-exists', details: { codice: 'CF_DUPLICATO' } });
    const testo = JSON.stringify(lanciato, Object.getOwnPropertyNames(lanciato));
    expect(testo).not.toMatch(/repA|uCoordA|dipendent/i);
    expect(dipendentiDi('repB')).toEqual([]);
  });
});

describe('salvaDipendente: modifica', () => {
  async function creaUno(): Promise<string> {
    return (await salva(creazione())).dipendenteId;
  }
  const modifica = (
    dipendenteId: string,
    cambi: Record<string, unknown>,
    priv: unknown = null,
  ) => ({
    repartoId: 'repA',
    dipendenteId,
    anagrafica: { ...anagrafica, ...cambi },
    privati: priv,
  });

  it('senza dati riservati cambia solo il documento pubblico e lascia indice e privato', async () => {
    const id = await creaUno();
    const privatoPrima = finto.documenti.get(`reparti/repA/dipendenti/${id}/privato/dati`);
    const indiciPrima = new Map(indici());
    await salva(modifica(id, { oreSettimanali: 30, turniEsclusi: ['N1', 'R1'] }));
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}`)).toMatchObject({
      oreSettimanali: 30,
      turniEsclusi: ['N1', 'R1'],
      nome: 'Laura',
    });
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}/privato/dati`)).toBe(privatoPrima);
    expect(new Map(indici())).toEqual(indiciPrima);
    expect(vociRegistro('dipendente.salvato').at(-1)).toMatchObject({
      dettagli: { azione: 'modificato', campi: 'oreSettimanali,turniEsclusi', datiPrivati: false },
    });
    nessunDatoPersonaleNeiLog();
  });

  it('una modifica senza cambiamenti non scrive né registra nulla', async () => {
    const id = await creaUno();
    const prima = new Map(finto.documenti);
    await expect(salva(modifica(id, {}))).resolves.toEqual({ dipendenteId: id });
    expect(finto.documenti).toEqual(prima);
  });

  it('disattivare imposta attivo e data di cessazione', async () => {
    const id = await creaUno();
    await salva(modifica(id, { attivo: false, dataCessazione: '2026-12-31' }));
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}`)).toMatchObject({
      attivo: false,
      dataCessazione: '2026-12-31',
    });
    expect(vociRegistro('dipendente.salvato').at(-1)).toMatchObject({
      dettagli: { campi: 'dataCessazione,attivo' },
    });
  });

  it('disattivare senza data di cessazione è respinto', async () => {
    const id = await creaUno();
    await expect(salva(modifica(id, { attivo: false }))).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
  });

  it('stesso codice fiscale: l’indice non cambia; cambia l’email', async () => {
    const id = await creaUno();
    const indiciPrima = new Map(indici());
    await salva(modifica(id, {}, { ...privati, email: 'nuova@ospedale.it' }));
    expect(new Map(indici())).toEqual(indiciPrima);
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}/privato/dati`)).toMatchObject({
      email: 'nuova@ospedale.it',
    });
    expect(vociRegistro('dipendente.salvato').at(-1)).toMatchObject({
      dettagli: { azione: 'modificato', campi: '', datiPrivati: true },
    });
  });

  it('cambio di codice fiscale: l’indice si sposta (nuovo creato, vecchio eliminato)', async () => {
    const id = await creaUno();
    const vecchioPath = indici()[0]?.[0];
    await salva(modifica(id, {}, { ...privati, codiceFiscale: CF_ALTRO }));
    const dopo = indici();
    expect(dopo).toHaveLength(1);
    expect(dopo[0]?.[0]).not.toBe(vecchioPath);
    expect(dopo[0]?.[1]).toMatchObject({ repartoId: 'repA', dipendenteId: id });
    await expect(leggi({ repartoId: 'repA', dipendenteId: id })).resolves.toMatchObject({
      codiceFiscale: CF_ALTRO,
    });
    // Il vecchio codice fiscale è di nuovo libero.
    await expect(salva(creazione())).resolves.toMatchObject({ dipendenteId: expect.any(String) });
  });

  it('cambio verso un codice fiscale già presente: respinto e indice di prima intatto', async () => {
    const id = await creaUno();
    await salva(creazione({ privati: { ...privati, codiceFiscale: CF_ALTRO } }));
    const prima = new Map(finto.documenti);
    await expect(
      salva(modifica(id, { nome: 'Cambiato' }, { ...privati, codiceFiscale: CF_ALTRO })),
    ).rejects.toMatchObject({ details: { codice: 'CF_DUPLICATO' } });
    expect(finto.documenti).toEqual(prima);
  });

  it('dipendente inesistente, o di un altro reparto: NON_TROVATO', async () => {
    await expect(salva(modifica('manca', {}))).rejects.toMatchObject({
      code: 'not-found',
      details: { codice: 'NON_TROVATO' },
    });
    const id = await creaUno();
    // Il coordinatore B possiede repB ma l'ID è di repA: nel suo reparto non esiste.
    await expect(salva({ ...modifica(id, {}), repartoId: 'repB' }, COORD_B)).rejects.toMatchObject({
      details: { codice: 'NON_TROVATO' },
    });
    expect(dipendentiDi('repB')).toEqual([]);
  });
});

describe('salvaDipendente: data di cessazione lontana nel passato (audit 4.4, I1)', () => {
  const modifica = (dipendenteId: string, cambi: Record<string, unknown>) => ({
    repartoId: 'repA',
    dipendenteId,
    anagrafica: { ...anagrafica, ...cambi },
    privati: null,
  });
  const disattivaAl = (dipendenteId: string, data: string, extra: Record<string, unknown> = {}) =>
    salva({ ...modifica(dipendenteId, { attivo: false, dataCessazione: data }), ...extra });

  it('senza conferma una cessazione di oltre un anno fa è respinta e non scrive nulla', async () => {
    const id = (await salva(creazione())).dipendenteId;
    const prima = new Map(finto.documenti);
    // Il refuso nell'anno: 2016 invece di 2026.
    await expect(disattivaAl(id, '2016-03-31')).rejects.toMatchObject({
      details: { codice: 'CESSAZIONE_DA_CONFERMARE' },
    });
    expect(finto.documenti).toEqual(prima);
    nessunDatoPersonaleNeiLog();
  });

  it('con la conferma esplicita la salva', async () => {
    const id = (await salva(creazione())).dipendenteId;
    await disattivaAl(id, '2016-03-31', { cessazioneConfermata: true });
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}`)).toMatchObject({
      attivo: false,
      dataCessazione: '2016-03-31',
    });
  });

  it('anche in creazione di un dipendente già cessato serve la conferma', async () => {
    await expect(
      salva(
        creazione({ anagrafica: { ...anagrafica, attivo: false, dataCessazione: '2019-01-01' } }),
      ),
    ).rejects.toMatchObject({ details: { codice: 'CESSAZIONE_DA_CONFERMARE' } });
    expect(dipendentiDi('repA')).toHaveLength(0);
  });

  it('una cessazione entro un anno (anche futura) non chiede conferma', async () => {
    const id = (await salva(creazione())).dipendenteId;
    await expect(disattivaAl(id, '2025-11-18')).resolves.toEqual({ dipendenteId: id });
    await expect(disattivaAl(id, '2027-06-30')).resolves.toEqual({ dipendenteId: id });
  });

  it('se la data non cambia (altra modifica) non richiede di nuovo la conferma', async () => {
    const id = (await salva(creazione())).dipendenteId;
    await disattivaAl(id, '2016-03-31', { cessazioneConfermata: true });
    await expect(
      salva(modifica(id, { attivo: false, dataCessazione: '2016-03-31', oreSettimanali: 30 })),
    ).resolves.toEqual({ dipendenteId: id });
    expect(finto.documenti.get(`reparti/repA/dipendenti/${id}`)).toMatchObject({
      oreSettimanali: 30,
    });
  });
});

describe('salvaDipendente: input e autorizzazione', () => {
  it.each([
    [
      'codice fiscale con carattere di controllo errato',
      { codiceFiscale: 'BNCLRA80A41H501X' },
      'CF_NON_VALIDO',
      'invalid-argument',
    ],
    [
      'codice fiscale troppo corto',
      { codiceFiscale: 'BNCLRA80' },
      'CF_NON_VALIDO',
      'invalid-argument',
    ],
    ['email non valida', { email: 'laura.bianchi@' }, 'EMAIL_NON_VALIDA', 'invalid-argument'],
    [
      'data di nascita nel futuro',
      { dataNascita: '2027-01-01' },
      'INPUT_NON_VALIDO',
      'invalid-argument',
    ],
    [
      'data di nascita inesistente',
      { dataNascita: '1980-02-30' },
      'INPUT_NON_VALIDO',
      'invalid-argument',
    ],
  ])('%s', async (_caso, cambi, codice, https) => {
    await expect(salva(creazione({ privati: { ...privati, ...cambi } }))).rejects.toMatchObject({
      code: https,
      details: { codice },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    expect(indici()).toEqual([]);
    nessunDatoPersonaleNeiLog();
  });

  it.each([
    ['ore 0', { oreSettimanali: 0 }],
    ['ore 36,25', { oreSettimanali: 36.25 }],
    ['nome vuoto', { nome: ' ' }],
    ['turno escluso non valido', { turniEsclusi: ['xx'] }],
  ])('anagrafica non valida: %s', async (_caso, cambi) => {
    await expect(
      salva(creazione({ anagrafica: { ...anagrafica, ...cambi } })),
    ).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    nessunDatoPersonaleNeiLog();
  });

  it('un campo in più è rifiutato', async () => {
    await expect(salva(creazione({ ruolo: 'ADMIN' }))).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
  });

  it('non autenticato', async () => {
    await expect(salva(creazione(), null)).rejects.toMatchObject({
      code: 'unauthenticated',
      details: { codice: 'NON_AUTENTICATO' },
    });
  });

  it('coordinatore di un altro reparto: NON_PROPRIETARIO e nessuna scrittura', async () => {
    await expect(salva(creazione(), COORD_B)).rejects.toMatchObject({
      code: 'permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    expect(indici()).toEqual([]);
  });

  it('reparto inesistente: stesso errore del reparto altrui', async () => {
    await expect(salva(creazione({ repartoId: 'manca' }))).rejects.toMatchObject({
      details: { codice: 'NON_PROPRIETARIO' },
    });
  });

  it('l’ADMIN non scrive', async () => {
    await expect(salva(creazione(), ADMIN)).rejects.toMatchObject({
      details: { codice: 'RUOLO_NON_AUTORIZZATO' },
    });
  });

  it('coordinatore disattivato', async () => {
    seminaUtente('uCoordA', 'COORDINATORE', false);
    await expect(salva(creazione())).rejects.toMatchObject({
      details: { codice: 'UTENTE_NON_ABILITATO' },
    });
  });
});

describe('leggiDatiPrivati', () => {
  async function creaUno(): Promise<string> {
    return (await salva(creazione())).dipendenteId;
  }

  it('l’ADMIN legge e la voce di registro porta il suo ruolo', async () => {
    const dipendenteId = await creaUno();
    await expect(leggi({ repartoId: 'repA', dipendenteId }, ADMIN)).resolves.toEqual({
      codiceFiscale: CF,
      dataNascita: NASCITA,
      email: EMAIL,
    });
    expect(vociRegistro('dipendente.datiPrivatiLetti')).toMatchObject([
      { autoreUid: 'uAdmin', autoreRuolo: 'ADMIN', dipendenteId },
    ]);
    nessunDatoPersonaleNeiLog();
  });

  it('ogni lettura è una voce di registro distinta', async () => {
    const dipendenteId = await creaUno();
    await leggi({ repartoId: 'repA', dipendenteId });
    await leggi({ repartoId: 'repA', dipendenteId }, ADMIN);
    await leggi({ repartoId: 'repA', dipendenteId });
    expect(vociRegistro('dipendente.datiPrivatiLetti')).toHaveLength(3);
  });

  it('un coordinatore che chiede i dati di un reparto non suo: NON_PROPRIETARIO, nessuna decifratura', async () => {
    const dipendenteId = await creaUno();
    kmsFinto.chiamate.length = 0;
    await expect(leggi({ repartoId: 'repA', dipendenteId }, COORD_B)).rejects.toMatchObject({
      code: 'permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
    expect(vociRegistro('dipendente.datiPrivatiLetti')).toEqual([]);
    expect(kmsFinto.chiamate).toEqual([]);
  });

  it('il proprio reparto con l’ID di un dipendente altrui: NON_TROVATO', async () => {
    const dipendenteId = await creaUno();
    await expect(leggi({ repartoId: 'repB', dipendenteId }, COORD_B)).rejects.toMatchObject({
      code: 'not-found',
      details: { codice: 'NON_TROVATO' },
    });
  });

  it('dipendente senza dati riservati: NON_TROVATO', async () => {
    finto.imposta('reparti/repA/dipendenti/orfano', { nome: 'x' });
    await expect(leggi({ repartoId: 'repA', dipendenteId: 'orfano' })).rejects.toMatchObject({
      details: { codice: 'NON_TROVATO' },
    });
  });

  it('non autenticato e utente senza ruolo valido', async () => {
    await expect(leggi({ repartoId: 'repA', dipendenteId: 'x' }, null)).rejects.toMatchObject({
      details: { codice: 'NON_AUTENTICATO' },
    });
    await expect(
      leggi({ repartoId: 'repA', dipendenteId: 'x' }, { uid: 'uCoordA', ruolo: 'SUPERADMIN' }),
    ).rejects.toMatchObject({ details: { codice: 'UTENTE_NON_ABILITATO' } });
  });

  it('input non valido', async () => {
    await expect(leggi({ repartoId: 'repA' })).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
  });

  it('se la voce di registro non si scrive, i dati non vengono restituiti', async () => {
    const dipendenteId = await creaUno();
    finto.guasti.add('reparti/repA/registroAttivita/');
    await expect(leggi({ repartoId: 'repA', dipendenteId })).rejects.toMatchObject({
      code: 'internal',
      details: { codice: 'ERRORE_INTERNO' },
    });
    nessunDatoPersonaleNeiLog();
  });

  it('un testo cifrato copiato in un altro dipendente non si decifra (AAD)', async () => {
    const primo = await creaUno();
    const secondo = (await salva(creazione({ privati: { ...privati, codiceFiscale: CF_ALTRO } })))
      .dipendenteId;
    const datiPrimo = finto.documenti.get(`reparti/repA/dipendenti/${primo}/privato/dati`);
    finto.imposta(`reparti/repA/dipendenti/${secondo}/privato/dati`, { ...datiPrimo });
    await expect(leggi({ repartoId: 'repA', dipendenteId: secondo })).rejects.toMatchObject({
      details: { codice: 'ERRORE_INTERNO' },
    });
    nessunDatoPersonaleNeiLog();
  });
});

describe('produzione: cifratura con Cloud KMS e chiave HMAC', () => {
  beforeEach(() => {
    vi.stubEnv('FUNCTIONS_EMULATOR', '');
    ambiente.kms = CHIAVE_KMS;
    ambiente.segreto = SEGRETO;
  });

  it('cifra e decifra con KMS: chiave, AAD per campo e nessun dato in chiaro nel database', async () => {
    const { dipendenteId } = await salva(creazione());
    expect(kmsFinto.chiamate).toEqual([
      { operazione: 'encrypt', name: CHIAVE_KMS, aad: `${dipendenteId}:codiceFiscale` },
      { operazione: 'encrypt', name: CHIAVE_KMS, aad: `${dipendenteId}:dataNascita` },
    ]);
    const privato = finto.documenti.get(`reparti/repA/dipendenti/${dipendenteId}/privato/dati`);
    expect(privato).toMatchObject({ chiaveKms: `${CHIAVE_KMS}/cryptoKeyVersions/1` });
    expect(JSON.stringify([...finto.documenti])).not.toContain(CF);

    await expect(leggi({ repartoId: 'repA', dipendenteId })).resolves.toMatchObject({
      codiceFiscale: CF,
      dataNascita: NASCITA,
    });
    expect(kmsFinto.chiamate.filter((c) => c.operazione === 'decrypt').map((c) => c.aad)).toEqual([
      `${dipendenteId}:codiceFiscale`,
      `${dipendenteId}:dataNascita`,
    ]);
    nessunDatoPersonaleNeiLog();
  });

  it('senza KMS configurato fallisce con errore interno e non scrive nulla (mai cifratura finta)', async () => {
    ambiente.kms = '';
    await expect(salva(creazione())).rejects.toMatchObject({
      code: 'internal',
      details: { codice: 'ERRORE_INTERNO' },
    });
    expect(
      [...finto.documenti.keys()].filter((p) => p.startsWith('reparti/repA/dipendenti')),
    ).toEqual([]);
    expect(indici()).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith('Cifratura non configurata: manca il parametro', {
      parametro: 'KMS_CHIAVE_DIPENDENTI',
    });
    nessunDatoPersonaleNeiLog();
  });

  it('senza chiave HMAC fallisce con errore interno', async () => {
    ambiente.segreto = '';
    await expect(salva(creazione())).rejects.toMatchObject({
      details: { codice: 'ERRORE_INTERNO' },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    nessunDatoPersonaleNeiLog();
  });

  it('errore di KMS: nei log solo nome e codice, non il messaggio', async () => {
    vi.doMock('@google-cloud/kms', () => ({
      KeyManagementServiceClient: class {
        encrypt() {
          return Promise.reject(
            Object.assign(new Error(`KMS rifiuta ${CF} di Laura`), { code: 7 }),
          );
        }
      },
    }));
    vi.resetModules();
    const { salvaDipendente: salvaConKmsGuasto } =
      await import('../src/dipendenti/salva-dipendente');
    await expect(salvaConKmsGuasto.run(richiesta(creazione(), COORD_A))).rejects.toMatchObject({
      details: { codice: 'ERRORE_INTERNO' },
    });
    nessunDatoPersonaleNeiLog();
    expect(log()).toContain('salvaDipendente');
    vi.doUnmock('@google-cloud/kms');
  });
});

describe('guasti di Firestore', () => {
  it('la scrittura fallisce: nessun documento a metà e nessun dato nei log', async () => {
    finto.guasti.add('indiceCodiciFiscali/');
    await expect(salva(creazione())).rejects.toMatchObject({
      details: { codice: 'ERRORE_INTERNO' },
    });
    expect(dipendentiDi('repA')).toEqual([]);
    expect(vociRegistro()).toEqual([]);
    nessunDatoPersonaleNeiLog();
  });
});
