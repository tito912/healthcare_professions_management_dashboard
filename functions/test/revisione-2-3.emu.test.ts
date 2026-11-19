// Test della review dello step 2.3 (docs/review/2.3.md): dimostra un difetto e oggi fallisce.
import { adessoMs } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { accedi, adminDiProva, creaUtente, svuotaEmulatori, type ClienteWeb } from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);
const vuota = {
  turno: null,
  assenza: null,
  reperibilita: [],
  orarioReale: null,
  sostituisce: null,
  copertoDa: null,
};
const turno = (codice: string, inizio: string, fine: string, pausaMinuti: number) => ({
  codice,
  inizio,
  fine,
  pausaMinuti,
  notturno: fine < inizio && fine !== '00:00',
});
const M1 = { ...vuota, turno: turno('M1', '07:00', '14:00', 30) };
const N1 = { ...vuota, turno: turno('N1', '22:00', '07:00', 0) };

const riga = (giorni: Record<string, unknown>, versione = 1) => ({
  dipendenteId: 'dipA',
  contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
  giorni,
  versione,
  aggiornatoDa: 'uCoordA',
  aggiornatoIl: ORA,
});

const mese = (chiave: string) => ({
  chiave,
  anno: Number(chiave.slice(0, 4)),
  mese: Number(chiave.slice(5)),
  stato: 'bozza',
  calendario: { festivita: {}, attribuzioneNotte: 'inizio' },
  creatoIl: ORA,
  creatoDa: 'uCoordA',
  aggiornatoIl: ORA,
  aggiornatoDa: 'uCoordA',
  convalidatoIl: null,
  convalidatoDa: null,
  convalidatoDaNome: null,
});

const riepilogo = async (chiave: string) =>
  (await admin.db.doc(`reparti/repA/riepiloghi/${chiave}_dipA`).get()).data();

async function aspetta<T>(leggi: () => Promise<T>, pronto: (v: T) => boolean): Promise<T> {
  const limite = adessoMs() + 30_000;
  for (;;) {
    const valore = await leggi();
    if (pronto(valore)) {
      return valore;
    }
    if (adessoMs() > limite) {
      throw new Error(`Condizione non raggiunta: ${JSON.stringify(valore)}`);
    }
    await new Promise((risolvi) => setTimeout(risolvi, 250));
  }
}

let cliente: ClienteWeb | null = null;

beforeEach(async () => {
  await svuotaEmulatori();
  await creaUtente(admin, {
    uid: 'uCoordA',
    ruolo: 'COORDINATORE',
    documento: { ruolo: 'COORDINATORE', attivo: true },
  });
  await admin.db.doc('reparti/repA').set({
    nome: 'Reparto',
    coordinatoreUid: 'uCoordA',
    configurazione: { passo: 'completata' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: ORA,
    creatoDa: 'uCoordA',
    aggiornatoIl: ORA,
    aggiornatoDa: 'uCoordA',
  });
});

afterAll(async () => {
  await cliente?.chiudi();
  await admin.chiudi();
});

describe('Review 2.3 — rilievo 1: il riepilogo di un mese convalidato non è definitivo', () => {
  it('modificare la riga del mese successivo (ancora in bozza) non riscrive il riepilogo del mese convalidato', async () => {
    await admin.db.doc('reparti/repA/mesi/2025-03').set(mese('2025-03'));
    await admin.db.doc('reparti/repA/mesi/2025-04').set(mese('2025-04'));
    // N1 del 31/3 finisce alle 07:00 dell'1/4, dove comincia M1: riposo 0, un avviso in entrambi i mesi.
    await admin.db.doc('reparti/repA/mesi/2025-03/righe/dipA').set(riga({ '31': N1 }));
    await admin.db.doc('reparti/repA/mesi/2025-04/righe/dipA').set(riga({ '01': M1 }));
    await aspetta(
      () => riepilogo('2025-03'),
      (v) => v?.['numeroAvvisi'] === 1,
    );

    cliente = await accedi('uCoordA');
    await cliente.chiama('convalidaMese', { repartoId: 'repA', chiaveMese: '2025-03' });
    const convalidato = await aspetta(
      () => riepilogo('2025-03'),
      (v) => v?.['statoMese'] === 'convalidato',
    );
    expect(convalidato?.['numeroAvvisi']).toBe(1);

    // Il coordinatore sposta M1 dal 1° al 2 aprile: aprile passa a 0 avvisi.
    await admin.db.doc('reparti/repA/mesi/2025-04/righe/dipA').set(riga({ '02': M1 }, 2));
    await aspetta(
      () => riepilogo('2025-04'),
      (v) => v?.['numeroAvvisi'] === 0,
    );
    await new Promise((risolvi) => setTimeout(risolvi, 3000));

    // Il mese di marzo è convalidato: il suo riepilogo definitivo non deve cambiare.
    const dopo = await riepilogo('2025-03');
    expect(dopo?.['numeroAvvisi']).toBe(1);
    expect(dopo?.['calcolatoIl']).toEqual(convalidato?.['calcolatoIl']);
  });
});
