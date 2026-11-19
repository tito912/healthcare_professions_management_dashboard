// Consuntivo lato server sugli emulatori (PIANO 3.1b criterio 4): Functions vere, Firestore con le Security Rules
// vere, client web come nel browser. Orari reali, assenze, sostituzioni e chiamate si scrivono nelle righe del mese in
// bozza con i normali salvataggi (D2: nessuna callable di variazione); il trigger ricalcola riepiloghi e banca ore e
// annota il registro. I dati di partenza si preparano con l'Admin SDK, che fa partire i trigger come ogni scrittura.
import { adessoMs, chiaveMese, modificheConsuntivo } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { doc, runTransaction, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ricalcolaBancaOre } from '../src/mesi/banca-ore';
import { registraConsuntivo } from '../src/mesi/registro-consuntivo';
import { ricalcolaRiepilogo } from '../src/mesi/ricalcolo';
import { accedi, adminDiProva, creaUtente, svuotaEmulatori, type ClienteWeb } from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);

// --- celle e righe in JSON, come stanno su Firestore -----------------------------------------------

type Cella = Record<string, unknown>;
const vuota: Cella = {
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
  notturno: (fine < inizio && fine !== '00:00') || fine === inizio,
});
const cella = (altro: Cella = {}): Cella => ({ ...vuota, ...altro });
const M1 = cella({ turno: turno('M1', '07:00', '14:00', 30) });
const P1 = cella({ turno: turno('P1', '14:00', '22:00', 30) });
const N1 = cella({ turno: turno('N1', '22:00', '07:00', 0) });
const MALATTIA = { codice: 'MA', effetto: 'neutra', malattia: true };
const RIPOSO = { codice: 'R', effetto: 'comeRiposo', malattia: false };
const SMONTO = { codice: 'S', effetto: 'comeRiposo', malattia: false };
const R2 = (altro: Cella = {}) => ({
  codice: 'R2',
  inizio: '20:00',
  fine: '08:00',
  chiamate: [],
  sostituisce: null,
  copertaDa: null,
  ...altro,
});

const CONTRATTO = { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null };
const COORD = 'uCoordA';

function rigaDi(dipendenteId: string, giorni: Record<string, Cella>, versione = 1) {
  return {
    dipendenteId,
    contratto: CONTRATTO,
    giorni,
    versione,
    aggiornatoDa: COORD,
    aggiornatoIl: ORA,
  };
}

function meseDi(
  chiave: string,
  calendario: Cella = { festivita: {}, attribuzioneNotte: 'inizio' },
) {
  const [anno, mese] = chiave.split('-').map(Number);
  return {
    chiave,
    anno,
    mese,
    stato: 'bozza',
    calendario,
    creatoIl: ORA,
    creatoDa: COORD,
    aggiornatoIl: ORA,
    aggiornatoDa: COORD,
    convalidatoIl: null,
    convalidatoDa: null,
    convalidatoDaNome: null,
  };
}

const rifRepA = (percorso: string) => admin.db.doc(`reparti/repA/${percorso}`);

async function creaMese(chiave: string, righe: Record<string, Record<string, Cella>>) {
  await rifRepA(`mesi/${chiave}`).set(meseDi(chiave));
  await Promise.all(
    Object.entries(righe).map(([id, giorni]) =>
      rifRepA(`mesi/${chiave}/righe/${id}`).set(rigaDi(id, giorni)),
    ),
  );
}

type Dati = Record<string, unknown> | undefined;
const riepilogo = async (chiave: string, id: string): Promise<Dati> =>
  (await rifRepA(`riepiloghi/${chiave}_${id}`).get()).data();
const banca = async (anno: number, id: string): Promise<Dati> =>
  (await rifRepA(`bancaOre/${anno}_${id}`).get()).data();
const senzaOra = (d: Dati) =>
  Object.fromEntries(Object.entries(d ?? {}).filter(([chiave]) => chiave !== 'calcolatoIl'));

async function voci(tipo: string, dipendenteId?: string): Promise<Record<string, unknown>[]> {
  const elenco = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs.filter(
    (d) =>
      d.get('tipo') === tipo &&
      (dipendenteId === undefined || d.get('dipendenteId') === dipendenteId),
  );
  return elenco.map((d) => ({ id: d.id, ...d.data() }));
}

