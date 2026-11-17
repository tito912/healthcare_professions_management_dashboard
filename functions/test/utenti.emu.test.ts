// Callable utenti sugli emulatori (PIANO 1.1, criterio 7): senza autenticazione, senza ruolo, con ruolo
// sbagliato, con ADMIN disattivato, con input non valido, percorso corretto. Il client è l'SDK web, come
// nel browser; gli effetti si verificano con l'Admin SDK e, dove conta, con le Security Rules vere
// (Firestore dell'emulatore con firestore.rules).
import {
  confirmPasswordReset,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { schemaCreaCoordinatoreOutput } from '@turni/domain';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  PASSWORD_DI_PROVA,
  accedi,
  adminDiProva,
  clienteWeb,
  codiciOob,
  creaUtente,
  emailDi,
  svuotaEmulatori,
  type ClienteWeb,
} from './emulatori';

const admin = adminDiProva();

const UID = {
  admin: 'uAdmin',
  admin2: 'uAdmin2',
  adminSpento: 'uAdminSpento',
  coordA: 'uCoordA',
  coordB: 'uCoordB',
  coordSpento: 'uCoordSpento',
  coordDocSpento: 'uCoordDocSpento',
  senzaClaim: 'uSenzaClaim',
  claimNonValido: 'uClaimNonValido',
  claimSenzaDoc: 'uClaimSenzaDoc',
  claimDiscorde: 'uClaimDiscorde',
} as const;

const REPARTO = 'rep1';

const clienti: ClienteWeb[] = [];

async function come(uid: string): Promise<ClienteWeb> {
  const cliente = await accedi(uid);
  clienti.push(cliente);
  return cliente;
}

function anonimo(): ClienteWeb {
  const cliente = clienteWeb();
  clienti.push(cliente);
  return cliente;
}

beforeEach(async () => {
  await Promise.all(clienti.splice(0).map((c) => c.chiudi()));
  await svuotaEmulatori();
  await Promise.all([
    creaUtente(admin, {
      uid: UID.admin,
      ruolo: 'ADMIN',
      documento: { ruolo: 'ADMIN', attivo: true },
    }),
    creaUtente(admin, {
      uid: UID.admin2,
      ruolo: 'ADMIN',
      documento: { ruolo: 'ADMIN', attivo: true },
    }),
    creaUtente(admin, {
      uid: UID.adminSpento,
      ruolo: 'ADMIN',
      documento: { ruolo: 'ADMIN', attivo: false },
    }),
    creaUtente(admin, {
      uid: UID.coordA,
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: true },
    }),
    creaUtente(admin, {
      uid: UID.coordB,
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: true },
    }),
    creaUtente(admin, {
      uid: UID.coordSpento,
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: false },
      disabilitato: true,
    }),
    creaUtente(admin, {
      uid: UID.coordDocSpento,
      ruolo: 'COORDINATORE',
      documento: { ruolo: 'COORDINATORE', attivo: false },
    }),
    creaUtente(admin, {
      uid: UID.senzaClaim,
      ruolo: null,
      documento: { ruolo: 'COORDINATORE', attivo: true },
    }),
    creaUtente(admin, {
      uid: UID.claimNonValido,
      ruolo: 'SUPERADMIN',
      documento: { ruolo: 'SUPERADMIN', attivo: true },
    }),
    creaUtente(admin, { uid: UID.claimSenzaDoc, ruolo: 'ADMIN', documento: null }),
    creaUtente(admin, {
      uid: UID.claimDiscorde,
      ruolo: 'ADMIN',
      documento: { ruolo: 'COORDINATORE', attivo: true },
    }),
  ]);
  await admin.db.doc(`reparti/${REPARTO}`).set({
    nome: 'Cardiologia',
    coordinatoreUid: UID.coordA,
    configurazione: { passo: 'completata' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: Timestamp.fromMillis(0),
    creatoDa: UID.coordA,
    aggiornatoIl: Timestamp.fromMillis(0),
    aggiornatoDa: UID.coordA,
  });
});

afterAll(async () => {
  await Promise.all(clienti.splice(0).map((c) => c.chiudi()));
  await admin.chiudi();
});

async function attendiErrore(promessa: Promise<unknown>, https: string, codice: string) {
  await expect(promessa).rejects.toMatchObject({
    code: `functions/${https}`,
    details: { codice },
  });
}

async function attendiNegatoDalleRegole(promessa: Promise<unknown>) {
  await expect(promessa).rejects.toMatchObject({ code: 'permission-denied' });
}

