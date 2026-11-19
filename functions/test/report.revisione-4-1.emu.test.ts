// Test della review dello step 4.1: dimostrano difetti dell'invio (docs/review/4.1.md, rilievi 1, 2 e 3).
// Falliscono di proposito finché il difetto non è corretto. Stesse condizioni di `report.emu.test.ts`: Functions e
// Firestore sugli emulatori; il servizio di posta è quello vero (coda `mail`) o uno che fallisce.
import { dataISO, reportInviato } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eseguiReportBimestrale } from '../src/report/report-bimestrale';
import { PostaTriggerEmail } from '../src/report/posta/posta-trigger-email';
import type { ServizioPosta } from '../src/report/posta/servizio-posta';
import { accedi, adminDiProva, creaUtente, svuotaEmulatori, type ClienteWeb } from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);
const GENNAIO = dataISO('2027-01-06');
const clienti = new Map<string, ClienteWeb>();

async function chiama(uid: string, funzione: string, dati: unknown): Promise<unknown> {
  let cliente = clienti.get(uid);
  if (cliente === undefined) {
    cliente = await accedi(uid);
    clienti.set(uid, cliente);
  }
  return cliente.chiama(funzione, dati);
}

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

/** Reparto con due dipendenti, entrambi con email; `dicembre` decide se il secondo mese è già convalidato. */
async function preparaReparto(dicembre: 'bozza' | 'convalidato') {
  await admin.db.doc('reparti/repA').set({
    nome: 'Radiologia',
    coordinatoreUid: 'uCoordA',
    configurazione: { passo: 'completata' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: ORA,
    creatoDa: 'uCoordA',
    aggiornatoIl: ORA,
    aggiornatoDa: 'uCoordA',
  });
  await admin.db.doc('reparti/repA/mesi/2026-11').set(mese('2026-11', 'convalidato'));
  await admin.db.doc('reparti/repA/mesi/2026-12').set(mese('2026-12', dicembre));
  for (const [id, nome, cognome] of [
    ['d1', 'Mario', 'Rossi'],
    ['d2', 'Laura', 'Bianchi'],
  ] as const) {
    await admin.db.doc(`reparti/repA/dipendenti/${id}`).set({ nome, cognome, attivo: true });
    await admin.db
      .doc(`reparti/repA/dipendenti/${id}/privato/dati`)
      .set({ email: `${id}@prova.example`, chiaveKms: 'prova', aggiornatoIl: ORA });
    for (const chiave of ['2026-11', '2026-12']) {
      await admin.db.doc(`reparti/repA/riepiloghi/${chiave}_${id}`).set({
        dipendenteId: id,
        chiaveMese: chiave,
        anno: 2026,
        statoMese: 'convalidato',
        valida: true,
        turniSvolti: 3,
        notti: 0,
        sabati: 0,
        domenicheEFestivi: 0,
        reperibilitaSvolte: 0,
        chiamate: 0,
        minutiChiamate: 0,
      });
    }
  }
}

const mail = async () => (await admin.db.collection('mail').get()).docs;
const docReport = async () => (await admin.db.doc('reparti/repA/report/2026-B6').get()).data();

beforeEach(async () => {
  await svuotaEmulatori();
  for (const [uid, ruolo] of [
    ['uCoordA', 'COORDINATORE'],
    ['uAdmin', 'ADMIN'],
  ] as const) {
    await creaUtente(admin, { uid, ruolo, documento: { ruolo, attivo: true } });
  }
});

afterAll(async () => {
  await Promise.all([...clienti.values()].map((c) => c.chiudi()));
  await admin.chiudi();
});

describe('review 4.1', () => {
  it('rilievo 1: se l’invio automatico non accoda nessuna email il report non risulta inviato (e si può ritentare)', async () => {
    await preparaReparto('convalidato');
    const postaGuasta: ServizioPosta = {
      accoda: () => Promise.reject(new Error('servizio non raggiungibile')),
    };
    await eseguiReportBimestrale(GENNAIO, postaGuasta);
    const documento = await docReport();
    const invii = Object.values((documento?.['invii'] ?? {}) as Record<string, { esito: string }>);
    expect(invii.map((i) => i.esito)).toEqual(['errore', 'errore']);
    // È ciò che legge la Home (`reportInviato`): con tutte le email in errore l'avviso «non inviato» deve restare.
    expect(
      reportInviato(
        documento?.['invioAutomaticoIl'] !== null,
        invii.map((i) => i.esito as 'accodato' | 'senzaEmail' | 'errore'),
      ),
    ).toBe(false);
    // E la riesecuzione del giorno dopo (o dell'invio a mano) deve poter spedire davvero.
    await eseguiReportBimestrale(GENNAIO, new PostaTriggerEmail());
    expect(await mail()).toHaveLength(2);
  });

  it('rilievo 2: un reinvio a mano a un solo dipendente non fa ricevere due email a quel dipendente col giorno 6', async () => {
    await preparaReparto('convalidato');
    await chiama('uCoordA', 'inviaReport', {
      repartoId: 'repA',
      idBimestre: '2026-B6',
      dipendenteIds: ['d1'],
    });
    expect(await mail()).toHaveLength(1);
    await eseguiReportBimestrale(GENNAIO, new PostaTriggerEmail());
    const perD1 = (await mail()).filter((d) => (d.get('to') as string[])[0] === 'd1@prova.example');
    expect(perD1).toHaveLength(1);
  });

  it('rilievo 3: un invio a mano fatto con un solo mese convalidato non impedisce l’invio automatico del bimestre completo', async () => {
    await preparaReparto('bozza');
    await chiama('uCoordA', 'inviaReport', {
      repartoId: 'repA',
      idBimestre: '2026-B6',
      dipendenteIds: null,
    });
    expect(await mail()).toHaveLength(2);
    // Dicembre viene convalidato prima del giorno 6.
    await admin.db.doc('reparti/repA/mesi/2026-12').set(mese('2026-12', 'convalidato'));
    const esiti = await eseguiReportBimestrale(GENNAIO, new PostaTriggerEmail());
    expect(esiti).toEqual([{ repartoId: 'repA', esito: 'inviato' }]);
  });
});
