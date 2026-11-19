// convalidaMese e trigger dei riepiloghi sugli emulatori (PIANO 2.3 criteri 3, 4 e 7): Functions vere, Firestore
// con le Security Rules vere, client web come nel browser. I dati si preparano con l'Admin SDK, che fa partire i
// trigger come qualunque scrittura: gli esiti dei trigger si aspettano con un'attesa a intervalli.
import { adessoMs, chiaveMese } from '@turni/domain';
import { Timestamp } from 'firebase-admin/firestore';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ricalcolaRiepilogo } from '../src/mesi/ricalcolo';
import {
  accedi,
  adminDiProva,
  clienteWeb,
  creaUtente,
  svuotaEmulatori,
  type ClienteWeb,
} from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);

// --- celle e righe in JSON, come stanno su Firestore -----------------------------------------------

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
const P1 = { ...vuota, turno: turno('P1', '14:00', '22:00', 30) };
const N1 = { ...vuota, turno: turno('N1', '22:00', '07:00', 0) };
const malattia = { codice: 'MA', effetto: 'neutra', malattia: true };

const CONTRATTO = { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null };

type Cella = Record<string, unknown>;

function rigaDi(dipendenteId: string, giorni: Record<string, Cella>, versione = 1) {
  return {
    dipendenteId,
    contratto: CONTRATTO,
    giorni,
    versione,
    aggiornatoDa: 'uCoordA',
    aggiornatoIl: ORA,
  };
}