async function vociRegistro(percorso: string) {
  const elenco = await admin.db.collection(percorso).get();
  return elenco.docs.map((d) => d.data());
}

/** Lo stato iniziale non è cambiato: nessuna voce di registro, nessun utente nuovo, nulla modificato. */
async function verificaNessunEffetto(): Promise<void> {
  expect(await vociRegistro('registroAttivita')).toEqual([]);
  expect(await vociRegistro(`reparti/${REPARTO}/registroAttivita`)).toEqual([]);
  const utenti = await admin.auth.listUsers();
  expect(utenti.users).toHaveLength(Object.keys(UID).length);
  expect((await admin.db.doc(`reparti/${REPARTO}`).get()).get('coordinatoreUid')).toBe(UID.coordA);
  expect((await admin.db.doc(`utenti/${UID.coordB}`).get()).get('attivo')).toBe(true);
  expect((await admin.auth.getUser(UID.coordB)).disabled).toBe(false);
}

// ---------------------------------------------------------------------------------------------
// Controlli comuni alle tre callable
// ---------------------------------------------------------------------------------------------

const CALLABLE = [
  {
    nome: 'creaCoordinatore',
    valido: { email: 'nuovo@prova.example', nome: 'Nuovo', cognome: 'Coordinatore' },
    nonValidi: [
      {},
      { email: 'non-una-email', nome: 'Nuovo', cognome: 'Coordinatore' },
      { email: 'nuovo@prova.example', nome: '', cognome: 'Coordinatore' },
      { email: 'nuovo@prova.example', nome: 'Nuovo', cognome: 'Coordinatore', ruolo: 'ADMIN' },
      'nuovo@prova.example',
      null,
    ],
  },
  {
    nome: 'impostaStatoUtente',
    valido: { uid: UID.coordB, attivo: false },
    nonValidi: [
      {},
      { uid: UID.coordB },
      { uid: UID.coordB, attivo: 'false' },
      { uid: 'utenti/uCoordB', attivo: false },
      { uid: UID.coordB, attivo: false, ruolo: 'ADMIN' },
    ],
  },
  {
    nome: 'assegnaReparto',
    valido: { repartoId: REPARTO, coordinatoreUid: UID.coordB },
    nonValidi: [
      {},
      { repartoId: REPARTO },
      { repartoId: `reparti/${REPARTO}`, coordinatoreUid: UID.coordB },
      { repartoId: REPARTO, coordinatoreUid: 42 },
      { repartoId: REPARTO, coordinatoreUid: UID.coordB, extra: true },
    ],
  },
] as const;

describe.each(CALLABLE)('$nome: autorizzazione e input', ({ nome, valido, nonValidi }) => {
  it('senza autenticazione: unauthenticated / NON_AUTENTICATO', async () => {
    await attendiErrore(anonimo().chiama(nome, valido), 'unauthenticated', 'NON_AUTENTICATO');
    await verificaNessunEffetto();
  });

  it.each([
    ['autenticato senza claim', UID.senzaClaim],
    ['claim non valido', UID.claimNonValido],
    ['claim ADMIN senza documento utente', UID.claimSenzaDoc],
    ['claim ADMIN con documento COORDINATORE', UID.claimDiscorde],
    ['ADMIN disattivato', UID.adminSpento],
  ])('%s: permission-denied / UTENTE_NON_ABILITATO', async (_caso, uid) => {
    const cliente = await come(uid);
    await attendiErrore(cliente.chiama(nome, valido), 'permission-denied', 'UTENTE_NON_ABILITATO');
    await verificaNessunEffetto();
  });

  it('ruolo sbagliato (COORDINATORE): permission-denied / RUOLO_NON_AUTORIZZATO', async () => {
    const cliente = await come(UID.coordA);
    await attendiErrore(cliente.chiama(nome, valido), 'permission-denied', 'RUOLO_NON_AUTORIZZATO');
    await verificaNessunEffetto();
  });

  it('input non valido: invalid-argument / INPUT_NON_VALIDO, nessun effetto', async () => {
    const cliente = await come(UID.admin);
    for (const dati of nonValidi) {
      await attendiErrore(cliente.chiama(nome, dati), 'invalid-argument', 'INPUT_NON_VALIDO');
    }
    await verificaNessunEffetto();
  });
});

// ---------------------------------------------------------------------------------------------
// creaCoordinatore
// ---------------------------------------------------------------------------------------------

