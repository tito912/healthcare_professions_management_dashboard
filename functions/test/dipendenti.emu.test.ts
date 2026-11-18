// salvaDipendente e leggiDatiPrivati sugli emulatori (PIANO 1.4, criteri 2-6): Functions vere, Firestore con le
// Security Rules vere, client web come nel browser. Qui la cifratura è quella locale non sicura
// (FUNCTIONS_EMULATOR === 'true'): si prova il percorso completo, non la sicurezza di KMS.
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { accedi, adminDiProva, creaUtente, svuotaEmulatori, type ClienteWeb } from './emulatori';

const admin = adminDiProva();

const CF = 'BNCLRA80A41H501D';
const CF_ALTRO = 'RSSMRA85T10A562S';
const NASCITA = '1980-01-01';
const EMAIL = 'laura.bianchi@ospedale.it';

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
const creazione = (repartoId = 'repA', cambi: Record<string, unknown> = {}) => ({
  repartoId,
  dipendenteId: null,
  anagrafica,
  privati,
  ...cambi,
});

const clienti = new Map<string, ClienteWeb>();
async function come(uid: string): Promise<ClienteWeb> {
  const esistente = clienti.get(uid);
  if (esistente !== undefined) return esistente;
  const cliente = await accedi(uid);
  clienti.set(uid, cliente);
  return cliente;
}

async function salva(uid: string, dati: unknown): Promise<{ dipendenteId: string }> {
  const esito = await (await come(uid)).chiama('salvaDipendente', dati);
  if (typeof esito !== 'object' || esito === null || !('dipendenteId' in esito)) {
    throw new Error('Risposta inattesa');
  }
  return { dipendenteId: String(esito.dipendenteId) };
}

