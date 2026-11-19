// Report bimestrale sugli emulatori (PIANO 4.1 criteri 2, 3, 4 e 6): Functions vere, Firestore con le Security Rules
// vere, client web come nel browser. Il report è la somma dei riepiloghi dei mesi convalidati: i riepiloghi si
// scrivono direttamente con l'Admin SDK (il loro calcolo è provato nel dominio, `conteggi.test.ts`). L'invio crea
// documenti nella coda `mail` e basta: nessuna email parte davvero.
import { adessoMs, dataISO, scadenzaMail } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PIANIFICAZIONE_REPORT, eseguiReportBimestrale } from '../src/report/report-bimestrale';
import { PostaTriggerEmail } from '../src/report/posta/posta-trigger-email';
import {
  accedi,
  adminDiProva,
  clienteWeb,
  creaUtente,
  svuotaEmulatori,
  type ClienteWeb,
} from './emulatori';
import { apriFoglio, valoriRiga } from './xlsx';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);
const BIMESTRE = '2026-B6';

const clienti = new Map<string, ClienteWeb>();
async function chiama(uid: string, funzione: string, dati: unknown): Promise<unknown> {
  let cliente = clienti.get(uid);
  if (cliente === undefined) {
    cliente = await accedi(uid);
    clienti.set(uid, cliente);
  }
  return cliente.chiama(funzione, dati);
}

const reparto = (nome: string, coordinatoreUid: string, passo = 'completata') => ({
  nome,
  coordinatoreUid,
  configurazione: { passo },
  impostazioni: { attribuzioneNotte: 'inizio' },
  festivita: { nazionaliEscluse: [], locali: [] },
  creatoIl: ORA,
  creatoDa: coordinatoreUid,
  aggiornatoIl: ORA,
  aggiornatoDa: coordinatoreUid,
});

function mese(chiave: string, stato: 'bozza' | 'convalidato') {
  const [anno, numero] = chiave.split('-').map(Number);
  return {
    chiave,
    anno,
    mese: numero,
    stato,
    calendario: { festivita: {}, attribuzioneNotte: 'inizio' },
    creatoIl: ORA,
    creatoDa: 'uCoordA',
    aggiornatoIl: ORA,
    aggiornatoDa: 'uCoordA',
    convalidatoIl: stato === 'convalidato' ? ORA : null,
    convalidatoDa: stato === 'convalidato' ? 'uCoordA' : null,
    convalidatoDaNome: stato === 'convalidato' ? 'Nome uCoordA' : null,
  };
}

interface Conteggi {
  turniSvolti: number;
  notti: number;
  sabati: number;
  domenicheEFestivi: number;
  reperibilitaSvolte: number;
  chiamate: number;
  minutiChiamate: number;
}
const conteggi = (parziale: Partial<Conteggi>): Conteggi => ({
  turniSvolti: 0,
  notti: 0,
  sabati: 0,
  domenicheEFestivi: 0,
  reperibilitaSvolte: 0,
  chiamate: 0,
  minutiChiamate: 0,
  ...parziale,
});

async function riepilogo(repartoId: string, chiave: string, dipendenteId: string, c: Conteggi) {
  await admin.db.doc(`reparti/${repartoId}/riepiloghi/${chiave}_${dipendenteId}`).set({
    dipendenteId,
    chiaveMese: chiave,
    anno: Number(chiave.slice(0, 4)),
    statoMese: 'convalidato',
    valida: true,
    ...c,
  });
}

async function dipendente(
  repartoId: string,
  id: string,
  nome: string,
  cognome: string,
  email: string | null | false,
) {
  await admin.db.doc(`reparti/${repartoId}/dipendenti/${id}`).set({ nome, cognome, attivo: true });
  if (email !== false) {
    await admin.db
      .doc(`reparti/${repartoId}/dipendenti/${id}/privato/dati`)
      .set({ email, chiaveKms: 'prova', aggiornatoIl: ORA });
  }
}

