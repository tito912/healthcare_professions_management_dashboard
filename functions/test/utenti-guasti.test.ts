// Callable utenti con l'Admin SDK simulato, senza emulatori (review 1.1, rilievi 2, 3 e 4): un passo alla
// volta fallisce e si verifica che cosa resta scritto. Provano l'ordine «a prova di guasto» di
// impostaStatoUtente, l'annullamento di creaCoordinatore e che nei log non finiscano email, nomi o
// messaggi degli errori. Il percorso completo, con Auth e Firestore veri, è in utenti.emu.test.ts.
import * as logger from 'firebase-functions/logger';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { creaCoordinatore } from '../src/utenti/crea-coordinatore';
import { impostaStatoUtente } from '../src/utenti/imposta-stato-utente';

const finto = vi.hoisted(() => {
  type Dati = Record<string, unknown>;
  interface UtenteAuth {
    disabled: boolean;
    customClaims: Dati | undefined;
  }
  interface Rif {
    readonly path: string;
    get(): Promise<Istantanea>;
    collection(nome: string): Raccolta;
  }
  interface Istantanea {
    readonly exists: boolean;
    readonly ref: Rif;
    get(campo: string): unknown;
  }
  interface Raccolta {
    doc(): Rif;
  }
  interface Scrittura {
    readonly tipo: 'create' | 'update';
    readonly path: string;
    readonly dati: Dati;
  }

  const EMAIL = 'mario.rossi@ospedale.it';
  const documenti = new Map<string, Dati>();
  const utentiAuth = new Map<string, UtenteAuth>();
  /** Scritture tentate, nell'ordine: una che fallisce compare e interrompe la sequenza. */
  const passi: string[] = [];
  const guasti = new Set<string>();
  let contatore = 0;

  function passo(nome: string): void {
    passi.push(nome);
    if (guasti.has(nome)) {
      // Come un errore gRPC dell'Admin SDK (14 = UNAVAILABLE), con un dato personale nel messaggio.
      throw Object.assign(new Error(`guasto simulato per ${EMAIL}`), { code: 14 });
    }
  }

  function istantanea(path: string): Istantanea {
    const dati = documenti.get(path);
    return { exists: dati !== undefined, ref: rif(path), get: (campo) => dati?.[campo] };
  }

  function rif(path: string): Rif {
    return {
      path,
      get: () => Promise.resolve(istantanea(path)),
      collection: (nome) => raccolta(`${path}/${nome}`),
    };
  }

  function raccolta(path: string): Raccolta {
    return { doc: () => rif(`${path}/auto${++contatore}`) };
  }

  function applica(scritture: readonly Scrittura[]): void {
    for (const { tipo, path, dati } of scritture) {
      documenti.set(path, tipo === 'update' ? { ...documenti.get(path), ...dati } : { ...dati });
    }
  }

  function scritturePendenti() {
    const scritture: Scrittura[] = [];
    return {
      scritture,
      create(r: Rif, dati: Dati): void {
        scritture.push({ tipo: 'create', path: r.path, dati });
      },
      update(r: Rif, dati: Dati): void {
        scritture.push({ tipo: 'update', path: r.path, dati });
      },
    };
  }

  const db = {
    collection: (nome: string) => raccolta(nome),
    async runTransaction(
      funzione: (
        t: ReturnType<typeof scritturePendenti> & { get(r: Rif): Promise<Istantanea> },
      ) => Promise<void>,
    ): Promise<void> {
      const pendenti = scritturePendenti();
      await funzione({ ...pendenti, get: (r) => Promise.resolve(istantanea(r.path)) });
      passo('firestore.transazione');
      applica(pendenti.scritture);
    },
    batch() {
      const pendenti = scritturePendenti();
      return {
        create: pendenti.create,
        commit(): Promise<void> {
          passo('firestore.batch');
          applica(pendenti.scritture);
          return Promise.resolve();
        },
      };
    },
  };

  const auth = {
    createUser(): Promise<{ uid: string }> {
      passo('auth.createUser');
      const uid = `nuovo${++contatore}`;
      utentiAuth.set(uid, { disabled: false, customClaims: undefined });
      return Promise.resolve({ uid });
    },
    getUser(uid: string): Promise<{ uid: string } & UtenteAuth> {
      const utente = utentiAuth.get(uid);
      return utente === undefined
        ? Promise.reject(Object.assign(new Error('assente'), { code: 'auth/user-not-found' }))
        : Promise.resolve({ uid, ...utente });
    },
    updateUser(uid: string, modifica: { disabled: boolean }): Promise<void> {
      passo(`auth.updateUser(disabled=${String(modifica.disabled)})`);
      const utente = utentiAuth.get(uid);
      if (utente !== undefined) utente.disabled = modifica.disabled;
      return Promise.resolve();
    },
    revokeRefreshTokens(): Promise<void> {
      passo('auth.revokeRefreshTokens');
      return Promise.resolve();
    },
    setCustomUserClaims(uid: string, claims: Dati): Promise<void> {
      passo('auth.setCustomUserClaims');
      const utente = utentiAuth.get(uid);
      if (utente !== undefined) utente.customClaims = claims;
      return Promise.resolve();
    },
    deleteUser(uid: string): Promise<void> {
      passo('auth.deleteUser');
      utentiAuth.delete(uid);
      return Promise.resolve();
    },
  };

  return {
    EMAIL,
    ADMIN: { uid: 'uAdmin', ruolo: 'ADMIN', nomeCompleto: 'Anna Verdi' } as const,
    documenti,
    utentiAuth,
    passi,
    guasti,
    db,
    auth,
    rif,
    azzera(): void {
      documenti.clear();
      utentiAuth.clear();
      passi.length = 0;
      guasti.clear();
      contatore = 0;
    },
  };
});