async function seme(): Promise<void> {
  await svuotaEmulatori();
  const utenti: [string, 'ADMIN' | 'COORDINATORE'][] = [
    ['uAdmin', 'ADMIN'],
    ['uCoordA', 'COORDINATORE'],
    ['uCoordB', 'COORDINATORE'],
  ];
  for (const [uid, ruolo] of utenti) {
    await creaUtente(admin, { uid, ruolo, documento: { ruolo, attivo: true } });
  }
  const adesso = Timestamp.fromMillis(0);
  const reparto = (coordinatoreUid: string) => ({
    nome: 'Reparto',
    coordinatoreUid,
    configurazione: { passo: 'dipendenti' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: adesso,
    creatoDa: coordinatoreUid,
    aggiornatoIl: adesso,
    aggiornatoDa: coordinatoreUid,
  });
  await admin.db.doc('reparti/repA').set(reparto('uCoordA'));
  await admin.db.doc('reparti/repB').set(reparto('uCoordB'));
}

beforeAll(async () => {
  await seme();
});

beforeEach(async () => {
  await seme();
});

afterAll(async () => {
  await Promise.all([...clienti.values()].map((c) => c.chiudi()));
  await admin.chiudi();
});

async function indici() {
  return (await admin.db.collection('indiceCodiciFiscali').get()).docs;
}

describe('salvaDipendente sull’emulatore', () => {
  it('crea dipendente, dati riservati cifrati, indice e voce di registro', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());

    const pubblico = (await admin.db.doc(`reparti/repA/dipendenti/${dipendenteId}`).get()).data();
    expect(pubblico).toMatchObject({
      nome: 'Laura',
      cognome: 'Bianchi',
      oreSettimanali: 36,
      turniEsclusi: ['N1'],
      attivo: true,
      aggiornatoDa: 'uCoordA',
    });
    expect(JSON.stringify(pubblico)).not.toMatch(/BNCLRA|1980|laura\.bianchi/);

    const privato = (
      await admin.db.doc(`reparti/repA/dipendenti/${dipendenteId}/privato/dati`).get()
    ).data();
    expect(privato).toMatchObject({ email: EMAIL, chiaveKms: 'emulatore-non-sicura' });
    expect(JSON.stringify(privato)).not.toContain(CF);
    expect(JSON.stringify(privato)).not.toContain(NASCITA);
    expect(String(privato?.['hmacCodiceFiscale'])).toMatch(/^[0-9a-f]{64}$/);

    const elencoIndici = await indici();
    expect(elencoIndici.map((d) => d.id)).toEqual([privato?.['hmacCodiceFiscale']]);
    expect(elencoIndici[0]?.data()).toMatchObject({ repartoId: 'repA', dipendenteId });

    const voci = await admin.db.collection('reparti/repA/registroAttivita').get();
    expect(voci.docs.map((d) => d.data())).toMatchObject([
      {
        tipo: 'dipendente.salvato',
        dipendenteId,
        autoreUid: 'uCoordA',
        dettagli: { azione: 'creato' },
      },
    ]);
    // Nel registro non c'è nessun dato personale.
    expect(JSON.stringify(voci.docs.map((d) => d.data()))).not.toMatch(/Laura|Bianchi|BNCLRA|1980/);
  });

  it('un codice fiscale duplicato è respinto, anche da un altro reparto, senza dire dove', async () => {
    await salva('uCoordA', creazione());
    await expect(salva('uCoordB', creazione('repB'))).rejects.toMatchObject({
      code: 'functions/already-exists',
      details: { codice: 'CF_DUPLICATO' },
    });
    await expect(salva('uCoordB', creazione('repB'))).rejects.not.toMatchObject({
      message: expect.stringMatching(/repA|uCoordA/),
    });
    expect((await admin.db.collection('reparti/repB/dipendenti').get()).size).toBe(0);
    expect(await indici()).toHaveLength(1);
  });

  it('il cambio di codice fiscale sposta l’indice', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());
    const [prima] = await indici();
    await salva('uCoordA', {
      ...creazione(),
      dipendenteId,
      privati: { ...privati, codiceFiscale: CF_ALTRO },
    });
    const dopo = await indici();
    expect(dopo).toHaveLength(1);
    expect(dopo[0]?.id).not.toBe(prima?.id);
    expect(dopo[0]?.data()).toMatchObject({ repartoId: 'repA', dipendenteId });
    // Il vecchio codice è di nuovo libero (anche per un altro reparto).
    await expect(salva('uCoordB', creazione('repB'))).resolves.toMatchObject({
      dipendenteId: expect.any(String),
    });
  });

  it('la modifica senza dati riservati cambia solo il documento pubblico', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());
    await salva('uCoordA', {
      repartoId: 'repA',
      dipendenteId,
      anagrafica: {
        ...anagrafica,
        oreSettimanali: 30,
        attivo: false,
        dataCessazione: '2026-12-31',
      },
      privati: null,
    });
    const pubblico = (await admin.db.doc(`reparti/repA/dipendenti/${dipendenteId}`).get()).data();
    expect(pubblico).toMatchObject({
      oreSettimanali: 30,
      attivo: false,
      dataCessazione: '2026-12-31',
    });
    expect(await indici()).toHaveLength(1);
  });

  it.each([
    [
      'codice fiscale non valido',
      { privati: { ...privati, codiceFiscale: 'BNCLRA80A41H501X' } },
      'CF_NON_VALIDO',
    ],
    ['email non valida', { privati: { ...privati, email: 'laura@' } }, 'EMAIL_NON_VALIDA'],
    ['dati riservati mancanti in creazione', { privati: null }, 'INPUT_NON_VALIDO'],
    [
      'ore settimanali non valide',
      { anagrafica: { ...anagrafica, oreSettimanali: 36.3 } },
      'INPUT_NON_VALIDO',
    ],
  ])('input non valido: %s', async (_caso, cambi, codice) => {
    await expect(salva('uCoordA', creazione('repA', cambi))).rejects.toMatchObject({
      details: { codice },
    });
    expect((await admin.db.collection('reparti/repA/dipendenti').get()).size).toBe(0);
    expect(await indici()).toHaveLength(0);
  });

  it('un coordinatore non scrive nel reparto di un altro; l’ADMIN non scrive', async () => {
    await expect(salva('uCoordB', creazione('repA'))).rejects.toMatchObject({
      code: 'functions/permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
    await expect(salva('uAdmin', creazione('repA'))).rejects.toMatchObject({
      details: { codice: 'RUOLO_NON_AUTORIZZATO' },
    });
    expect((await admin.db.collection('reparti/repA/dipendenti').get()).size).toBe(0);
  });
});