/** Reparto A: due mesi convalidati e quattro dipendenti (due con email, uno senza, uno con indirizzo non valido). */
async function preparaRepartoA(dicembre: 'bozza' | 'convalidato' = 'convalidato') {
  await admin.db.doc('reparti/repA').set(reparto('Radiologia', 'uCoordA'));
  await admin.db.doc('reparti/repA/mesi/2026-11').set(mese('2026-11', 'convalidato'));
  await admin.db.doc('reparti/repA/mesi/2026-12').set(mese('2026-12', dicembre));
  await admin.db.doc('reparti/repA/turni/M1').set({
    codice: 'M1',
    tipo: 'turno',
    nome: 'Mattina',
    colore: 'arancio',
    inizio: '07:00',
    fine: '14:00',
    ordine: 1,
  });
  await admin.db.doc('reparti/repA/turni/R1').set({
    codice: 'R1',
    tipo: 'reperibilita',
    nome: 'Reperibilità pomeriggio',
    colore: null,
    inizio: '14:00',
    fine: '20:00',
    ordine: 2,
  });
  await dipendente('repA', 'd1', 'Mario', 'Rossi', 'mario.rossi@prova.example');
  await dipendente('repA', 'd2', 'Laura', 'Bianchi', 'laura.bianchi@prova.example');
  await dipendente('repA', 'd3', 'Anna', 'Verdi', null);
  await dipendente('repA', 'd4', 'Elisa', 'Neri', 'non-un-indirizzo');
  for (const chiave of ['2026-11', '2026-12']) {
    await riepilogo(
      'repA',
      chiave,
      'd1',
      conteggi({
        turniSvolti: 3,
        notti: 1,
        sabati: 1,
        domenicheEFestivi: 1,
        reperibilitaSvolte: 1,
        chiamate: 1,
        minutiChiamate: 45,
      }),
    );
    await riepilogo('repA', chiave, 'd2', conteggi({ turniSvolti: 2, sabati: 1 }));
    await riepilogo('repA', chiave, 'd3', conteggi({ turniSvolti: 4, notti: 2 }));
    await riepilogo('repA', chiave, 'd4', conteggi({}));
  }
}

const mail = async () => (await admin.db.collection('mail').get()).docs;
const docReport = async (repartoId = 'repA') =>
  (await admin.db.doc(`reparti/${repartoId}/report/${BIMESTRE}`).get()).data();
const voci = async (tipo: string, repartoId = 'repA') =>
  (await admin.db.collection(`reparti/${repartoId}/registroAttivita`).get()).docs
    .map((d): Record<string, unknown> => ({ id: d.id, ...d.data() }))
    .filter((v) => v['tipo'] === tipo);

beforeEach(async () => {
  await svuotaEmulatori();
  const utenti: [string, 'ADMIN' | 'COORDINATORE'][] = [
    ['uAdmin', 'ADMIN'],
    ['uCoordA', 'COORDINATORE'],
    ['uCoordB', 'COORDINATORE'],
  ];
  for (const [uid, ruolo] of utenti) {
    await creaUtente(admin, { uid, ruolo, documento: { ruolo, attivo: true } });
  }
});

afterAll(async () => {
  await Promise.all([...clienti.values()].map((c) => c.chiudi()));
  await admin.chiudi();
});

interface RispostaGenera {
  nomeFile: string;
  contenutoBase64: string;
  mesiInclusi: string[];
}
interface RispostaInvia {
  esiti: { dipendenteId: string; esito: string }[];
}

async function genera(
  uid: string,
  repartoId = 'repA',
  idBimestre = BIMESTRE,
): Promise<RispostaGenera> {
  return (await chiama(uid, 'generaReport', { repartoId, idBimestre })) as RispostaGenera;
}
async function invia(uid: string, dati: Record<string, unknown>): Promise<RispostaInvia> {
  return (await chiama(uid, 'inviaReport', {
    repartoId: 'repA',
    idBimestre: BIMESTRE,
    ...dati,
  })) as RispostaInvia;
}