describe('creaCoordinatore', () => {
  const EMAIL = 'maria.rossi@prova.example';

  it('percorso corretto: utente Auth con claim, utenti/{uid}, voce di registro', async () => {
    const cliente = await come(UID.admin);
    const risposta = await cliente.chiama('creaCoordinatore', {
      email: '  Maria.Rossi@Prova.example ',
      nome: ' Maria ',
      cognome: 'Rossi',
    });
    // Solo l'uid: lo schema di uscita è stretto (nessun campo in più, nessuna password).
    const { uid } = schemaCreaCoordinatoreOutput.parse(risposta);

    const record = await admin.auth.getUser(uid);
    expect(record.email).toBe(EMAIL);
    expect(record.disabled).toBe(false);
    expect(record.customClaims).toEqual({ ruolo: 'COORDINATORE' });

    const documento = (await admin.db.doc(`utenti/${uid}`).get()).data();
    expect(documento).toMatchObject({
      nome: 'Maria',
      cognome: 'Rossi',
      email: EMAIL,
      ruolo: 'COORDINATORE',
      attivo: true,
      creatoDa: UID.admin,
    });
    expect(documento?.['creatoIl']).toBeInstanceOf(Timestamp);
    expect(documento?.['aggiornatoIl']).toBeInstanceOf(Timestamp);
    expect(Object.keys(documento ?? {}).sort()).toEqual(
      [
        'nome',
        'cognome',
        'email',
        'ruolo',
        'attivo',
        'creatoIl',
        'creatoDa',
        'aggiornatoIl',
      ].sort(),
    );

    const voci = await vociRegistro('registroAttivita');
    expect(voci).toHaveLength(1);
    expect(voci[0]).toMatchObject({
      tipo: 'utente.creato',
      autoreUid: UID.admin,
      autoreNome: `Nome ${UID.admin}`,
      autoreRuolo: 'ADMIN',
      repartoId: null,
      chiaveMese: null,
      dipendenteId: null,
      dettagli: { uid, ruolo: 'COORDINATORE' },
    });
    expect(voci[0]?.['il']).toBeInstanceOf(Timestamp);
    // Nessun dato personale del nuovo utente nel registro (solo l'uid).
    expect(JSON.stringify(voci[0])).not.toMatch(/rossi/i);
  });

  it('il nuovo coordinatore sceglie la password con sendPasswordResetEmail ed entra', async () => {
    const cliente = await come(UID.admin);
    const { uid } = schemaCreaCoordinatoreOutput.parse(
      await cliente.chiama('creaCoordinatore', { email: EMAIL, nome: 'Maria', cognome: 'Rossi' }),
    );

    // Il browser dell'ADMIN invia l'email di reimpostazione (nessun SMTP nelle Functions).
    await sendPasswordResetEmail(cliente.auth, EMAIL);
    const codice = (await codiciOob()).find(
      (c) => c.email === EMAIL && c.requestType === 'PASSWORD_RESET',
    );
    expect(codice).toBeDefined();

    const nuovo = clienteWeb();
    clienti.push(nuovo);
    await confirmPasswordReset(nuovo.auth, codice?.oobCode ?? '', 'Nuova-password-1');
    const credenziali = await signInWithEmailAndPassword(nuovo.auth, EMAIL, 'Nuova-password-1');
    const token = await credenziali.user.getIdTokenResult();
    expect(token.claims['ruolo']).toBe('COORDINATORE');

    // Le regole lo riconoscono: legge il proprio documento, non l'elenco degli utenti.
    expect((await getDoc(doc(nuovo.db, `utenti/${uid}`))).get('ruolo')).toBe('COORDINATORE');
    await attendiNegatoDalleRegole(getDocs(collection(nuovo.db, 'utenti')));
  });

  it.each([
    ['email di un utente esistente', emailDi(UID.coordA)],
    ['stessa email con maiuscole', emailDi(UID.coordA).toUpperCase()],
  ])('%s: already-exists / EMAIL_GIA_USATA', async (_caso, email) => {
    const cliente = await come(UID.admin);
    await attendiErrore(
      cliente.chiama('creaCoordinatore', { email, nome: 'Maria', cognome: 'Rossi' }),
      'already-exists',
      'EMAIL_GIA_USATA',
    );
    await verificaNessunEffetto();
  });
});

// ---------------------------------------------------------------------------------------------
// impostaStatoUtente
// ---------------------------------------------------------------------------------------------

