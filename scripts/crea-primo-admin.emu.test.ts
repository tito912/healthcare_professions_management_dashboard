// scripts/crea-primo-admin.ts sugli emulatori (PIANO 1.1, criterio 8): lo script gira come da riga di
// comando (processo separato); gli effetti si verificano con l'Admin SDK e con le Security Rules vere.
// Il caso «progetto reale» non raggiunge mai la rete: senza la conferma esatta lo script si ferma prima
// di inizializzare l'SDK, e il processo non ha comunque credenziali utilizzabili.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  accedi,
  adminDiProva,
  clienteWeb,
  codiciOob,
  creaUtente,
  emailDi,
  radice,
  svuotaEmulatori,
  type ClienteWeb,
} from '../functions/test/emulatori';

const admin = adminDiProva();
const clienti: ClienteWeb[] = [];

interface Esito {
  readonly codice: number | null;
  readonly uscita: string;
  readonly errori: string;
}

const VARIABILI_EMULATORI = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_FIRESTORE_EMULATOR_ADDRESS',
  'FIREBASE_EMULATOR_HUB',
  'GCLOUD_PROJECT',
  'FIREBASE_CONFIG',
];

/** Ambiente del processo senza le variabili degli emulatori e senza credenziali utilizzabili. */
function ambienteSenzaEmulatori(): NodeJS.ProcessEnv {
  const ambiente: NodeJS.ProcessEnv = { ...process.env };
  for (const nome of VARIABILI_EMULATORI) {
    delete ambiente[nome];
  }
  ambiente['GOOGLE_APPLICATION_CREDENTIALS'] = path.join(radice, 'inesistente', 'chiave.json');
  ambiente['CLOUDSDK_CONFIG'] = path.join(radice, 'inesistente');
  return ambiente;
}

function esegui(
  argomenti: readonly string[],
  opzioni: { ambiente?: NodeJS.ProcessEnv; ingresso?: string } = {},
): Promise<Esito> {
  return new Promise((risolvi, rifiuta) => {
    const processo = spawn(
      path.join(radice, 'node_modules/.bin/tsx'),
      [path.join(radice, 'scripts/crea-primo-admin.ts'), ...argomenti],
      { cwd: radice, env: opzioni.ambiente ?? process.env },
    );
    let uscita = '';
    let errori = '';
    processo.stdout.on('data', (parte: Buffer) => (uscita += parte.toString()));
    processo.stderr.on('data', (parte: Buffer) => (errori += parte.toString()));
    processo.on('error', rifiuta);
    processo.on('close', (codice) => risolvi({ codice, uscita, errori }));
    processo.stdin.end(opzioni.ingresso ?? '');
  });
}

beforeEach(async () => {
  await Promise.all(clienti.splice(0).map((c) => c.chiudi()));
  await svuotaEmulatori();
});

afterAll(async () => {
  await Promise.all(clienti.splice(0).map((c) => c.chiudi()));
  await admin.chiudi();
});

const EMAIL = 'anna.verdi@prova.example';