vi.mock('firebase-functions/logger', () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../src/comune/autorizzazione', () => ({
  richiediAdmin: () => Promise.resolve(finto.ADMIN),
}));
vi.mock('../src/comune/admin', () => ({
  auth: () => finto.auth,
  db: () => finto.db,
  oraServer: () => 'oraServer',
  rifUtente: (uid: string) => finto.rif(`utenti/${uid}`),
  rifReparto: (id: string) => finto.rif(`reparti/${id}`),
}));

/** Richiesta callable minima: i gestori leggono solo `data` (l'ADMIN lo dà `richiediAdmin` simulato). */
function richiesta(data: unknown): CallableRequest<unknown> {
  // Nessuna callable legge la richiesta HTTP grezza: basta un oggetto vuoto.
  const rawRequest: CallableRequest['rawRequest'] = Object.create(null);
  return { data, rawRequest, acceptsStreaming: false };
}

const ERRORE_INTERNO = { code: 'internal', details: { codice: 'ERRORE_INTERNO' } };

/** Tutto ciò che è finito nei log, per cercarvi dati personali. */
function log(): string {
  return JSON.stringify([
    vi.mocked(logger.info).mock.calls,
    vi.mocked(logger.warn).mock.calls,
    vi.mocked(logger.error).mock.calls,
  ]);
}

function seminaCoordinatore(uid: string, attivo: boolean): void {
  finto.documenti.set(`utenti/${uid}`, {
    nome: 'Mario',
    cognome: 'Rossi',
    email: finto.EMAIL,
    ruolo: 'COORDINATORE',
    attivo,
  });
  finto.utentiAuth.set(uid, { disabled: !attivo, customClaims: { ruolo: 'COORDINATORE' } });
}

function vociRegistro(): unknown[] {
  return [...finto.documenti]
    .filter(([path]) => path.startsWith('registroAttivita/'))
    .map(([, dati]) => dati);
}

beforeEach(() => {
  finto.azzera();
  vi.clearAllMocks();
});

describe('impostaStatoUtente: ordine a prova di guasto (review 1.1, rilievo 4)', () => {
  const disattiva = () => impostaStatoUtente.run(richiesta({ uid: 'uCoord', attivo: false }));
  const riattiva = () => impostaStatoUtente.run(richiesta({ uid: 'uCoord', attivo: true }));
  const attivoNelDocumento = () => finto.documenti.get('utenti/uCoord')?.['attivo'];

  it('disattivazione: prima Firestore, poi Auth disabilitato e token revocati', async () => {
    seminaCoordinatore('uCoord', true);
    await expect(disattiva()).resolves.toEqual({ uid: 'uCoord', attivo: false });
    expect(finto.passi).toEqual([
      'firestore.transazione',
      'auth.updateUser(disabled=true)',
      'auth.revokeRefreshTokens',
    ]);
    expect(attivoNelDocumento()).toBe(false);
    expect(finto.utentiAuth.get('uCoord')?.disabled).toBe(true);
  });

  it.each(['auth.updateUser(disabled=true)', 'auth.revokeRefreshTokens'])(
    'disattivazione con %s che fallisce: il documento dice già attivo=false (accesso bloccato)',
    async (guasto) => {
      seminaCoordinatore('uCoord', true);
      finto.guasti.add(guasto);
      await expect(disattiva()).rejects.toMatchObject(ERRORE_INTERNO);
      expect(attivoNelDocumento()).toBe(false);
      expect(vociRegistro()).toMatchObject([{ tipo: 'utente.stato', dettagli: { attivo: false } }]);
    },
  );

  it('disattivazione con Firestore che fallisce: Auth non è toccato', async () => {
    seminaCoordinatore('uCoord', true);
    finto.guasti.add('firestore.transazione');
    await expect(disattiva()).rejects.toMatchObject(ERRORE_INTERNO);
    expect(finto.passi).toEqual(['firestore.transazione']);
    expect(attivoNelDocumento()).toBe(true);
    expect(vociRegistro()).toEqual([]);
  });

  it('riattivazione: prima Auth riabilitato, poi Firestore', async () => {
    seminaCoordinatore('uCoord', false);
    await expect(riattiva()).resolves.toEqual({ uid: 'uCoord', attivo: true });
    expect(finto.passi).toEqual(['auth.updateUser(disabled=false)', 'firestore.transazione']);
    expect(attivoNelDocumento()).toBe(true);
    expect(finto.utentiAuth.get('uCoord')?.disabled).toBe(false);
  });

  it.each(['auth.updateUser(disabled=false)', 'firestore.transazione'])(
    'riattivazione con %s che fallisce: il documento resta attivo=false (ancora disattivato)',
    async (guasto) => {
      seminaCoordinatore('uCoord', false);
      finto.guasti.add(guasto);
      await expect(riattiva()).rejects.toMatchObject(ERRORE_INTERNO);
      expect(attivoNelDocumento()).toBe(false);
      expect(vociRegistro()).toEqual([]);
    },
  );

  it('ripetuta dopo un guasto, completa l’operazione (idempotente)', async () => {
    seminaCoordinatore('uCoord', true);
    finto.guasti.add('auth.revokeRefreshTokens');
    await expect(disattiva()).rejects.toMatchObject(ERRORE_INTERNO);
    finto.guasti.clear();
    await expect(disattiva()).resolves.toEqual({ uid: 'uCoord', attivo: false });
    expect(attivoNelDocumento()).toBe(false);
    expect(finto.utentiAuth.get('uCoord')?.disabled).toBe(true);
  });

  it('errore imprevisto: nei log nome e codice numerico, non il messaggio (rilievo 3)', async () => {
    seminaCoordinatore('uCoord', true);
    finto.guasti.add('firestore.transazione');
    await expect(disattiva()).rejects.toBeInstanceOf(HttpsError);
    expect(logger.error).toHaveBeenCalledWith('Errore interno della callable', {
      funzione: 'impostaStatoUtente',
      errore: 'Error',
      codiceNumerico: 14,
    });
    expect(log()).not.toContain('guasto simulato');
    expect(log()).not.toContain(finto.EMAIL);
  });
});