describe('generaReport', () => {
  it('salva il report, archivia il file e lo restituisce con celle e totali giusti', async () => {
    await preparaRepartoA();
    await riepilogo('repA', '2026-11', 'dRimosso', conteggi({ turniSvolti: 1 }));
    const risposta = await genera('uCoordA');
    expect(risposta.nomeFile).toBe('report-2026-B6-radiologia.xlsx');
    expect(risposta.mesiInclusi).toEqual(['2026-11', '2026-12']);

    const foglio = await apriFoglio(Buffer.from(risposta.contenutoBase64, 'base64'));
    const riga = (n: number) => valoriRiga(foglio, n);
    expect(foglio.getCell('A1').value).toBe('Radiologia · Report nov–dic 2026');
    // Ordine di cognome: Bianchi, Neri, Rossi, Verdi; il dipendente non più in anagrafica in fondo.
    expect(riga(5)).toEqual(['Bianchi Laura', 4, 0, 2, 0, 0, 0, '—']);
    expect(riga(6)).toEqual(['Neri Elisa', 0, 0, 0, 0, 0, 0, '—']);
    expect(riga(7)).toEqual(['Rossi Mario', 6, 2, 2, 2, 2, 2, '1 h 30']);
    expect(riga(8)).toEqual(['Verdi Anna', 8, 4, 0, 0, 0, 0, '—']);
    expect(riga(9)).toEqual(['Dipendente rimosso', 1, 0, 0, 0, 0, 0, '—']);
    expect(riga(10)).toEqual(['Totale', 19, 6, 4, 2, 2, 2, '1 h 30']);
    expect(riga(14)).toEqual(['M1', 'Mattina', '07:00', '14:00', 'Turno']);
    expect(riga(15)).toEqual(['R1', 'Reperibilità pomeriggio', '14:00', '20:00', 'Reperibilità']);

    const documento = await docReport();
    expect(documento).toMatchObject({
      idBimestre: BIMESTRE,
      anno: 2026,
      bimestre: 6,
      mesi: ['2026-11', '2026-12'],
      mesiInclusi: ['2026-11', '2026-12'],
      generatoDa: 'uCoordA',
      invii: {},
      invioAutomaticoIl: null,
      totali: {
        turniSvolti: 19,
        notti: 6,
        sabati: 4,
        domenicheEFestivi: 2,
        reperibilitaSvolte: 2,
        chiamate: 2,
        minutiChiamate: 90,
      },
    });
    expect(documento?.['righe']).toMatchObject({
      d1: { turniSvolti: 6 },
      dRimosso: { turniSvolti: 1 },
    });
    // Nessun nome nel documento del report (L3).
    expect(JSON.stringify(documento)).not.toMatch(/Rossi|Bianchi|Verdi|Neri|Mario|Laura/);
    expect(documento?.['file']).toMatchObject({ percorso: 'report/repA/2026-B6/reparto.xlsx' });
    const registro = await voci('report.generato');
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({
      autoreUid: 'uCoordA',
      autoreRuolo: 'COORDINATORE',
      dettagli: { idBimestre: BIMESTRE, dipendenti: 5 },
    });
  });

  it('un mese in bozza non entra: solo i convalidati', async () => {
    await preparaRepartoA('bozza');
    const risposta = await genera('uCoordA');
    expect(risposta.mesiInclusi).toEqual(['2026-11']);
    expect((await docReport())?.['totali']).toMatchObject({ turniSvolti: 9 });
  });

  it('una seconda generazione conserva gli invii già registrati', async () => {
    await preparaRepartoA();
    await genera('uCoordA');
    await invia('uCoordA', { dipendenteIds: ['d1'] });
    await genera('uCoordA');
    expect((await docReport())?.['invii']).toMatchObject({ d1: { esito: 'accodato' } });
  });

  it('senza mesi convalidati: NESSUN_MESE_CONVALIDATO e nulla di scritto', async () => {
    await admin.db.doc('reparti/repA').set(reparto('Radiologia', 'uCoordA'));
    await admin.db.doc('reparti/repA/mesi/2026-11').set(mese('2026-11', 'bozza'));
    await expect(genera('uCoordA')).rejects.toMatchObject({
      code: 'functions/failed-precondition',
      details: { codice: 'NESSUN_MESE_CONVALIDATO' },
    });
    expect(await docReport()).toBeUndefined();
  });

  it('l’ADMIN può generare il file di qualunque reparto; un altro coordinatore no', async () => {
    await preparaRepartoA();
    const risposta = await genera('uAdmin');
    expect(risposta.mesiInclusi).toHaveLength(2);
    expect((await docReport())?.['generatoDa']).toBe('uAdmin');
    expect((await voci('report.generato'))[0]).toMatchObject({ autoreRuolo: 'ADMIN' });
    await expect(genera('uCoordB')).rejects.toMatchObject({
      code: 'functions/permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
  });

  it('input non valido e accesso mancante', async () => {
    await preparaRepartoA();
    await expect(
      chiama('uCoordA', 'generaReport', { repartoId: 'repA', idBimestre: '2026-B9' }),
    ).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
    const anonimo = clienteWeb();
    try {
      await expect(
        anonimo.chiama('generaReport', { repartoId: 'repA', idBimestre: BIMESTRE }),
      ).rejects.toMatchObject({
        details: { codice: 'NON_AUTENTICATO' },
      });
    } finally {
      await anonimo.chiudi();
    }
  });
});

describe('inviaReport', () => {
  it('accoda una email per ciascun dipendente con indirizzo e nessuna per gli altri; registra gli esiti', async () => {
    await preparaRepartoA();
    const { esiti } = await invia('uCoordA', { dipendenteIds: null });
    expect(esiti.sort((a, b) => a.dipendenteId.localeCompare(b.dipendenteId))).toEqual([
      { dipendenteId: 'd1', esito: 'accodato' },
      { dipendenteId: 'd2', esito: 'accodato' },
      { dipendenteId: 'd3', esito: 'senzaEmail' },
      { dipendenteId: 'd4', esito: 'senzaEmail' },
    ]);
    const coda = await mail();
    expect(coda).toHaveLength(2);
    expect(coda.flatMap((d) => d.get('to') as string[]).sort()).toEqual([
      'laura.bianchi@prova.example',
      'mario.rossi@prova.example',
    ]);

    const perRossi = coda.find((d) => (d.get('to') as string[])[0] === 'mario.rossi@prova.example');
    const messaggio = perRossi?.get('message') as {
      subject: string;
      text: string;
      html: string;
      attachments: { filename: string; content: string; encoding: string }[];
    };
    expect(messaggio.subject).toBe('Report turni nov–dic 2026 · Radiologia');
    expect(messaggio.text).toContain('Buongiorno Mario,');
    expect(messaggio.attachments).toHaveLength(1);
    expect(messaggio.attachments[0]).toMatchObject({
      filename: 'report-2026-B6.xlsx',
      encoding: 'base64',
    });
    const foglio = await apriFoglio(Buffer.from(messaggio.attachments[0]?.content ?? '', 'base64'));
    expect(foglio.getCell('A2').value).toBe('Rossi Mario');
    expect(valoriRiga(foglio, 8)).toEqual(['Totale bimestre', 6, 2, 2, 2, 2, 2, '1 h 30']);
    expect(perRossi?.get('origine')).toEqual({
      repartoId: 'repA',
      idBimestre: BIMESTRE,
      dipendenteId: 'd1',
      automatico: false,
    });
    const scadenza = (perRossi?.get('scadeIl') as Timestamp).toMillis();
    expect(Math.abs(scadenza - scadenzaMail(adessoMs()))).toBeLessThan(60_000);

    const invii = (await docReport())?.['invii'] as Record<
      string,
      { esito: string; mailId: string | null; il: Timestamp }
    >;
    expect(invii['d1']).toMatchObject({ esito: 'accodato', mailId: perRossi?.id });
    expect(invii['d3']).toMatchObject({ esito: 'senzaEmail', mailId: null });
    expect(invii['d4']?.esito).toBe('senzaEmail');
    expect(invii['d1']?.il.toMillis()).toBeGreaterThan(0);

    // Registro: solo conteggi e ID, mai indirizzi o nomi.
    const registro = await voci('report.inviato');
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({
      dettagli: { idBimestre: BIMESTRE, automatico: false, accodati: 2, senzaEmail: 2, errori: 0 },
    });
    expect(JSON.stringify(registro)).not.toMatch(/@|Rossi|Mario/);
  });

  it('il reinvio a un solo dipendente accoda una sola email in più e aggiorna il suo esito', async () => {
    await preparaRepartoA();
    await invia('uCoordA', { dipendenteIds: null });
    const prima = ((await docReport())?.['invii'] as Record<string, { mailId: string }>)['d1']
      ?.mailId;
    const { esiti } = await invia('uCoordA', { dipendenteIds: ['d1'] });
    expect(esiti).toEqual([{ dipendenteId: 'd1', esito: 'accodato' }]);
    expect(await mail()).toHaveLength(3);
    const dopo = ((await docReport())?.['invii'] as Record<string, { mailId: string }>)['d1']
      ?.mailId;
    expect(dopo).not.toBe(prima);
  });

  it('un dipendente che non è nel report è ignorato', async () => {
    await preparaRepartoA();
    const { esiti } = await invia('uCoordA', { dipendenteIds: ['dSconosciuto'] });
    expect(esiti).toEqual([]);
    expect(await mail()).toHaveLength(0);
  });

  it('l’anteprima dice chi riceverebbe la email senza scrivere né accodare nulla', async () => {
    await preparaRepartoA();
    const { esiti } = await invia('uCoordA', { dipendenteIds: null, anteprima: true });
    expect(esiti.filter((e) => e.esito === 'accodato')).toHaveLength(2);
    expect(esiti.filter((e) => e.esito === 'senzaEmail')).toHaveLength(2);
    expect(await mail()).toHaveLength(0);
    expect(await docReport()).toBeUndefined();
    expect(await voci('report.inviato')).toHaveLength(0);
  });

  it('con un mese in bozza invia solo i convalidati e l’email lo dice', async () => {
    await preparaRepartoA('bozza');
    await invia('uCoordA', { dipendenteIds: ['d1'] });
    const messaggio = (await mail())[0]?.get('message') as { text: string };
    expect(messaggio.text).toContain('solo i mesi già convalidati: Novembre 2026.');
    expect((await docReport())?.['mesiInclusi']).toEqual(['2026-11']);
  });

  it('solo il coordinatore del reparto: l’ADMIN e un altro coordinatore sono respinti', async () => {
    await preparaRepartoA();
    await expect(invia('uAdmin', { dipendenteIds: null })).rejects.toMatchObject({
      code: 'functions/permission-denied',
      details: { codice: 'RUOLO_NON_AUTORIZZATO' },
    });
    await expect(invia('uCoordB', { dipendenteIds: null })).rejects.toMatchObject({
      details: { codice: 'NON_PROPRIETARIO' },
    });
    expect(await mail()).toHaveLength(0);
  });

  it('senza mesi convalidati: NESSUN_MESE_CONVALIDATO; elenco vuoto: INPUT_NON_VALIDO', async () => {
    await admin.db.doc('reparti/repA').set(reparto('Radiologia', 'uCoordA'));
    await expect(invia('uCoordA', { dipendenteIds: null })).rejects.toMatchObject({
      details: { codice: 'NESSUN_MESE_CONVALIDATO' },
    });
    await expect(invia('uCoordA', { dipendenteIds: [] })).rejects.toMatchObject({
      details: { codice: 'INPUT_NON_VALIDO' },
    });
  });
});

describe('reportBimestrale', () => {
  const posta = new PostaTriggerEmail();
  const GENNAIO = dataISO('2027-01-06');

  it('è pianificata alle 08:00 del 6 dei mesi dispari', () => {
    expect(PIANIFICAZIONE_REPORT).toBe('0 8 6 1,3,5,7,9,11 *');
  });

  it('genera e invia il bimestre chiuso; una seconda esecuzione non rispedisce nulla', async () => {
    await preparaRepartoA();
    const prima = await eseguiReportBimestrale(GENNAIO, posta);
    expect(prima).toEqual([{ repartoId: 'repA', esito: 'inviato' }]);
    const coda = await mail();
    expect(coda.map((d) => d.id).sort()).toEqual(['auto_repA_2026-B6_d1', 'auto_repA_2026-B6_d2']);
    expect(coda[0]?.get('origine')).toMatchObject({ automatico: true });
    const documento = await docReport();
    expect(documento?.['invioAutomaticoIl']).not.toBeNull();
    expect(documento?.['generatoDa']).toBe('sistema');
    expect(documento?.['invii']).toMatchObject({
      d1: { esito: 'accodato', mailId: 'auto_repA_2026-B6_d1' },
      d3: { esito: 'senzaEmail' },
    });
    expect((await voci('report.generato'))[0]).toMatchObject({
      autoreUid: null,
      autoreRuolo: 'SISTEMA',
    });
    expect((await voci('report.inviato'))[0]).toMatchObject({
      dettagli: { automatico: true, accodati: 2, senzaEmail: 2 },
    });

    const seconda = await eseguiReportBimestrale(GENNAIO, posta);
    expect(seconda).toEqual([{ repartoId: 'repA', esito: 'giaInviato' }]);
    expect(await mail()).toHaveLength(2);
    expect(await voci('report.inviato')).toHaveLength(1);
  });

  it('esecuzioni contemporanee: le email non si duplicano', async () => {
    await preparaRepartoA();
    const esiti = await Promise.all([
      eseguiReportBimestrale(GENNAIO, posta),
      eseguiReportBimestrale(GENNAIO, posta),
    ]);
    expect(esiti.flat().filter((r) => r.esito === 'inviato').length).toBeLessThanOrEqual(2);
    expect(await mail()).toHaveLength(2);
    // La transazione di `riservaInvio` lascia passare una sola esecuzione: una sola voce di invio.
    expect(esiti.flat().filter((r) => r.esito === 'inviato')).toHaveLength(1);
    expect(await voci('report.inviato')).toHaveLength(1);
  });

  it('un mese non convalidato: nessun invio e una sola voce report.invioRimandato, anche rieseguendo (L15)', async () => {
    await preparaRepartoA('bozza');
    expect(await eseguiReportBimestrale(GENNAIO, posta)).toEqual([
      { repartoId: 'repA', esito: 'rimandato' },
    ]);
    await eseguiReportBimestrale(GENNAIO, posta);
    expect(await mail()).toHaveLength(0);
    const registro = await voci('report.invioRimandato');
    expect(registro).toHaveLength(1);
    expect(registro[0]).toMatchObject({
      id: 'rimandato_2026-B6',
      autoreRuolo: 'SISTEMA',
      dettagli: { idBimestre: BIMESTRE, mesi: '2026-12' },
    });
    expect(await docReport()).toBeUndefined();
  });

  it('un reparto senza mesi nel bimestre o con la configurazione da completare non fa nulla; un reparto non ferma gli altri', async () => {
    await preparaRepartoA();
    await admin.db.doc('reparti/repVuoto').set(reparto('Vuoto', 'uCoordB'));
    await admin.db.doc('reparti/repNuovo').set(reparto('Nuovo', 'uCoordB', 'turni'));
    await admin.db.doc('reparti/repRotto').set({ ...reparto('Rotto', 'uCoordB') });
    await admin.db.doc('reparti/repRotto/mesi/2026-11').set(mese('2026-11', 'convalidato'));
    await admin.db.doc('reparti/repRotto/mesi/2026-12').set(mese('2026-12', 'convalidato'));
    // Un riepilogo senza i campi attesi viene saltato, il reparto si elabora comunque.
    await admin.db
      .doc('reparti/repRotto/riepiloghi/2026-11_dX')
      .set({ dipendenteId: 'dX', chiaveMese: '2026-11' });
    const esiti = await eseguiReportBimestrale(GENNAIO, posta);
    const per = (id: string) => esiti.find((r) => r.repartoId === id)?.esito;
    expect(per('repA')).toBe('inviato');
    expect(per('repVuoto')).toBe('senzaMesi');
    expect(per('repNuovo')).toBe('nonConfigurato');
    expect(per('repRotto')).toBe('inviato');
    expect(await mail()).toHaveLength(2);
  });

  it('se il coordinatore ha già inviato a tutti a mano, l’invio automatico non rispedisce', async () => {
    await preparaRepartoA();
    await invia('uCoordA', { dipendenteIds: null });
    expect(await eseguiReportBimestrale(GENNAIO, posta)).toEqual([
      { repartoId: 'repA', esito: 'giaInviato' },
    ]);
    expect(await mail()).toHaveLength(2);
  });
});