describe('impostaStatoUtente', () => {
  it('disattivazione: effetto immediato su Firestore, accesso e rinnovo del token', async () => {
    const coordinatore = await come(UID.coordA);
    // Prima: legge il proprio reparto e il proprio documento.
    expect((await getDoc(doc(coordinatore.db, `reparti/${REPARTO}`))).exists()).toBe(true);
    const tokenPrima = await coordinatore.auth.currentUser?.getIdToken();
    expect(tokenPrima).toBeDefined();
    // Il controllo dei token revocati confronta secondi interi: la revoca deve cadere in un secondo
    // successivo all'accesso.
    await new Promise((fatto) => setTimeout(fatto, 1_100));

    const amministratore = await come(UID.admin);
    expect(
      await amministratore.chiama('impostaStatoUtente', { uid: UID.coordA, attivo: false }),
    ).toEqual({ uid: UID.coordA, attivo: false });

    // Subito: stessa sessione, stesso token ancora valido, ma le regole leggono attivo == false.
    await attendiNegatoDalleRegole(getDoc(doc(coordinatore.db, `reparti/${REPARTO}`)));
    await attendiNegatoDalleRegole(getDoc(doc(coordinatore.db, `utenti/${UID.coordA}`)));
    // Subito: il rinnovo del token fallisce (il browser esce) e non si rientra.
    await expect(coordinatore.auth.currentUser?.getIdToken(true)).rejects.toMatchObject({
      code: 'auth/user-disabled',
    });
    const altraScheda = clienteWeb();
    clienti.push(altraScheda);
    await expect(
      signInWithEmailAndPassword(altraScheda.auth, emailDi(UID.coordA), PASSWORD_DI_PROVA),
    ).rejects.toMatchObject({ code: 'auth/user-disabled' });

    const documento = await admin.db.doc(`utenti/${UID.coordA}`).get();
    expect(documento.get('attivo')).toBe(false);
    expect(documento.get('aggiornatoIl')).toBeInstanceOf(Timestamp);
    expect((await admin.auth.getUser(UID.coordA)).disabled).toBe(true);
    await expect(admin.auth.verifyIdToken(tokenPrima ?? '', true)).rejects.toMatchObject({
      code: 'auth/user-disabled',
    });

    expect(await vociRegistro('registroAttivita')).toEqual([
      expect.objectContaining({
        tipo: 'utente.stato',
        autoreUid: UID.admin,
        autoreRuolo: 'ADMIN',
        repartoId: null,
        dettagli: { uid: UID.coordA, attivo: false, prima: true },
      }),
    ]);

    // Riattivazione: l'account torna utilizzabile, ma il token emesso prima resta revocato.
    expect(
      await amministratore.chiama('impostaStatoUtente', { uid: UID.coordA, attivo: true }),
    ).toEqual({ uid: UID.coordA, attivo: true });
    await expect(admin.auth.verifyIdToken(tokenPrima ?? '', true)).rejects.toMatchObject({
      code: 'auth/id-token-revoked',
    });
    const dinuovo = await come(UID.coordA);
    expect((await getDoc(doc(dinuovo.db, `reparti/${REPARTO}`))).exists()).toBe(true);
    expect((await admin.auth.getUser(UID.coordA)).disabled).toBe(false);
    expect((await admin.db.doc(`utenti/${UID.coordA}`).get()).get('attivo')).toBe(true);
    const voci = await admin.db.collection('registroAttivita').orderBy('il').get();
    expect(voci.docs.map((v) => v.get('dettagli'))).toEqual([
      { uid: UID.coordA, attivo: false, prima: true },
      { uid: UID.coordA, attivo: true, prima: false },
    ]);
  });

  it('ripetere la disattivazione è innocuo e resta registrato', async () => {
    const amministratore = await come(UID.admin);
    await amministratore.chiama('impostaStatoUtente', { uid: UID.coordSpento, attivo: false });
    expect((await admin.auth.getUser(UID.coordSpento)).disabled).toBe(true);
    expect(await vociRegistro('registroAttivita')).toEqual([
      expect.objectContaining({ dettagli: { uid: UID.coordSpento, attivo: false, prima: false } }),
    ]);
  });

  it.each([
    ['un altro ADMIN', UID.admin2],
    ['sé stesso', UID.admin],
    ['un utente con claim ADMIN e documento COORDINATORE', UID.claimDiscorde],
  ])('destinatario %s: failed-precondition / NON_COORDINATORE', async (_caso, uid) => {
    const amministratore = await come(UID.admin);
    await attendiErrore(
      amministratore.chiama('impostaStatoUtente', { uid, attivo: false }),
      'failed-precondition',
      'NON_COORDINATORE',
    );
    expect((await admin.auth.getUser(uid)).disabled).toBe(false);
    await verificaNessunEffetto();
  });

  it('destinatario inesistente: not-found / NON_TROVATO', async () => {
    const amministratore = await come(UID.admin);
    await attendiErrore(
      amministratore.chiama('impostaStatoUtente', { uid: 'uInesistente', attivo: false }),
      'not-found',
      'NON_TROVATO',
    );
    await verificaNessunEffetto();
  });
});