/** Aspetta che la condizione sia vera (i trigger sono asincroni), al massimo 30 secondi. */
async function aspetta<T>(leggi: () => Promise<T>, pronto: (valore: T) => boolean): Promise<T> {
  const limite = adessoMs() + 30_000;
  for (;;) {
    const valore = await leggi();
    if (pronto(valore)) {
      return valore;
    }
    if (adessoMs() > limite) {
      throw new Error(`Condizione non raggiunta: ultimo valore ${JSON.stringify(valore)}`);
    }
    await new Promise((risolvi) => setTimeout(risolvi, 250));
  }
}
const pausa = (ms: number) => new Promise((risolvi) => setTimeout(risolvi, ms));

const clienti = new Map<string, ClienteWeb>();
async function come(uid: string): Promise<ClienteWeb> {
  const esistente = clienti.get(uid);
  if (esistente !== undefined) {
    return esistente;
  }
  const cliente = await accedi(uid);
  clienti.set(uid, cliente);
  return cliente;
}

async function convalida(uid: string, chiave: string): Promise<void> {
  await (await come(uid)).chiama('convalidaMese', { repartoId: 'repA', chiaveMese: chiave });
}

/** Come «Salva bozza»: la riga con versione + 1, gli orari e l'autore del server. */
async function salva(
  uid: string,
  chiave: string,
  dipendenteId: string,
  versione: number,
  giorni: Record<string, Cella>,
): Promise<void> {
  const { db } = await come(uid);
  await updateDoc(doc(db, `reparti/repA/mesi/${chiave}/righe/${dipendenteId}`), {
    versione,
    aggiornatoIl: serverTimestamp(),
    aggiornatoDa: uid,
    ...Object.fromEntries(Object.entries(giorni).map(([g, c]) => [`giorni.${g}`, c])),
  });
}

beforeEach(async () => {
  await svuotaEmulatori();
  // Lo svuotamento cancella le righe del test precedente e i trigger vedono le cancellazioni con un po' di ritardo:
  // ricalcolerebbero la banca ore (senza più riepiloghi) sui documenti che il test seguente sta preparando.
  await pausa(1500);
  const utenti: [string, 'ADMIN' | 'COORDINATORE'][] = [
    ['uAdmin', 'ADMIN'],
    [COORD, 'COORDINATORE'],
    ['uCoordB', 'COORDINATORE'],
  ];
  for (const [uid, ruolo] of utenti) {
    await creaUtente(admin, { uid, ruolo, documento: { ruolo, attivo: true } });
  }
  const reparto = (coordinatoreUid: string) => ({
    nome: 'Reparto',
    coordinatoreUid,
    configurazione: { passo: 'completata' },
    impostazioni: { attribuzioneNotte: 'inizio' },
    festivita: { nazionaliEscluse: [], locali: [] },
    creatoIl: ORA,
    creatoDa: coordinatoreUid,
    aggiornatoIl: ORA,
    aggiornatoDa: coordinatoreUid,
  });
  await admin.db.doc('reparti/repA').set(reparto(COORD));
  await admin.db.doc('reparti/repB').set(reparto('uCoordB'));
});

afterAll(async () => {
  await Promise.all([...clienti.values()].map((c) => c.chiudi()));
  await admin.chiudi();
});