function meseDi(chiave: string, stato: 'bozza' | 'convalidato' = 'bozza') {
  const [anno, mese] = chiave.split('-').map(Number);
  return {
    chiave,
    anno,
    mese,
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

const MESE_CONCLUSO = '2025-03';

async function creaMese(
  chiave: string,
  righe: Record<string, Record<string, Cella>>,
  stato?: 'bozza' | 'convalidato',
) {
  await admin.db.doc(`reparti/repA/mesi/${chiave}`).set(meseDi(chiave, stato));
  await Promise.all(
    Object.entries(righe).map(([id, giorni]) =>
      admin.db.doc(`reparti/repA/mesi/${chiave}/righe/${id}`).set(rigaDi(id, giorni)),
    ),
  );
}

async function riepilogo(chiave: string, id: string): Promise<Record<string, unknown> | undefined> {
  return (await admin.db.doc(`reparti/repA/riepiloghi/${chiave}_${id}`).get()).data();
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

async function convalida(uid: string, dati: unknown): Promise<{ convalidatoIl: number }> {
  const esito = await (await come(uid)).chiama('convalidaMese', dati);
  if (typeof esito !== 'object' || esito === null || !('convalidatoIl' in esito)) {
    throw new Error('Risposta inattesa');
  }
  return { convalidatoIl: Number(esito.convalidatoIl) };
}

const richiesta = (chiaveMese = MESE_CONCLUSO, repartoId = 'repA') => ({ repartoId, chiaveMese });

beforeEach(async () => {
  // Un trigger ancora in volo dal test precedente trova il mese cancellato e non scrive nulla.
  await svuotaEmulatori();
  const utenti: [string, 'ADMIN' | 'COORDINATORE'][] = [
    ['uAdmin', 'ADMIN'],
    ['uCoordA', 'COORDINATORE'],
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
  await admin.db.doc('reparti/repA').set(reparto('uCoordA'));
  await admin.db.doc('reparti/repB').set(reparto('uCoordB'));
});

afterAll(async () => {
  await Promise.all([...clienti.values()].map((c) => c.chiudi()));
  await admin.chiudi();
});

async function statoMese(chiave: string): Promise<unknown> {
  return (await admin.db.doc(`reparti/repA/mesi/${chiave}`).get()).get('stato');
}

describe('convalidaMese', () => {
  it('percorso corretto: stato, autore e data, registro, righe intatte, riepiloghi definitivi', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1, '03': P1 }, dipB: { '02': N1 } });
    const righePrima = (
      await admin.db.collection(`reparti/repA/mesi/${MESE_CONCLUSO}/righe`).get()
    ).docs.map((r) => [r.id, r.data()]);

    const esito = await convalida('uCoordA', richiesta());
    expect(esito.convalidatoIl).toBeGreaterThan(0);

    const mese = (await admin.db.doc(`reparti/repA/mesi/${MESE_CONCLUSO}`).get()).data();
    expect(mese).toMatchObject({
      stato: 'convalidato',
      convalidatoDa: 'uCoordA',
      convalidatoDaNome: 'Nome uCoordA',
    });
    expect(mese?.['convalidatoIl'].toMillis()).toBe(esito.convalidatoIl);

    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
      .map((d) => d.data())
      .filter((v) => v['tipo'] === 'mese.convalidato');
    expect(voci).toHaveLength(1);
    expect(voci[0]).toMatchObject({
      autoreUid: 'uCoordA',
      autoreRuolo: 'COORDINATORE',
      repartoId: 'repA',
      chiaveMese: MESE_CONCLUSO,
      dettagli: { righe: 2 },
    });

    // D2: le righe non sono state toccate dalla convalida (stessi documenti, stessa versione).
    const righeDopo = (
      await admin.db.collection(`reparti/repA/mesi/${MESE_CONCLUSO}/righe`).get()
    ).docs.map((r) => [r.id, r.data()]);
    expect(righeDopo).toEqual(righePrima);

    // I riepiloghi diventano definitivi (trigger aggiornaRiepiloghiMese).
    for (const id of ['dipA', 'dipB']) {
      const r = await aspetta(
        () => riepilogo(MESE_CONCLUSO, id),
        (v) => v?.['statoMese'] === 'convalidato',
      );
      expect(r).toMatchObject({ valida: true });
    }
  });

  it('dopo la convalida vera ogni scrittura dal browser su mese e righe è respinta dalle regole', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    await convalida('uCoordA', richiesta());
    const { db } = await come('uCoordA');
    const percorsoMese = `reparti/repA/mesi/${MESE_CONCLUSO}`;
    const rifRigaA = doc(db, `${percorsoMese}/righe/dipA`);
    const adesso = serverTimestamp();
    await expect(
      updateDoc(rifRigaA, {
        versione: 2,
        'giorni.03': M1,
        aggiornatoIl: adesso,
        aggiornatoDa: 'uCoordA',
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      setDoc(doc(db, `${percorsoMese}/righe/dipNuova`), {
        ...rigaDi('dipNuova', {}, 1),
        aggiornatoIl: adesso,
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(deleteDoc(rifRigaA)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      updateDoc(doc(db, percorsoMese), {
        stato: 'bozza',
        aggiornatoIl: adesso,
        aggiornatoDa: 'uCoordA',
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      updateDoc(doc(db, percorsoMese), {
        calendario: { festivita: {}, attribuzioneNotte: 'fine' },
        aggiornatoIl: adesso,
        aggiornatoDa: 'uCoordA',
      }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    // Il proprietario continua a leggere.
    expect((await getDoc(rifRigaA)).exists()).toBe(true);
    expect((await admin.db.doc(`${percorsoMese}/righe/dipA`).get()).get('versione')).toBe(1);
    expect(await statoMese(MESE_CONCLUSO)).toBe('convalidato');
  });

  it('una seconda convalida è respinta: MESE_GIA_CONVALIDATO', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    await convalida('uCoordA', richiesta());
    await expect(convalida('uCoordA', richiesta())).rejects.toMatchObject({
      code: 'functions/failed-precondition',
      details: { codice: 'MESE_GIA_CONVALIDATO' },
    });
  });

  it('un mese già convalidato dalla console resta com’è: nessuna nuova voce di registro', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } }, 'convalidato');
    await expect(convalida('uCoordA', richiesta())).rejects.toMatchObject({
      details: { codice: 'MESE_GIA_CONVALIDATO' },
    });
    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
      .map((d) => d.data())
      .filter((v) => v['tipo'] === 'mese.convalidato');
    expect(voci).toHaveLength(0);
  });

  it('non proprietario: NON_PROPRIETARIO, anche per un reparto che non esiste, e nulla cambia', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    await expect(convalida('uCoordB', richiesta())).rejects.toMatchObject({
      code: 'functions/permission-denied',
      details: { codice: 'NON_PROPRIETARIO' },
    });
    await expect(
      convalida('uCoordB', richiesta(MESE_CONCLUSO, 'repInesistente')),
    ).rejects.toMatchObject({
      details: { codice: 'NON_PROPRIETARIO' },
    });
    expect(await statoMese(MESE_CONCLUSO)).toBe('bozza');
  });

  it('l’ADMIN non convalida: RUOLO_NON_AUTORIZZATO', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    await expect(convalida('uAdmin', richiesta())).rejects.toMatchObject({
      details: { codice: 'RUOLO_NON_AUTORIZZATO' },
    });
    expect(await statoMese(MESE_CONCLUSO)).toBe('bozza');
  });

  it('senza accesso: NON_AUTENTICATO', async () => {
    const anonimo = clienteWeb();
    try {
      await expect(anonimo.chiama('convalidaMese', richiesta())).rejects.toMatchObject({
        code: 'functions/unauthenticated',
        details: { codice: 'NON_AUTENTICATO' },
      });
    } finally {
      await anonimo.chiudi();
    }
  });

  it('mese non concluso: MESE_NON_CONCLUSO', async () => {
    await creaMese('2099-01', { dipA: { '02': M1 } });
    await expect(convalida('uCoordA', richiesta('2099-01'))).rejects.toMatchObject({
      code: 'functions/failed-precondition',
      details: { codice: 'MESE_NON_CONCLUSO' },
    });
    expect(await statoMese('2099-01')).toBe('bozza');
  });

  it('mese inesistente: NON_TROVATO; input non valido: INPUT_NON_VALIDO', async () => {
    await expect(convalida('uCoordA', richiesta('2025-04'))).rejects.toMatchObject({
      details: { codice: 'NON_TROVATO' },
    });
    for (const dati of [
      {},
      { repartoId: 'repA' },
      richiesta('2025-13'),
      { ...richiesta(), extra: 1 },
    ]) {
      await expect(convalida('uCoordA', dati)).rejects.toMatchObject({
        details: { codice: 'INPUT_NON_VALIDO' },
      });
    }
  });

  it('riga non valida: RIGHE_NON_VALIDE con l’ID della riga, mese in bozza', async () => {
    await creaMese(MESE_CONCLUSO, {
      dipA: { '02': M1 },
      dipB: { '02': { turno: 'sbagliato' } },
      dipC: { '31': M1 }, // marzo ha 31 giorni: giorno valido
      dipD: { '32': M1 },
    });
    await expect(convalida('uCoordA', richiesta())).rejects.toMatchObject({
      code: 'functions/failed-precondition',
      details: { codice: 'RIGHE_NON_VALIDE', righe: ['dipB', 'dipD'] },
    });
    expect(await statoMese(MESE_CONCLUSO)).toBe('bozza');
  });

  it('righe con i giorni che non sono una mappa: RIGHE_NON_VALIDE, senza errori interni', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    await admin.db
      .doc(`reparti/repA/mesi/${MESE_CONCLUSO}/righe/dipX`)
      .set({ ...rigaDi('dipX', {}), giorni: null });
    await expect(convalida('uCoordA', richiesta())).rejects.toMatchObject({
      details: { codice: 'RIGHE_NON_VALIDE', righe: ['dipX'] },
    });
  });

  it('righe incoerenti tra loro: rifiuto, mentre il riepilogo di A resta valida: true', async () => {
    // A ha il turno scoperto coperto da B, ma B non ha il turno con `sostituisce: A`.
    await creaMese(MESE_CONCLUSO, {
      dipA: { '02': { ...M1, assenza: malattia, copertoDa: 'dipB' } },
      dipB: { '02': { ...vuota } },
    });
    const r = await aspetta(
      () => riepilogo(MESE_CONCLUSO, 'dipA'),
      (v) => v !== undefined,
    );
    expect(r).toMatchObject({ valida: true, erroriValidazione: [] });
    await expect(convalida('uCoordA', richiesta())).rejects.toMatchObject({
      details: { codice: 'RIGHE_NON_VALIDE', righe: ['dipA'] },
    });
    expect(await statoMese(MESE_CONCLUSO)).toBe('bozza');
  });

  it('una sostituzione coerente si convalida', async () => {
    await creaMese(MESE_CONCLUSO, {
      dipA: { '02': { ...M1, assenza: malattia, copertoDa: 'dipB' } },
      dipB: { '02': { ...M1, sostituisce: 'dipA' } },
    });
    await convalida('uCoordA', richiesta());
    expect(await statoMese(MESE_CONCLUSO)).toBe('convalidato');
  });

  it('due convalide insieme: una sola riesce e il registro ha una sola voce', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } });
    const esiti = await Promise.allSettled([
      convalida('uCoordA', richiesta()),
      convalida('uCoordA', richiesta()),
    ]);
    expect(esiti.filter((e) => e.status === 'fulfilled')).toHaveLength(1);
    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs.filter(
      (d) => d.get('tipo') === 'mese.convalidato',
    );
    expect(voci).toHaveLength(1);
  });
});