// ---------------------------------------------------------------------------------------------
// assegnaReparto
// ---------------------------------------------------------------------------------------------

describe('assegnaReparto', () => {
  it('percorso corretto: cambia coordinatoreUid, registra, e le regole seguono subito', async () => {
    const vecchio = await come(UID.coordA);
    const nuovo = await come(UID.coordB);
    await attendiNegatoDalleRegole(getDoc(doc(nuovo.db, `reparti/${REPARTO}`)));

    const amministratore = await come(UID.admin);
    expect(
      await amministratore.chiama('assegnaReparto', {
        repartoId: REPARTO,
        coordinatoreUid: UID.coordB,
      }),
    ).toEqual({ repartoId: REPARTO, coordinatoreUid: UID.coordB });

    const reparto = await admin.db.doc(`reparti/${REPARTO}`).get();
    expect(reparto.get('coordinatoreUid')).toBe(UID.coordB);
    expect(reparto.get('aggiornatoDa')).toBe(UID.admin);
    expect(reparto.get('creatoDa')).toBe(UID.coordA);

    expect(await vociRegistro(`reparti/${REPARTO}/registroAttivita`)).toEqual([
      expect.objectContaining({
        tipo: 'reparto.assegnato',
        autoreUid: UID.admin,
        autoreRuolo: 'ADMIN',
        repartoId: REPARTO,
        dettagli: { prima: UID.coordA, dopo: UID.coordB },
      }),
    ]);
    expect(await vociRegistro('registroAttivita')).toEqual([]);

    // Il vecchio coordinatore perde l'accesso, il nuovo lo ottiene (anche in scrittura).
    await attendiNegatoDalleRegole(getDoc(doc(vecchio.db, `reparti/${REPARTO}`)));
    await attendiNegatoDalleRegole(
      updateDoc(doc(vecchio.db, `reparti/${REPARTO}`), {
        nome: 'Ripreso',
        aggiornatoIl: serverTimestamp(),
        aggiornatoDa: UID.coordA,
      }),
    );
    expect((await getDoc(doc(nuovo.db, `reparti/${REPARTO}`))).exists()).toBe(true);
    await updateDoc(doc(nuovo.db, `reparti/${REPARTO}`), {
      nome: 'Cardiologia 2',
      aggiornatoIl: serverTimestamp(),
      aggiornatoDa: UID.coordB,
    });
    // Il nuovo coordinatore legge la voce nel registro del proprio reparto.
    expect((await getDocs(collection(nuovo.db, `reparti/${REPARTO}/registroAttivita`))).size).toBe(
      1,
    );
  });

  it('reparto inesistente: not-found / NON_TROVATO', async () => {
    const amministratore = await come(UID.admin);
    await attendiErrore(
      amministratore.chiama('assegnaReparto', {
        repartoId: 'repInesistente',
        coordinatoreUid: UID.coordB,
      }),
      'not-found',
      'NON_TROVATO',
    );
    expect((await admin.db.doc('reparti/repInesistente').get()).exists).toBe(false);
    await verificaNessunEffetto();
  });

  it.each([
    ['un ADMIN', UID.admin2],
    ['un coordinatore disattivato', UID.coordSpento],
    ['un coordinatore con il solo documento disattivato', UID.coordDocSpento],
    ['un utente senza claim', UID.senzaClaim],
    ['un utente con claim e documento discordi', UID.claimDiscorde],
    ['un uid inesistente', 'uInesistente'],
  ])('destinatario %s: failed-precondition / COORDINATORE_NON_VALIDO', async (_caso, uid) => {
    const amministratore = await come(UID.admin);
    await attendiErrore(
      amministratore.chiama('assegnaReparto', { repartoId: REPARTO, coordinatoreUid: uid }),
      'failed-precondition',
      'COORDINATORE_NON_VALIDO',
    );
    await verificaNessunEffetto();
  });
});