describe('scritture di consuntivo dal browser', () => {
  it('orario reale su un mese in bozza: la riga si salva, riepilogo e banca ore seguono, il registro annota prima e dopo', async () => {
    await creaMese('2026-11', { dipA: { '02': M1, '05': M1 } });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['minutiLavorati'] === 780,
    );
    expect(await voci('consuntivo.modificato')).toEqual([]); // il piano non è consuntivo

    await salva(COORD, '2026-11', 'dipA', 2, {
      '05': { ...M1, orarioReale: { inizio: '07:00', fine: '14:30' } },
    });

    const r = await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['variazioni'] === 1,
    );
    expect(r).toMatchObject({
      minutiLavorati: 810,
      minutiVariazioni: 30,
      statoMese: 'bozza',
      valida: true,
    });
    const b = await aspetta(
      () => banca(2026, 'dipA'),
      (v) =>
        (v?.['mesi'] as Record<string, { minutiLavorati: number }>)['11']?.minutiLavorati === 810,
    );
    expect(b).toMatchObject({
      dipendenteId: 'dipA',
      anno: 2026,
      riportoMinuti: 0,
      mesi: { '11': { minutiLavorati: 810, definitivo: false } },
      provvisorio: true,
    });

    const elenco = await aspetta(
      () => voci('consuntivo.modificato'),
      (v) => v.length > 0,
    );
    expect(elenco).toHaveLength(1);
    expect(elenco[0]).toMatchObject({
      tipo: 'consuntivo.modificato',
      autoreUid: COORD,
      autoreNome: null,
      autoreRuolo: 'COORDINATORE',
      repartoId: 'repA',
      chiaveMese: '2026-11',
      dipendenteId: 'dipA',
      dettagli: {
        giorno: '05',
        campo: 'orarioReale',
        prima: null,
        dopo: '07:00-14:30',
        versione: 2,
      },
    });
    expect(elenco[0]?.['il']).toBeDefined();
    expect(String(elenco[0]?.['id'])).toMatch(/_0$/);
    // Nessun nome (né del coordinatore né di altri): solo giorno, campo, valori (codici, orari, ID) e versione.
    expect(Object.keys(elenco[0]?.['dettagli'] as object).sort()).toEqual([
      'campo',
      'dopo',
      'giorno',
      'prima',
      'versione',
    ]);
    expect(JSON.stringify(elenco[0])).not.toContain('Nome uCoordA');
  });

  it('assenza, sostituzione e chiamata su due righe: una voce per modifica, solo ID e codici', async () => {
    await creaMese('2026-11', {
      dipA: { '09': M1, '10': cella({ reperibilita: [R2()] }) },
      dipB: {},
    });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['turniSvolti'] === 1,
    );
    const { db } = await come(COORD);
    // Malattia di A il 9, B lo sostituisce: due righe nella stessa transazione, come la griglia.
    await runTransaction(db, async (tx) => {
      const rifA = doc(db, 'reparti/repA/mesi/2026-11/righe/dipA');
      const rifB = doc(db, 'reparti/repA/mesi/2026-11/righe/dipB');
      const [a, b] = [await tx.get(rifA), await tx.get(rifB)];
      const comune = { aggiornatoIl: serverTimestamp(), aggiornatoDa: COORD };
      tx.update(rifA, {
        ...comune,
        versione: Number(a.get('versione')) + 1,
        'giorni.09': { ...M1, assenza: MALATTIA, copertoDa: 'dipB' },
        'giorni.10': cella({
          reperibilita: [R2({ chiamate: [{ durataMinuti: 45, oraInizio: '23:10' }] })],
        }),
      });
      tx.update(rifB, {
        ...comune,
        versione: Number(b.get('versione')) + 1,
        'giorni.09': { ...M1, sostituisce: 'dipA' },
      });
    });

    const daA = await aspetta(
      () => voci('consuntivo.modificato', 'dipA'),
      (v) => v.length === 3,
    );
    const daB = await aspetta(
      () => voci('consuntivo.modificato', 'dipB'),
      (v) => v.length === 1,
    );
    const dettagli = (elenco: Record<string, unknown>[]) =>
      elenco
        .map((v) => v['dettagli'])
        .sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    expect(dettagli(daA)).toEqual([
      { giorno: '09', campo: 'assenza', prima: null, dopo: 'MA', versione: 2 },
      { giorno: '09', campo: 'copertoDa', prima: null, dopo: 'dipB', versione: 2 },
      { giorno: '10', campo: 'chiamate', prima: null, dopo: 'R2:45@23:10', versione: 2 },
    ]);
    expect(dettagli(daB)).toEqual([
      { giorno: '09', campo: 'sostituisce', prima: null, dopo: 'dipA', versione: 2 },
    ]);
    // L'assente non ha più le ore del turno coperto, il sostituto le ha.
    await aspetta(
      () => riepilogo('2026-11', 'dipB'),
      (v) => v?.['minutiLavorati'] === 390,
    );
    expect((await riepilogo('2026-11', 'dipA'))?.['minutiLavorati']).toBe(0);
    for (const v of [...daA, ...daB]) {
      expect(v).toMatchObject({ autoreUid: COORD, autoreRuolo: 'COORDINATORE', autoreNome: null });
    }
  });

  it('una modifica del solo piano (turno aggiunto, riposo assegnato) non scrive voci', async () => {
    await creaMese('2026-11', { dipA: { '02': M1 } });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['turniSvolti'] === 1,
    );
    await salva(COORD, '2026-11', 'dipA', 2, { '03': P1, '04': cella({ assenza: RIPOSO }) });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['turniSvolti'] === 2,
    );
    await pausa(1500);
    expect(await voci('consuntivo.modificato')).toEqual([]);
  });

  it('lo stesso evento registrato due volte non duplica le voci', async () => {
    const contesto = {
      idEvento: 'evento-di-prova',
      repartoId: 'repA',
      chiaveMese: chiaveMese('2026-11'),
      dipendenteId: 'dipA',
      autoreUid: COORD,
      versione: 4,
    };
    const modifiche = modificheConsuntivo(
      chiaveMese('2026-11'),
      { '03': M1, '04': M1 },
      { '03': { ...M1, assenza: MALATTIA }, '04': { ...M1, assenza: MALATTIA } },
    );
    expect(modifiche).toHaveLength(2);
    await registraConsuntivo(contesto, modifiche);
    await registraConsuntivo(contesto, modifiche);
    const elenco = await voci('consuntivo.modificato');
    expect(elenco.map((v) => v['id']).sort()).toEqual(['evento-di-prova_0', 'evento-di-prova_1']);
  });

  it('mese convalidato: ogni scrittura è respinta e non resta nulla nel registro del consuntivo', async () => {
    await creaMese('2025-03', { dipA: { '02': M1 } });
    await convalida(COORD, '2025-03');
    await aspetta(
      () => riepilogo('2025-03', 'dipA'),
      (v) => v?.['statoMese'] === 'convalidato',
    );
    await expect(
      salva(COORD, '2025-03', 'dipA', 2, {
        '02': { ...M1, orarioReale: { inizio: '07:00', fine: '15:00' } },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      salva(COORD, '2025-03', 'dipA', 2, { '02': { ...M1, assenza: MALATTIA } }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await rifRepA('mesi/2025-03/righe/dipA').get()).get('versione')).toBe(1);
    await pausa(1000);
    expect(await voci('consuntivo.modificato')).toEqual([]);
  });

  it('un coordinatore non proprietario e l’ADMIN non scrivono il consuntivo', async () => {
    await creaMese('2026-11', { dipA: { '02': M1 } });
    for (const uid of ['uCoordB', 'uAdmin']) {
      await expect(
        salva(uid, '2026-11', 'dipA', 2, {
          '02': { ...M1, orarioReale: { inizio: '07:00', fine: '15:00' } },
        }),
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }
    expect((await rifRepA('mesi/2026-11/righe/dipA').get()).get('versione')).toBe(1);
  });

  it('forma di primo livello non valida: respinta (giorni non mappa, giorno inesistente, versione, campo in più)', async () => {
    await creaMese('2026-11', { dipA: { '02': M1 } });
    const { db } = await come(COORD);
    const rif = doc(db, 'reparti/repA/mesi/2026-11/righe/dipA');
    const comune = { aggiornatoIl: serverTimestamp(), aggiornatoDa: COORD };
    const casi: Record<string, unknown>[] = [
      { ...comune, versione: 2, giorni: 'x' },
      { ...comune, versione: 2, giorni: [M1] },
      { ...comune, versione: 2, 'giorni.32': M1 },
      { ...comune, versione: 3, 'giorni.03': M1 },
      { ...comune, versione: 2, 'giorni.03': M1, nomeDipendente: 'Mario' },
      { aggiornatoIl: serverTimestamp(), aggiornatoDa: 'uCoordB', versione: 2 },
    ];
    for (const dati of casi) {
      await expect(updateDoc(rif, dati)).rejects.toMatchObject({ code: 'permission-denied' });
    }
    expect((await rifRepA('mesi/2026-11/righe/dipA').get()).get('versione')).toBe(1);
  });

  it('cella non valida (le regole non la vedono, L4): riepilogo non valido, banca ore senza quel mese, convalida rifiutata finché non si corregge', async () => {
    await creaMese('2025-03', { dipA: { '02': M1 } });
    await aspetta(
      () => riepilogo('2025-03', 'dipA'),
      (v) => v?.['valida'] === true,
    );
    await salva(COORD, '2025-03', 'dipA', 2, { '03': { turno: 'sbagliato' } });
    const r = await aspetta(
      () => riepilogo('2025-03', 'dipA'),
      (v) => v?.['valida'] === false,
    );
    expect(r?.['erroriValidazione']).toEqual(['cellaMalformata']);
    const b = await aspetta(
      () => banca(2025, 'dipA'),
      (v) => v?.['provvisorio'] === true && Object.keys(v['mesi'] as object).length === 0,
    );
    expect(b).toMatchObject({ saldoAnnoMinuti: 0, mesi: {} });
    await expect(
      (await come(COORD)).chiama('convalidaMese', { repartoId: 'repA', chiaveMese: '2025-03' }),
    ).rejects.toMatchObject({ details: { codice: 'RIGHE_NON_VALIDE', righe: ['dipA'] } });

    await salva(COORD, '2025-03', 'dipA', 3, { '03': M1 });
    await aspetta(
      () => riepilogo('2025-03', 'dipA'),
      (v) => v?.['valida'] === true,
    );
    await convalida(COORD, '2025-03');
    const definitiva = await aspetta(
      () => banca(2025, 'dipA'),
      (v) => v?.['provvisorio'] === false,
    );
    expect(definitiva?.['mesi']).toMatchObject({ '03': { definitivo: true } });
  });
});

describe('banca ore', () => {
  const bancaPrecedente = (saldoAnnoMinuti: number, provvisorio = false) => ({
    dipendenteId: 'dipA',
    anno: 2025,
    riportoMinuti: 0,
    mesi: {},
    saldoAnnoMinuti,
    saldoDefinitivoMinuti: saldoAnnoMinuti,
    provvisorio,
    calcolatoIl: ORA,
  });

  it('riporto dall’anno prima, mese in bozza provvisorio e ricalcolo ripetuto identico (calcolatoIl invariato)', async () => {
    await rifRepA('bancaOre/2025_dipA').set(bancaPrecedente(600));
    await creaMese('2026-11', { dipA: { '02': M1 } });
    // Una cella vuota in un feriale vale come un riposo (L32): 1 turno da 390 contro 21 feriali da 432.
    const b = await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v !== undefined,
    );
    expect(b).toMatchObject({
      riportoMinuti: 600,
      saldoAnnoMinuti: 600 + 390 - 21 * 432,
      saldoDefinitivoMinuti: 600,
      provvisorio: true,
      mesi: { '11': { minutiLavorati: 390, minutiDovuti: 21 * 432, definitivo: false } },
    });
    await ricalcolaBancaOre('repA', 'dipA', 2026);
    await ricalcolaBancaOre('repA', 'dipA', 2026);
    expect(await banca(2026, 'dipA')).toEqual(b);

    // Il riepilogo ricalcolato sugli stessi dati dà lo stesso risultato.
    await ricalcolaRiepilogo('repA', 'dipA', chiaveMese('2026-11'));
    const primo = await riepilogo('2026-11', 'dipA');
    await ricalcolaRiepilogo('repA', 'dipA', chiaveMese('2026-11'));
    expect(senzaOra(await riepilogo('2026-11', 'dipA'))).toEqual(senzaOra(primo));
  });

  it('un riporto provvisorio rende provvisorio anche l’anno dopo', async () => {
    await rifRepA('bancaOre/2025_dipA').set(bancaPrecedente(-100, true));
    await creaMese('2026-11', { dipA: {} });
    const b = await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v !== undefined,
    );
    expect(b).toMatchObject({ riportoMinuti: -100, provvisorio: true });
  });

  it('il cambio di un saldo di dicembre aggiorna il riporto di gennaio (senza trigger a catena)', async () => {
    await creaMese('2026-12', { dipA: { '01': M1 } });
    await creaMese('2027-01', { dipA: { '04': M1 } });
    const dicembre = await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v !== undefined && v['saldoAnnoMinuti'] === 390 - 23 * 432,
    );
    const gennaio = await aspetta(
      () => banca(2027, 'dipA'),
      (v) => v !== undefined && v['riportoMinuti'] === dicembre?.['saldoAnnoMinuti'],
    );
    expect(gennaio?.['provvisorio']).toBe(true);

    // Dicembre guadagna due turni: il riporto di gennaio segue.
    await salva(COORD, '2026-12', 'dipA', 2, { '02': M1, '03': M1 });
    const nuovoDicembre = await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v?.['saldoAnnoMinuti'] === 3 * 390 - 23 * 432,
    );
    const nuovoGennaio = await aspetta(
      () => banca(2027, 'dipA'),
      (v) => v?.['riportoMinuti'] === nuovoDicembre?.['saldoAnnoMinuti'],
    );
    expect(nuovoGennaio?.['saldoAnnoMinuti']).toBe(
      3 * 390 - 23 * 432 + (390 - 21 * 432), // riporto + saldo di gennaio (21 feriali, 1 turno)
    );
  });

  it('la riapertura di un mese convalidato lo rende di nuovo provvisorio nella banca ore (review 3.1b, rilievo 5)', async () => {
    await creaMese('2026-11', { dipA: { '02': M1 } });
    await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v?.['provvisorio'] === true,
    );
    // Convalida a mano (come farebbe la callable): il mese diventa definitivo.
    await rifRepA('mesi/2026-11').update({
      stato: 'convalidato',
      convalidatoIl: ORA,
      convalidatoDa: COORD,
      convalidatoDaNome: null,
    });
    const convalidata = await aspetta(
      () => banca(2026, 'dipA'),
      (v) =>
        (v?.['mesi'] as Record<string, { definitivo: boolean }> | undefined)?.['11']?.definitivo ===
        true,
    );
    expect(convalidata).toMatchObject({ provvisorio: false });

    await rifRepA('mesi/2026-11').update({
      stato: 'bozza',
      convalidatoIl: null,
      convalidatoDa: null,
      convalidatoDaNome: null,
    });
    const riaperta = await aspetta(
      () => banca(2026, 'dipA'),
      (v) =>
        (v?.['mesi'] as Record<string, { definitivo: boolean }> | undefined)?.['11']?.definitivo ===
        false,
    );
    expect(riaperta).toMatchObject({
      provvisorio: true,
      saldoDefinitivoMinuti: 0,
      saldoAnnoMinuti: 390 - 21 * 432,
    });
  });

  it('un riepilogo non valido (contratto non valido) non entra nella banca ore', async () => {
    await creaMese('2026-11', { dipA: { '02': M1, '03': M1 } });
    await rifRepA('mesi/2026-11/righe/dipA').update({
      contratto: { oreSettimanali: 0, dataAssunzione: null, dataCessazione: null },
      versione: 2,
    });
    const r = await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['valida'] === false,
    );
    // Dovute 0 e lavorate 780: senza esclusione il saldo sarebbe +780.
    expect(r).toMatchObject({ minutiDovuti: 0, saldoMinuti: 780 });
    const b = await aspetta(
      () => banca(2026, 'dipA'),
      (v) => v?.['provvisorio'] === true && Object.keys(v['mesi'] as object).length === 0,
    );
    expect(b).toMatchObject({ saldoAnnoMinuti: 0, saldoDefinitivoMinuti: 0 });
  });
});

