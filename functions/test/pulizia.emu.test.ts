// pulisciCessati sugli emulatori (PIANO 4.2 criterio 2): Firestore e Storage veri, Admin SDK come nella Function.
// Soglie: cessazione a 4 anni e 11 mesi (resta), a 5 anni esatti e a 6 anni (eliminati); modalità di prova.
import { dataISO } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/comune/admin';
import {
  archivioPredefinito,
  eseguiPulizia,
  type ArchivioFile,
} from '../src/manutenzione/pulisci-cessati';
import { PROGETTO, adminDiProva, svuotaEmulatori } from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);
const OGGI = dataISO('2026-11-19');
const BUCKET = `${PROGETTO}.appspot.com`;

const senzaFile: ArchivioFile = {
  elenca: () => Promise.resolve([]),
  elimina: () => Promise.resolve(),
};

beforeEach(async () => {
  await svuotaEmulatori();
});

afterAll(async () => {
  await admin.chiudi();
});

async function dipendente(
  repartoId: string,
  id: string,
  dataCessazione: string | null,
  hmac: string,
): Promise<void> {
  await admin.db.doc(`reparti/${repartoId}/dipendenti/${id}`).set({
    nome: `Nome${id}`,
    cognome: `Cognome${id}`,
    attivo: dataCessazione === null,
    dataCessazione,
    aggiornatoIl: ORA,
  });
  await admin.db.doc(`reparti/${repartoId}/dipendenti/${id}/privato/dati`).set({
    hmacCodiceFiscale: hmac,
    email: `${id}@prova.example`,
    chiaveKms: 'prova',
    aggiornatoIl: ORA,
  });
  await admin.db.doc(`indiceCodiciFiscali/${hmac}`).set({
    repartoId,
    dipendenteId: id,
    creatoIl: ORA,
  });
}

async function esiste(percorso: string): Promise<boolean> {
  return (await admin.db.doc(percorso).get()).exists;
}

async function preparaScenario(): Promise<void> {
  await admin.db.doc('reparti/repA').set({ nome: 'Radiologia' });
  await dipendente('repA', 'quattroAnniUndiciMesi', '2021-12-19', 'h1');
  await dipendente('repA', 'cinqueAnniEsatti', '2021-11-19', 'h2');
  await dipendente('repA', 'seiAnni', '2020-11-19', 'h3');
  await dipendente('repA', 'inServizio', null, 'h4');
  await dipendente('repA', 'cessaOggi', '2026-11-19', 'h5');
  // Riepiloghi e report (le righe farebbero scattare il trigger dei riepiloghi: stesso discorso) con l'ID di un eliminato: non vanno toccati.
  await admin.db
    .doc('reparti/repA/riepiloghi/2021-01_seiAnni')
    .set({ dipendenteId: 'seiAnni', turniSvolti: 7 });
  await admin.db
    .doc('reparti/repA/report/2021-B1')
    .set({ righe: { seiAnni: { turniSvolti: 7 } }, file: null });
}

describe('pulisciCessati: soglia dei 5 anni', () => {
  it('elimina a 5 anni esatti e a 6 anni, non a 4 anni e 11 mesi', async () => {
    await preparaScenario();
    const risultato = await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });

    expect(risultato).toMatchObject({
      dipendentiTrovati: 2,
      dipendentiEliminati: 2,
      errori: 0,
      modalitaProva: false,
    });
    for (const id of ['cinqueAnniEsatti', 'seiAnni']) {
      expect(await esiste(`reparti/repA/dipendenti/${id}`)).toBe(false);
      expect(await esiste(`reparti/repA/dipendenti/${id}/privato/dati`)).toBe(false);
    }
    expect(await esiste('indiceCodiciFiscali/h2')).toBe(false);
    expect(await esiste('indiceCodiciFiscali/h3')).toBe(false);
    for (const id of ['quattroAnniUndiciMesi', 'inServizio', 'cessaOggi']) {
      expect(await esiste(`reparti/repA/dipendenti/${id}`)).toBe(true);
      expect(await esiste(`reparti/repA/dipendenti/${id}/privato/dati`)).toBe(true);
    }
    for (const hmac of ['h1', 'h4', 'h5']) {
      expect(await esiste(`indiceCodiciFiscali/${hmac}`)).toBe(true);
    }
  });

  it('non tocca riepiloghi e report (restano con il solo ID: anonimi)', async () => {
    await preparaScenario();
    await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    expect(
      (await admin.db.doc('reparti/repA/riepiloghi/2021-01_seiAnni').get()).get('turniSvolti'),
    ).toBe(7);
    expect((await admin.db.doc('reparti/repA/report/2021-B1').get()).get('righe')).toEqual({
      seiAnni: { turniSvolti: 7 },
    });
  });

  it("non elimina l'indice che appartiene a un altro dipendente", async () => {
    await admin.db.doc('reparti/repA').set({ nome: 'Radiologia' });
    await dipendente('repA', 'seiAnni', '2020-11-19', 'hCondiviso');
    await admin.db
      .doc('indiceCodiciFiscali/hCondiviso')
      .set({ repartoId: 'repB', dipendenteId: 'altro', creatoIl: ORA });
    await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    expect(await esiste('indiceCodiciFiscali/hCondiviso')).toBe(true);
    expect(await esiste('reparti/repA/dipendenti/seiAnni')).toBe(false);
  });

  it('una seconda esecuzione non trova più nulla', async () => {
    await preparaScenario();
    await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    const seconda = await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    expect(seconda).toMatchObject({ dipendentiTrovati: 0, dipendentiEliminati: 0 });
  });

  it('la cessazione del 29 febbraio scade il 28 febbraio di cinque anni dopo', async () => {
    await admin.db.doc('reparti/repA').set({ nome: 'Radiologia' });
    await dipendente('repA', 'bisestile', '2020-02-29', 'hB');
    const prima = await eseguiPulizia(dataISO('2025-02-27'), {
      modalitaProva: false,
      archivio: senzaFile,
    });
    expect(prima.dipendentiEliminati).toBe(0);
    const dopo = await eseguiPulizia(dataISO('2025-02-28'), {
      modalitaProva: false,
      archivio: senzaFile,
    });
    expect(dopo.dipendentiEliminati).toBe(1);
  });
});