describe('creaCoordinatore: annullamento e log (review 1.1, rilievi 2 e 4)', () => {
  const input = { email: finto.EMAIL, nome: 'Mario', cognome: 'Rossi' };
  const crea = () => creaCoordinatore.run(richiesta(input));

  /** Nessuna email, nessun nome, nessun messaggio d'errore in nessuna riga di log. */
  function verificaLogSenzaDatiPersonali(): void {
    expect(log()).not.toMatch(/mario|rossi|ospedale/i);
    expect(log()).not.toContain('guasto simulato');
  }

  it('percorso corretto: Auth, claim, poi utente e voce di registro nello stesso batch', async () => {
    await expect(crea()).resolves.toEqual({ uid: 'nuovo1' });
    expect(finto.passi).toEqual(['auth.createUser', 'auth.setCustomUserClaims', 'firestore.batch']);
    expect(finto.documenti.get('utenti/nuovo1')).toMatchObject({
      email: finto.EMAIL,
      attivo: true,
    });
    expect(vociRegistro()).toMatchObject([{ tipo: 'utente.creato', dettagli: { uid: 'nuovo1' } }]);
    expect(logger.info).toHaveBeenCalledWith('Coordinatore creato', {
      uid: 'nuovo1',
      autoreUid: 'uAdmin',
    });
    verificaLogSenzaDatiPersonali();
  });

  it('input non valido: nei log solo i campi, non i valori', async () => {
    await expect(
      creaCoordinatore.run(richiesta({ ...input, email: 'mario.rossi@' })),
    ).rejects.toMatchObject({ code: 'invalid-argument', details: { codice: 'INPUT_NON_VALIDO' } });
    expect(logger.warn).toHaveBeenCalledWith('Input non valido', {
      funzione: 'creaCoordinatore',
      campi: ['email'],
    });
    verificaLogSenzaDatiPersonali();
  });

  it.each(['auth.setCustomUserClaims', 'firestore.batch'])(
    '%s che fallisce: l’utente Auth appena creato è eliminato',
    async (guasto) => {
      finto.guasti.add(guasto);
      await expect(crea()).rejects.toMatchObject(ERRORE_INTERNO);
      expect(finto.passi.at(-1)).toBe('auth.deleteUser');
      expect(finto.utentiAuth.size).toBe(0);
      expect(finto.documenti.size).toBe(0);
      verificaLogSenzaDatiPersonali();
    },
  );

  it('se anche l’eliminazione fallisce: nei log l’uid e il codice, poi ERRORE_INTERNO', async () => {
    finto.guasti.add('firestore.batch');
    finto.guasti.add('auth.deleteUser');
    await expect(crea()).rejects.toMatchObject(ERRORE_INTERNO);
    expect(logger.error).toHaveBeenCalledWith(
      'Eliminazione dell’utente Auth non riuscita dopo un errore',
      { uid: 'nuovo1', errore: 'Error', codiceNumerico: 14 },
    );
    expect(finto.documenti.size).toBe(0);
    verificaLogSenzaDatiPersonali();
  });
});