// Lo scenario di docs/handoff/3.1a (packages/domain/src/consuntivo/scenario.test.ts), con i saldi calcolati a mano
// qui sotto, rifatto sull'emulatore: righe scritte come le scrive il browser, convalida con la callable vera.
//
// Ottobre 2026: l'1 è giovedì; sabati 3, 10, 17, 24, 31; domeniche 4 (San Francesco), 11, 18, 25; 22 feriali da 432
// minuti (36 h). Il 25 alle 03:00 le lancette tornano alle 02:00: la notte del 24 dura un'ora in più.
//   Rossi: M1 (390) nei 22 feriali; malattia 13-15; il 5 esce alle 14:30 (+30).
//     Lavorate 19 × 390 + 30 = 7440; dovute 19 × 432 = 8208; saldo −768.
//   Bianchi: P1 (450) in 20 feriali, riposo il 13; il 14 sostituisce Rossi su M1 (390); notte N1 del 24 con uscita
//     alle 07:30 (630 reali, +30); smonto il 25. Lavorate 9000 + 390 + 630 = 10020; dovute 9504; saldo +516.
//   Banca ore 2026 di Rossi con riporto +600: 600 − 768 = −168.
describe('scenario di ottobre 2026 sull’emulatore', () => {
  const FERIALI = [
    '01', '02', '05', '06', '07', '08', '09', '12', '13', '14', '15', '16', '19', '20', '21',
    '22', '23', '26', '27', '28', '29', '30',
  ]; // prettier-ignore

  it('i saldi tornano al minuto prima e dopo la convalida, e il riporto del 2027 segue', async () => {
    await rifRepA('bancaOre/2025_dipRossi').set({
      dipendenteId: 'dipRossi',
      anno: 2025,
      riportoMinuti: 0,
      mesi: {},
      saldoAnnoMinuti: 600,
      saldoDefinitivoMinuti: 600,
      provvisorio: false,
      calcolatoIl: ORA,
    });

    // 1. Il piano: «Aggiungi mese» (mese e righe nello stesso batch), come il browser.
    const { db } = await come(COORD);
    const pianoRossi = Object.fromEntries(FERIALI.map((g) => [g, M1]));
    const pianoBianchi: Record<string, Cella> = Object.fromEntries(
      FERIALI.map((g) => [g, g === '13' || g === '14' ? cella({ assenza: RIPOSO }) : P1]),
    );
    pianoBianchi['24'] = N1;
    pianoBianchi['25'] = cella({ assenza: SMONTO });
    const batch = writeBatch(db);
    batch.set(doc(db, 'reparti/repA/mesi/2026-10'), {
      ...meseDi('2026-10', {
        festivita: { '04': { id: 'san-francesco', nome: 'San Francesco d’Assisi' } },
        attribuzioneNotte: 'inizio',
      }),
      creatoIl: serverTimestamp(),
      aggiornatoIl: serverTimestamp(),
    });
    for (const [id, giorni] of [
      ['dipRossi', pianoRossi],
      ['dipBianchi', pianoBianchi],
      ['dipVerdi', {}],
    ] as const) {
      batch.set(doc(db, `reparti/repA/mesi/2026-10/righe/${id}`), {
        ...rigaDi(id, giorni),
        aggiornatoIl: serverTimestamp(),
      });
    }
    await batch.commit();
    await aspetta(
      () => riepilogo('2026-10', 'dipRossi'),
      (v) => v?.['saldoMinuti'] === 22 * 390 - 22 * 432,
    );
    // Bianchi pianificato: 20 × 450 + N1 della notte lunga (600) − 22 × 432.
    await aspetta(
      () => riepilogo('2026-10', 'dipBianchi'),
      (v) => v?.['saldoMinuti'] === 9000 + 600 - 9504,
    );

    // 2. Malattia di Rossi dal 13 al 15: tre turni scoperti.
    await salva(COORD, '2026-10', 'dipRossi', 2, {
      '13': { ...M1, assenza: MALATTIA },
      '14': { ...M1, assenza: MALATTIA },
      '15': { ...M1, assenza: MALATTIA },
    });
    await aspetta(
      () => riepilogo('2026-10', 'dipRossi'),
      (v) => v?.['saldoMinuti'] === 19 * 390 - 19 * 432,
    );

    // 3. Bianchi sostituisce Rossi il 14 (il riposo si sostituisce col turno): due righe nella stessa transazione.
    await runTransaction(db, async (tx) => {
      const rifA = doc(db, 'reparti/repA/mesi/2026-10/righe/dipRossi');
      const rifB = doc(db, 'reparti/repA/mesi/2026-10/righe/dipBianchi');
      const [a, b] = [await tx.get(rifA), await tx.get(rifB)];
      const comune = { aggiornatoIl: serverTimestamp(), aggiornatoDa: COORD };
      tx.update(rifA, {
        ...comune,
        versione: Number(a.get('versione')) + 1,
        'giorni.14': { ...M1, assenza: MALATTIA, copertoDa: 'dipBianchi' },
      });
      tx.update(rifB, {
        ...comune,
        versione: Number(b.get('versione')) + 1,
        'giorni.14': { ...M1, sostituisce: 'dipRossi' },
      });
    });
    await aspetta(
      () => riepilogo('2026-10', 'dipBianchi'),
      (v) => v?.['saldoMinuti'] === 9000 + 390 + 600 - 9504,
    );

    // 4. Le due variazioni di orario, nella notte del cambio d'ora per Bianchi.
    await salva(COORD, '2026-10', 'dipRossi', 4, {
      '05': { ...M1, orarioReale: { inizio: '07:00', fine: '14:30' } },
    });
    await salva(COORD, '2026-10', 'dipBianchi', 3, {
      '24': { ...N1, orarioReale: { inizio: '22:00', fine: '07:30' } },
    });

    const rossiBozza = await aspetta(
      () => riepilogo('2026-10', 'dipRossi'),
      (v) => v?.['saldoMinuti'] === -768,
    );
    const bianchiBozza = await aspetta(
      () => riepilogo('2026-10', 'dipBianchi'),
      (v) => v?.['saldoMinuti'] === 516,
    );
    expect(rossiBozza).toMatchObject({
      statoMese: 'bozza',
      minutiLavorati: 7440,
      minutiDovuti: 8208,
      variazioni: 1,
      minutiVariazioni: 30,
      turniSvolti: 19,
      assenzePerCodice: { MA: 3 },
      numeroAvvisi: 2,
    });
    expect(bianchiBozza).toMatchObject({
      statoMese: 'bozza',
      minutiLavorati: 10020,
      minutiDovuti: 9504,
      variazioni: 1,
      minutiVariazioni: 30,
      turniSvolti: 22,
      conteggiPerCodice: { P1: 20, M1: 1, N1: 1 },
      notti: 1,
      sabati: 1,
      numeroAvvisi: 0,
    });

    // Banca ore in bozza: il saldo dell'anno c'è ma non è definitivo.
    const bancaRossiBozza = await aspetta(
      () => banca(2026, 'dipRossi'),
      (v) => v?.['saldoAnnoMinuti'] === -168,
    );
    expect(bancaRossiBozza).toMatchObject({
      riportoMinuti: 600,
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: 600,
      provvisorio: true,
      mesi: { '10': { saldoMinuti: -768, definitivo: false } },
    });

    // Il registro ha le modifiche di consuntivo (non il piano, non il riposo).
    const vociRossi = await aspetta(
      () => voci('consuntivo.modificato', 'dipRossi'),
      (v) => v.length === 5,
    );
    expect(vociRossi.map((v) => v['dettagli'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ giorno: '13', campo: 'assenza', prima: null, dopo: 'MA' }),
        expect.objectContaining({
          giorno: '14',
          campo: 'copertoDa',
          prima: null,
          dopo: 'dipBianchi',
        }),
        expect.objectContaining({ giorno: '05', campo: 'orarioReale', dopo: '07:00-14:30' }),
      ]),
    );
    const vociBianchi = await aspetta(
      () => voci('consuntivo.modificato', 'dipBianchi'),
      (v) => v.length === 2,
    );
    expect(vociBianchi.map((v) => v['dettagli'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ giorno: '14', campo: 'sostituisce', dopo: 'dipRossi' }),
        expect.objectContaining({ giorno: '24', campo: 'orarioReale', dopo: '22:00-07:30' }),
      ]),
    );

    // 5. Convalida: da novembre in poi (L5) con la callable vera. I saldi non cambiano, diventano definitivi.
    await convalida(COORD, '2026-10');
    for (const id of ['dipRossi', 'dipBianchi', 'dipVerdi']) {
      await aspetta(
        () => riepilogo('2026-10', id),
        (v) => v?.['statoMese'] === 'convalidato',
      );
    }
    expect(await riepilogo('2026-10', 'dipRossi')).toMatchObject({
      saldoMinuti: -768,
      minutiLavorati: 7440,
      minutiDovuti: 8208,
    });
    expect(await riepilogo('2026-10', 'dipBianchi')).toMatchObject({
      saldoMinuti: 516,
      minutiLavorati: 10020,
      minutiDovuti: 9504,
    });
    const bancaRossi = await aspetta(
      () => banca(2026, 'dipRossi'),
      (v) => v?.['provvisorio'] === false,
    );
    expect(bancaRossi).toMatchObject({
      riportoMinuti: 600,
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: -168,
      mesi: {
        '10': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true },
      },
    });
    const bancaBianchi = await aspetta(
      () => banca(2026, 'dipBianchi'),
      (v) => v?.['provvisorio'] === false,
    );
    expect(bancaBianchi).toMatchObject({
      riportoMinuti: 0,
      saldoAnnoMinuti: 516,
      saldoDefinitivoMinuti: 516,
      mesi: { '10': { saldoMinuti: 516, definitivo: true } },
    });

    // Dopo la convalida (D2): sola lettura dal browser, e i ricalcoli non cambiano nulla.
    await expect(
      salva(COORD, '2026-10', 'dipRossi', 5, {
        '06': { ...M1, orarioReale: { inizio: '07:00', fine: '15:00' } },
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await ricalcolaRiepilogo('repA', 'dipRossi', chiaveMese('2026-10'));
    await ricalcolaBancaOre('repA', 'dipRossi', 2026);
    expect(await banca(2026, 'dipRossi')).toEqual(bancaRossi);
    expect(await riepilogo('2026-10', 'dipRossi')).toMatchObject({ saldoMinuti: -768 });

    // 6. A fine anno il saldo diventa il riporto: un 2027 che nasce dopo parte da −168 definitivo.
    await creaMese('2027-01', { dipRossi: { '04': M1 } });
    const gennaio = await aspetta(
      () => banca(2027, 'dipRossi'),
      (v) => v !== undefined,
    );
    expect(gennaio).toMatchObject({ riportoMinuti: -168, provvisorio: true });
  });
});