describe('crea-primo-admin sugli emulatori', () => {
  it('--emulatore crea un ADMIN nuovo che le regole riconoscono', async () => {
    // Solo --emulatore: le porte vengono da firebase.json, il progetto è demo-turni.
    const esito = await esegui(
      [
        '--emulatore',
        '--email',
        ' Anna.Verdi@Prova.example',
        '--nome',
        'Anna',
        '--cognome',
        'Verdi',
      ],
      { ambiente: ambienteSenzaEmulatori() },
    );
    expect(esito.errori).toBe('');
    expect(esito.codice).toBe(0);
    expect(esito.uscita).toContain('ADMIN creato (emulatori, progetto demo-turni)');
    expect(esito.uscita).not.toMatch(/verdi@/i);

    const record = await admin.auth.getUserByEmail(EMAIL);
    expect(record.customClaims).toEqual({ ruolo: 'ADMIN' });
    expect(record.disabled).toBe(false);
    expect(esito.uscita).toContain(record.uid);

    const documento = (await admin.db.doc(`utenti/${record.uid}`).get()).data();
    expect(documento).toMatchObject({
      nome: 'Anna',
      cognome: 'Verdi',
      email: EMAIL,
      ruolo: 'ADMIN',
      attivo: true,
      creatoDa: null,
    });
    expect(documento?.['creatoIl']).toBeInstanceOf(Timestamp);

    const voci = (await admin.db.collection('registroAttivita').get()).docs.map((d) => d.data());
    expect(voci).toEqual([
      expect.objectContaining({
        tipo: 'utente.creato',
        autoreUid: null,
        autoreNome: null,
        autoreRuolo: 'SISTEMA',
        repartoId: null,
        dettagli: {
          uid: record.uid,
          ruolo: 'ADMIN',
          origine: 'crea-primo-admin',
          utenteEsistente: false,
        },
      }),
    ]);

    // L'ADMIN sceglie la password con «Password dimenticata?» ed entra: le regole lo riconoscono.
    const browser = clienteWeb();
    clienti.push(browser);
    await sendPasswordResetEmail(browser.auth, EMAIL);
    const codice = (await codiciOob()).find((c) => c.email === EMAIL);
    await confirmPasswordReset(browser.auth, codice?.oobCode ?? '', 'Password-admin-1');
    await signInWithEmailAndPassword(browser.auth, EMAIL, 'Password-admin-1');
    expect((await getDocs(collection(browser.db, 'utenti'))).size).toBe(1);
  });

  it('promuove un coordinatore esistente: claim e documento ADMIN, token revocati', async () => {
    await creaUtente(admin, {
      uid: 'uCoord',
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: true },
    });
    await admin.db.doc('reparti/rep1').set({ coordinatoreUid: 'uCoord', nome: 'Cardiologia' });
    const sessione = await accedi('uCoord');
    clienti.push(sessione);
    const tokenPrima = await sessione.auth.currentUser?.getIdToken();
    // La revoca confronta secondi interi: deve cadere dopo l'accesso.
    await new Promise((fatto) => setTimeout(fatto, 1_100));

    const esito = await esegui(['--email', emailDi('uCoord')]);
    expect(esito.errori).toBe('');
    expect(esito.codice).toBe(0);
    expect(esito.uscita).toContain('Utente esistente promosso ad ADMIN');
    expect(esito.uscita).toContain('ancora coordinatore di 1 reparti');

    expect((await admin.auth.getUser('uCoord')).customClaims).toEqual({ ruolo: 'ADMIN' });
    const documento = await admin.db.doc('utenti/uCoord').get();
    expect(documento.get('ruolo')).toBe('ADMIN');
    expect(documento.get('attivo')).toBe(true);
    expect(documento.get('cognome')).toBe('uCoord');
    await expect(admin.auth.verifyIdToken(tokenPrima ?? '', true)).rejects.toMatchObject({
      code: 'auth/id-token-revoked',
    });
    // Con il vecchio token (claim COORDINATORE, documento ADMIN) le regole non riconoscono l'utente.
    await expect(getDoc(doc(sessione.db, 'reparti/rep1'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('riabilita un utente disattivato che viene promosso', async () => {
    await creaUtente(admin, {
      uid: 'uSpento',
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: false },
      disabilitato: true,
    });
    const esito = await esegui(['--email', emailDi('uSpento')]);
    expect(esito.codice).toBe(0);
    expect((await admin.auth.getUser('uSpento')).disabled).toBe(false);
    expect((await admin.db.doc('utenti/uSpento').get()).get('attivo')).toBe(true);
  });

  it('utente nuovo senza --nome e --cognome: errore e nessuna modifica', async () => {
    const esito = await esegui(['--email', EMAIL]);
    expect(esito.codice).toBe(1);
    expect(esito.errori).toContain('servono --nome e --cognome');
    expect((await admin.auth.listUsers()).users).toEqual([]);
    expect((await admin.db.collection('registroAttivita').get()).empty).toBe(true);
  });

  it.each([
    ['email mancante', ['--emulatore']],
    ['email non valida', ['--emulatore', '--email', 'non-una-email']],
    ['nome troppo lungo', ['--emulatore', '--email', EMAIL, '--nome', 'x'.repeat(61)]],
    ['argomento sconosciuto', ['--emulatore', '--email', EMAIL, '--ruolo', 'ADMIN']],
  ])('%s: errore d’uso, nessuna modifica', async (_caso, argomenti) => {
    const esito = await esegui(argomenti);
    expect(esito.codice).toBe(1);
    expect(esito.errori).toContain('Uso:');
    expect((await admin.auth.listUsers()).users).toEqual([]);
  });
});

describe('crea-primo-admin fuori dagli emulatori', () => {
  it.each([
    ['risposta diversa dall’ID', 'demo-turni\n'],
    ['risposta vuota', '\n'],
    ['ingresso chiuso senza risposta', ''],
  ])('--project chiede conferma; %s: nessuna modifica', async (_caso, ingresso) => {
    const esito = await esegui(
      [
        '--project',
        'progetto-finto-prova',
        '--email',
        EMAIL,
        '--nome',
        'Anna',
        '--cognome',
        'Verdi',
      ],
      { ambiente: ambienteSenzaEmulatori(), ingresso },
    );
    expect(esito.uscita).toContain('progetto reale «progetto-finto-prova»');
    expect(esito.uscita).toContain('Digita l’ID del progetto per confermare');
    expect(esito.errori).toContain('Conferma non valida: nessuna modifica.');
    expect(esito.codice).toBe(1);
  });

  it('senza --emulatore né --project: errore d’uso', async () => {
    const esito = await esegui(['--email', EMAIL], { ambiente: ambienteSenzaEmulatori() });
    expect(esito.codice).toBe(1);
    expect(esito.errori).toContain('Indicare --emulatore oppure --project <id>.');
  });

  it('configurazione mista (solo Firestore sull’emulatore): rifiutata', async () => {
    const ambiente = ambienteSenzaEmulatori();
    ambiente['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
    const esito = await esegui(['--project', 'progetto-finto-prova', '--email', EMAIL], {
      ambiente,
    });
    expect(esito.codice).toBe(1);
    expect(esito.errori).toContain('Configurazione mista');
  });
});