describe('trigger dei riepiloghi', () => {
  it('due righe dello stesso mese scritte in parallelo producono due riepiloghi corretti', async () => {
    await admin.db.doc('reparti/repA/mesi/2026-11').set(meseDi('2026-11'));
    await Promise.all([
      admin.db
        .doc('reparti/repA/mesi/2026-11/righe/dipA')
        .set(rigaDi('dipA', { '02': M1, '03': P1, '07': M1 })),
      admin.db
        .doc('reparti/repA/mesi/2026-11/righe/dipB')
        .set(rigaDi('dipB', { '02': N1, '10': { ...vuota, assenza: malattia } })),
    ]);
    const a = await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['turniSvolti'] === 3,
    );
    const b = await aspetta(
      () => riepilogo('2026-11', 'dipB'),
      (v) => v?.['turniSvolti'] === 1,
    );
    expect(a).toMatchObject({
      dipendenteId: 'dipA',
      chiaveMese: '2026-11',
      statoMese: 'bozza',
      valida: true,
      sabati: 1,
      notti: 0,
      conteggiPerCodice: { M1: 2, P1: 1 },
      minutiPianificati: 390 * 2 + 450,
    });
    expect(b).toMatchObject({
      dipendenteId: 'dipB',
      notti: 1,
      assenzePerCodice: { MA: 1 },
      minutiPianificati: 540,
    });
    expect(a?.['calcolatoIl']).toBeDefined();
  });

  it('molte righe insieme: ogni riepilogo riflette la propria riga', async () => {
    await admin.db.doc('reparti/repA/mesi/2026-11').set(meseDi('2026-11'));
    const ids = Array.from({ length: 12 }, (_, i) => `dip${String(i).padStart(2, '0')}`);
    await Promise.all(
      ids.map((id, i) =>
        admin.db
          .doc(`reparti/repA/mesi/2026-11/righe/${id}`)
          .set(
            rigaDi(
              id,
              Object.fromEntries(
                Array.from({ length: i + 1 }, (_, g) => [String(g + 1).padStart(2, '0'), M1]),
              ),
            ),
          ),
      ),
    );
    for (const [i, id] of ids.entries()) {
      await aspetta(
        () => riepilogo('2026-11', id),
        (v) => v?.['turniSvolti'] === i + 1,
      );
    }
  });

  it('le righe di novembre e dicembre dello stesso dipendente scritte in parallelo: dicembre coerente con entrambe', async () => {
    await admin.db.doc('reparti/repA/mesi/2026-11').set(meseDi('2026-11'));
    await admin.db.doc('reparti/repA/mesi/2026-12').set(meseDi('2026-12'));
    await Promise.all([
      admin.db.doc('reparti/repA/mesi/2026-11/righe/dipA').set(rigaDi('dipA', { '30': N1 })), // finisce alle 07:00 dell'1/12
      admin.db.doc('reparti/repA/mesi/2026-12/righe/dipA').set(rigaDi('dipA', { '01': M1 })), // inizia alle 07:00: riposo 0
    ]);
    const dicembre = await aspetta(
      () => riepilogo('2026-12', 'dipA'),
      (v) => v?.['turniSvolti'] === 1 && v['numeroAvvisi'] === 1,
    );
    const novembre = await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['turniSvolti'] === 1 && v['numeroAvvisi'] === 1,
    );
    expect(dicembre).toMatchObject({ notti: 0, conteggiPerCodice: { M1: 1 } });
    expect(novembre).toMatchObject({ notti: 1, conteggiPerCodice: { N1: 1 } });

    // Modificare la riga di dicembre ricalcola anche novembre (il riposo conta in entrambi).
    await admin.db.doc('reparti/repA/mesi/2026-12/righe/dipA').set(rigaDi('dipA', { '02': M1 }, 2));
    await aspetta(
      () => riepilogo('2026-12', 'dipA'),
      (v) => v?.['numeroAvvisi'] === 0,
    );
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v?.['numeroAvvisi'] === 0,
    );
  });

  it('rieseguire il calcolo sugli stessi dati dà lo stesso documento', async () => {
    await creaMese('2026-11', { dipA: { '02': M1, '03': P1 } });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v !== undefined,
    );
    await ricalcolaRiepilogo('repA', 'dipA', chiaveMese('2026-11'));
    const primo = await riepilogo('2026-11', 'dipA');
    await ricalcolaRiepilogo('repA', 'dipA', chiaveMese('2026-11'));
    const secondo = await riepilogo('2026-11', 'dipA');
    const senzaOra = (d: Record<string, unknown> | undefined) =>
      Object.fromEntries(Object.entries(d ?? {}).filter(([chiave]) => chiave !== 'calcolatoIl'));
    expect(senzaOra(secondo)).toEqual(senzaOra(primo));
    expect(senzaOra(primo)).toMatchObject({ turniSvolti: 2 });
  });

  it('non crea riepiloghi per un mese che non esiste e non tocca le righe', async () => {
    await creaMese('2026-11', { dipA: { '02': M1 } });
    await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v !== undefined,
    );
    expect(await riepilogo('2026-10', 'dipA')).toBeUndefined();
    expect(await riepilogo('2026-12', 'dipA')).toBeUndefined();
    const riga = (await admin.db.doc('reparti/repA/mesi/2026-11/righe/dipA').get()).data();
    expect(riga).toEqual(rigaDi('dipA', { '02': M1 }));
  });

  it('riga non valida: riepilogo valida false e voce riga.nonValida senza dati personali', async () => {
    await creaMese('2026-11', { dipA: { '02': M1, '03': { turno: 'sbagliato' } } });
    const r = await aspetta(
      () => riepilogo('2026-11', 'dipA'),
      (v) => v !== undefined,
    );
    expect(r).toMatchObject({
      valida: false,
      erroriValidazione: ['cellaMalformata'],
      turniSvolti: 1,
    });
    const voci = await aspetta(
      async () =>
        (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
          .map((d) => d.data())
          .filter((v) => v['tipo'] === 'riga.nonValida'),
      (v) => v.length > 0,
    );
    expect(voci[0]).toMatchObject({
      autoreUid: null,
      autoreRuolo: 'SISTEMA',
      repartoId: 'repA',
      chiaveMese: '2026-11',
      dipendenteId: 'dipA',
      dettagli: { codici: 'cellaMalformata' },
    });
  });

  it('il cambio del calendario del mese ricalcola le festività di tutte le righe', async () => {
    await creaMese('2026-12', { dipA: { '25': M1 }, dipB: { '25': P1 } });
    await aspetta(
      () => riepilogo('2026-12', 'dipB'),
      (v) => v !== undefined,
    );
    expect((await riepilogo('2026-12', 'dipA'))?.['festivitaIds']).toEqual([]);
    await admin.db.doc('reparti/repA/mesi/2026-12').update({
      calendario: {
        festivita: { '25': { id: 'natale', nome: 'Natale' } },
        attribuzioneNotte: 'inizio',
      },
    });
    for (const id of ['dipA', 'dipB']) {
      const r = await aspetta(
        () => riepilogo('2026-12', id),
        (v) => Array.isArray(v?.['festivitaIds']) && v['festivitaIds'].length === 1,
      );
      expect(r).toMatchObject({ festivitaIds: ['natale'], domenicheEFestivi: 1 });
    }
  });

  it('il passaggio da convalidato a bozza (riapertura a mano) scrive mese.riaperto e ricalcola', async () => {
    await creaMese(MESE_CONCLUSO, { dipA: { '02': M1 } }, 'convalidato');
    await aspetta(
      () => riepilogo(MESE_CONCLUSO, 'dipA'),
      (v) => v !== undefined,
    );
    await admin.db.doc(`reparti/repA/mesi/${MESE_CONCLUSO}`).update({
      stato: 'bozza',
      convalidatoIl: null,
      convalidatoDa: null,
      convalidatoDaNome: null,
    });
    await aspetta(
      () => riepilogo(MESE_CONCLUSO, 'dipA'),
      (v) => v?.['statoMese'] === 'bozza',
    );
    const voci = (await admin.db.collection('reparti/repA/registroAttivita').get()).docs
      .map((d) => d.data())
      .filter((v) => v['tipo'] === 'mese.riaperto');
    expect(voci).toHaveLength(1);
    expect(voci[0]).toMatchObject({ autoreRuolo: 'SISTEMA', chiaveMese: MESE_CONCLUSO });
  });
});