describe('pulisciCessati: modalità di prova', () => {
  it('elenca e conta senza cancellare nulla', async () => {
    await preparaScenario();
    const risultato = await eseguiPulizia(OGGI, { modalitaProva: true, archivio: senzaFile });
    expect(risultato).toMatchObject({
      modalitaProva: true,
      dipendentiTrovati: 2,
      dipendentiEliminati: 0,
    });
    for (const id of ['cinqueAnniEsatti', 'seiAnni']) {
      expect(await esiste(`reparti/repA/dipendenti/${id}`)).toBe(true);
      expect(await esiste(`reparti/repA/dipendenti/${id}/privato/dati`)).toBe(true);
    }
    expect(await esiste('indiceCodiciFiscali/h2')).toBe(true);
  });
});

describe('pulisciCessati: registro', () => {
  it('scrive una voce con i soli conteggi, senza dati personali', async () => {
    await preparaScenario();
    await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    const voci = await admin.db.collection('registroAttivita').get();
    expect(voci.size).toBe(1);
    const voce = voci.docs[0]?.data();
    expect(voce).toMatchObject({
      tipo: 'pulizia.eseguita',
      autoreUid: null,
      autoreRuolo: 'SISTEMA',
      repartoId: null,
      dipendenteId: null,
      dettagli: {
        modalitaProva: false,
        dipendentiTrovati: 2,
        dipendentiEliminati: 2,
        fileEliminati: 0,
        errori: 0,
      },
    });
    const testo = JSON.stringify(voce);
    expect(testo).not.toMatch(/NomeseiAnni|Cognome|prova\.example|seiAnni|cinqueAnniEsatti/);
  });
});

describe('pulisciCessati: file dei report (L16)', () => {
  async function caricaFile(percorso: string): Promise<void> {
    await getStorage(app()).bucket(BUCKET).file(percorso).save('contenuto di prova');
  }
  const archivio = archivioPredefinito(BUCKET);

  // Lo Storage dell'emulatore non si svuota con Firestore: i file di altri test (report) vanno tolti prima.
  beforeEach(async () => {
    for (const file of await archivio.elenca('report/')) {
      await archivio.elimina(file.percorso);
    }
  });

  it('elimina i file più vecchi di 365 giorni e azzera il riferimento nel report', async () => {
    const percorso = 'report/repA/2021-B1/reparto.xlsx';
    await caricaFile(percorso);
    await admin.db.doc('reparti/repA/report/2021-B1').set({ file: { percorso }, righe: {} });

    // I file appena creati non scadono.
    const adesso = await eseguiPulizia(OGGI, { modalitaProva: false, archivio });
    expect(adesso.fileEliminati).toBe(0);
    expect((await archivio.elenca('report/')).map((f) => f.percorso)).toContain(percorso);

    // Tra più di un anno sì.
    const piuTardi = await eseguiPulizia(dataISO('2029-01-01'), { modalitaProva: true, archivio });
    expect(piuTardi).toMatchObject({ fileScaduti: 1, fileEliminati: 0 });
    expect((await archivio.elenca('report/')).map((f) => f.percorso)).toContain(percorso);

    const eliminato = await eseguiPulizia(dataISO('2029-01-01'), {
      modalitaProva: false,
      archivio,
    });
    expect(eliminato).toMatchObject({ fileScaduti: 1, fileEliminati: 1, errori: 0 });
    expect((await archivio.elenca('report/')).map((f) => f.percorso)).not.toContain(percorso);
    expect((await admin.db.doc('reparti/repA/report/2021-B1').get()).get('file')).toBeNull();
  });
});

describe('pulisciCessati: niente da fare', () => {
  it('senza dipendenti né file scaduti non scrive nessuna voce di registro (review 4.2, rilievo 3)', async () => {
    const risultato = await eseguiPulizia(OGGI, { modalitaProva: false, archivio: senzaFile });
    expect(risultato).toMatchObject({ dipendentiTrovati: 0, fileScaduti: 0, errori: 0 });
    expect((await admin.db.collection('registroAttivita').get()).size).toBe(0);
  });
});