describe('leggiDatiPrivati sull’emulatore', () => {
  it('il coordinatore proprietario e l’ADMIN leggono in chiaro; ogni lettura è nel registro', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());
    const atteso = { codiceFiscale: CF, dataNascita: NASCITA, email: EMAIL };
    await expect(
      (await come('uCoordA')).chiama('leggiDatiPrivati', { repartoId: 'repA', dipendenteId }),
    ).resolves.toEqual(atteso);
    await expect(
      (await come('uAdmin')).chiama('leggiDatiPrivati', { repartoId: 'repA', dipendenteId }),
    ).resolves.toEqual(atteso);

    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
      .map((d) => d.data())
      .filter((d) => d['tipo'] === 'dipendente.datiPrivatiLetti');
    expect(voci).toHaveLength(2);
    expect(voci.map((v) => v['autoreRuolo']).sort()).toEqual(['ADMIN', 'COORDINATORE']);
    expect(JSON.stringify(voci)).not.toMatch(/BNCLRA|1980|laura\.bianchi/);
  });

  it('un coordinatore che chiede i dati di un reparto non suo è respinto e non si registra nulla', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());
    await expect(
      (await come('uCoordB')).chiama('leggiDatiPrivati', { repartoId: 'repA', dipendenteId }),
    ).rejects.toMatchObject({
      code: 'functions/permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
      .map((d) => d.data())
      .filter((d) => d['tipo'] === 'dipendente.datiPrivatiLetti');
    expect(voci).toEqual([]);
  });

  it('dipendente inesistente', async () => {
    await expect(
      (await come('uCoordA')).chiama('leggiDatiPrivati', {
        repartoId: 'repA',
        dipendenteId: 'manca',
      }),
    ).rejects.toMatchObject({ details: { codice: 'NON_TROVATO' } });
  });
});

describe('dal browser, con le Security Rules vere', () => {
  it('il documento pubblico si legge, i dati riservati e l’indice mai, e nulla si scrive', async () => {
    const { dipendenteId } = await salva('uCoordA', creazione());
    const [indice] = await indici();
    for (const uid of ['uCoordA', 'uAdmin']) {
      const { db } = await come(uid);
      await expect(
        getDoc(doc(db, `reparti/repA/dipendenti/${dipendenteId}`)),
      ).resolves.toBeDefined();
      await expect(
        getDoc(doc(db, `reparti/repA/dipendenti/${dipendenteId}/privato/dati`)),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(
        getDocs(collection(db, `reparti/repA/dipendenti/${dipendenteId}/privato`)),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(
        getDoc(doc(db, `indiceCodiciFiscali/${indice?.id ?? 'x'}`)),
      ).rejects.toMatchObject({
        code: 'permission-denied',
      });
      await expect(
        setDoc(doc(db, `reparti/repA/dipendenti/${dipendenteId}/privato/dati`), {
          email: 'x@y.it',
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(
        updateDoc(doc(db, `reparti/repA/dipendenti/${dipendenteId}`), { nome: 'Altro' }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(
        deleteDoc(doc(db, `reparti/repA/dipendenti/${dipendenteId}`)),
      ).rejects.toMatchObject({
        code: 'permission-denied',
      });
    }
    // Il coordinatore di un altro reparto non legge nemmeno il documento pubblico.
    await expect(
      getDoc(doc((await come('uCoordB')).db, `reparti/repA/dipendenti/${dipendenteId}`)),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
