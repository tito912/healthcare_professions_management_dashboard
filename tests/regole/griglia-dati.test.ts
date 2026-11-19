// Livello dati della griglia (step 2.2) sull'emulatore: le stesse funzioni che usa il browser
// (apps/web/src/app/dati/*.firestore.ts) con un Firestore modulare collegato all'emulatore e un token di
// coordinatore. Provano insieme codice e Security Rules: apertura con le letture contate, «Aggiungi mese»,
// «Salva bozza» (solo le righe toccate, conflitto di versione, mese convalidato).
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import {
  calendarioMese,
  cellaVuota,
  chiaveMese,
  codiceTurno,
  oraLocale,
  type CellaDoc,
} from '@turni/domain';
import { type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { creaMese, leggiMese } from '../../apps/web/src/app/dati/mesi.firestore';
import {
  ErroreSalvataggio,
  leggiRighe,
  salvaRighe,
  type RigaDaSalvare,
} from '../../apps/web/src/app/dati/righe.firestore';
import {
  DIP_1,
  ISTANTE_FISSO,
  MESE_BOZZA,
  MESE_CONVALIDATO,
  REPARTO_A,
  UID,
  ambiente,
  mese,
  riga,
  semina,
  senzaRegole,
} from './aiuti';

const PROGETTO = 'demo-regole-griglia';
const M10 = chiaveMese('2026-10');
const M11 = chiaveMese('2026-11');
const M12 = chiaveMese('2026-12');
const N = 30;
const idDip = (n: number): string => `dip${String(n).padStart(3, '0')}`;

let env: RulesTestEnvironment;
let app: FirebaseApp;
let db: Firestore;
let contatore = 0;

/** Firestore modulare dell'emulatore, autenticato come coordinatore A (token simulato). */
function dbCoordinatore(): { app: FirebaseApp; db: Firestore } {
  contatore += 1;
  const applicazione = initializeApp({ projectId: PROGETTO }, `griglia-dati-${contatore}`);
  const firestore = initializeFirestore(applicazione, { localCache: memoryLocalCache() });
  const [host = '127.0.0.1', porta = '8080'] = (
    process.env['FIRESTORE_EMULATOR_HOST'] ?? '127.0.0.1:8080'
  ).split(':');
  connectFirestoreEmulator(firestore, host, Number(porta), {
    mockUserToken: { sub: UID.coordA, ruolo: 'COORDINATORE' },
  });
  return { app: applicazione, db: firestore };
}

const percorsoRiga = (m: string, did: string): string =>
  `reparti/${REPARTO_A}/mesi/${m}/righe/${did}`;

beforeAll(async () => {
  env = await ambiente(PROGETTO);
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env, async (compat) => {
    // Il dipendente e le righe di base non servono: sotto ce ne sono 30.
    await compat.doc(`reparti/${REPARTO_A}/dipendenti/${DIP_1}/privato/dati`).delete();
    await compat.doc(`reparti/${REPARTO_A}/dipendenti/${DIP_1}`).delete();
    await compat.doc(percorsoRiga(MESE_BOZZA, DIP_1)).delete();
    await compat.doc(percorsoRiga(MESE_CONVALIDATO, DIP_1)).delete();
    // Un reparto di 30 dipendenti con tre mesi (ottobre, novembre, dicembre) già creati.
    const batch = compat.batch();
    for (let i = 1; i <= N; i++) {
      batch.set(compat.doc(`reparti/${REPARTO_A}/dipendenti/${idDip(i)}`), {
        nome: 'N',
        cognome: `C${i}`,
        oreSettimanali: 36,
        turniEsclusi: [],
        dataAssunzione: null,
        dataCessazione: null,
        attivo: true,
        creatoIl: ISTANTE_FISSO,
        aggiornatoIl: ISTANTE_FISSO,
        aggiornatoDa: UID.coordA,
      });
    }
    await batch.commit();
    for (const m of [M10, M11, M12]) {
      const b = compat.batch();
      b.set(compat.doc(`reparti/${REPARTO_A}/mesi/${m}`), mese(m, UID.coordA, {}, ISTANTE_FISSO));
      for (let i = 1; i <= N; i++) {
        b.set(
          compat.doc(percorsoRiga(m, idDip(i))),
          riga(idDip(i), UID.coordA, { versione: 2 }, ISTANTE_FISSO),
        );
      }
      await b.commit();
    }
  });
  ({ app, db } = dbCoordinatore());
});

afterEach(async () => {
  await deleteApp(app);
});

const cella = (codice: string): CellaDoc => ({
  ...cellaVuota(),
  turno: {
    codice: codiceTurno(codice),
    inizio: oraLocale('07:00'),
    fine: oraLocale('14:00'),
    pausaMinuti: 30,
    notturno: false,
  },
});

const daSalvare = (n: number, giorno = '05', versione: number | null = 2): RigaDaSalvare => ({
  dipendenteId: idDip(n),
  contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
  giorni: { [giorno]: cella('M1') },
  grezzi: {},
  versioneCaricata: versione,
});

async function contaConfigurazione(): Promise<number> {
  const base = ['reparti', REPARTO_A] as const;
  const reparto = await getDoc(doc(db, ...base));
  const [turni, assenze, dipendenti] = await Promise.all(
    ['turni', 'assenze', 'dipendenti'].map((c) => getDocs(collection(db, ...base, c))),
  );
  return (
    Number(reparto.exists()) + (turni?.size ?? 0) + (assenze?.size ?? 0) + (dipendenti?.size ?? 0)
  );
}

describe('Apertura del mese: letture contate (PIANO 2.2 criterio 1)', () => {
  it('la prima apertura legge configurazione, mese, righe del mese e dei due mesi adiacenti', async () => {
    // Le stesse letture di RepartiRepo, TurniRepo, AssenzeRepo e DipendentiRepo.
    const letture = await contaConfigurazione();
    const meseLetto = await leggiMese(db, REPARTO_A, M11);
    const righe = await leggiRighe(db, REPARTO_A, M11);
    const precedente = await leggiRighe(db, REPARTO_A, M10);
    const successivo = await leggiRighe(db, REPARTO_A, M12);
    expect(meseLetto?.stato).toBe('bozza');
    expect([righe.length, precedente.length, successivo.length]).toEqual([N, N, N]);
    // reparto 1 + turni 2 + assenze 3 + dipendenti 30 = 36; mese 1; righe 30 + 30 + 30: 127 letture.
    expect(letture).toBe(1 + 2 + 3 + N);
    const totale = letture + 1 + righe.length + precedente.length + successivo.length;
    expect(totale).toBe(36 + 1 + 90);
  });

  it('spostandosi al mese dopo si rileggono solo mese, righe e il mese successivo', async () => {
    // Ottobre e novembre già in memoria: dicembre è il mese corrente, gennaio (non creato) costa 1 lettura.
    const righe = await leggiRighe(db, REPARTO_A, M12);
    const gennaio = await getDocs(collection(db, 'reparti', REPARTO_A, 'mesi', '2027-01', 'righe'));
    expect(righe.length + Math.max(1, gennaio.size) + 1).toBe(N + 1 + 1);
  });
});

describe('«Aggiungi mese»', () => {
  it('crea il mese in bozza e una riga vuota per dipendente (versione 1), accettati dalle regole', async () => {
    const chiave = chiaveMese('2027-01');
    await creaMese(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave,
      calendario: calendarioMese(chiave, { nazionaliEscluse: [], locali: [] }, 'inizio'),
      righe: Array.from({ length: 40 }, (_, i) => ({
        dipendenteId: `nuovo${i}`,
        contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
      })),
    });
    const letto = await leggiMese(db, REPARTO_A, chiave);
    expect(letto?.stato).toBe('bozza');
    expect(Object.keys(letto?.calendario.festivita ?? {}).sort()).toEqual(['01', '06']);
    const righe = await leggiRighe(db, REPARTO_A, chiave);
    expect(righe).toHaveLength(40);
    expect(righe.every((r) => r.versione === 1 && Object.keys(r.giorni).length === 0)).toBe(true);
  });

  it('con più di 499 righe divide in più batch e le regole accettano anche i successivi', async () => {
    const chiave = chiaveMese('2027-02');
    await creaMese(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave,
      calendario: { festivita: {}, attribuzioneNotte: 'inizio' },
      righe: Array.from({ length: 520 }, (_, i) => ({
        dipendenteId: `x${i}`,
        contratto: { oreSettimanali: 36, dataAssunzione: null, dataCessazione: null },
      })),
    });
    expect(await leggiRighe(db, REPARTO_A, chiave)).toHaveLength(520);
  });

  it('un mese già esistente non si ricrea (update vietato dalle regole sul batch di creazione)', async () => {
    await expect(
      creaMese(db, {
        repartoId: REPARTO_A,
        uid: UID.coordA,
        chiave: M11,
        calendario: { festivita: {}, attribuzioneNotte: 'inizio' },
        righe: [],
      }),
    ).rejects.toThrow();
  });
});

describe('«Salva bozza»', () => {
  it('scrive solo le righe toccate, con versione + 1, e lascia le altre intatte', async () => {
    const versioni = await salvaRighe(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave: M11,
      righe: [daSalvare(3), daSalvare(7, '12')],
      calendario: null,
    });
    expect([...versioni.entries()]).toEqual([
      [idDip(3), 3],
      [idDip(7), 3],
    ]);
    const righe = new Map((await leggiRighe(db, REPARTO_A, M11)).map((r) => [r.dipendenteId, r]));
    expect(righe.get(idDip(3))?.giorni['05']?.turno?.codice).toBe('M1');
    expect(righe.get(idDip(7))?.giorni['12']?.turno?.codice).toBe('M1');
    expect(righe.get(idDip(3))?.versione).toBe(3);
    // Le altre 28 righe non sono state toccate (versione e giorni come prima).
    const altre = [...righe.values()].filter((r) => ![idDip(3), idDip(7)].includes(r.dipendenteId));
    expect(altre).toHaveLength(N - 2);
    expect(altre.every((r) => r.versione === 2 && Object.keys(r.giorni).length === 0)).toBe(true);
  });

  it('con il calendario allineato aggiorna anche il documento del mese', async () => {
    await salvaRighe(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave: M11,
      righe: [],
      calendario: {
        festivita: { '01': { id: 'ognissanti', nome: 'Ognissanti' } },
        attribuzioneNotte: 'fine',
      },
    });
    const letto = await leggiMese(db, REPARTO_A, M11);
    expect(letto?.calendario.attribuzioneNotte).toBe('fine');
    expect(letto?.calendario.festivita['01']?.nome).toBe('Ognissanti');
  });

  it('conflitto di versione: se un altro ha scritto la riga nel frattempo non scrive nulla', async () => {
    await senzaRegole(env, async (compat) => {
      await compat.doc(percorsoRiga(M11, idDip(7))).update({ versione: 3 });
    });
    await expect(
      salvaRighe(db, {
        repartoId: REPARTO_A,
        uid: UID.coordA,
        chiave: M11,
        righe: [daSalvare(3), daSalvare(7)],
        calendario: null,
      }),
    ).rejects.toMatchObject({ codice: 'CONFLITTO_VERSIONE' });
    const tre = await getDoc(doc(db, percorsoRiga(M11, idDip(3))));
    expect(tre.get('versione')).toBe(2);
    expect(tre.get('giorni')).toEqual({});
  });

  it('mese convalidato nel frattempo: MESE_CONVALIDATO e nessuna scrittura', async () => {
    await senzaRegole(env, async (compat) => {
      await compat.doc(`reparti/${REPARTO_A}/mesi/${M11}`).update({ stato: 'convalidato' });
    });
    const errore = await salvaRighe(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave: M11,
      righe: [daSalvare(3)],
      calendario: null,
    }).catch((e: unknown) => e);
    expect(errore).toBeInstanceOf(ErroreSalvataggio);
    expect(errore).toMatchObject({ codice: 'MESE_CONVALIDATO' });
    expect((await getDoc(doc(db, percorsoRiga(M11, idDip(3))))).get('versione')).toBe(2);
  });

  it('una riga nuova (allineamento) si crea con versione 1; se esiste già è un conflitto', async () => {
    await salvaRighe(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave: M11,
      righe: [{ ...daSalvare(1, '05', null), dipendenteId: 'nuovoDip' }],
      calendario: null,
    });
    const nuova = await getDoc(doc(db, percorsoRiga(M11, 'nuovoDip')));
    expect(nuova.get('versione')).toBe(1);
    await expect(
      salvaRighe(db, {
        repartoId: REPARTO_A,
        uid: UID.coordA,
        chiave: M11,
        righe: [daSalvare(3, '05', null)],
        calendario: null,
      }),
    ).rejects.toMatchObject({ codice: 'CONFLITTO_VERSIONE' });
  });

  it('le celle non valide già salvate (grezze) si riscrivono invariate', async () => {
    await senzaRegole(env, async (compat) => {
      await compat.doc(percorsoRiga(M11, idDip(3))).update({ giorni: { '09': { turno: 'boh' } } });
    });
    const righe = await leggiRighe(db, REPARTO_A, M11);
    const salvata = righe.find((r) => r.dipendenteId === idDip(3));
    expect(salvata?.grezzi).toEqual({ '09': { turno: 'boh' } });
    await salvaRighe(db, {
      repartoId: REPARTO_A,
      uid: UID.coordA,
      chiave: M11,
      righe: [
        {
          dipendenteId: idDip(3),
          contratto: salvata?.contratto ?? {
            oreSettimanali: 36,
            dataAssunzione: null,
            dataCessazione: null,
          },
          giorni: { '05': cella('M1') },
          grezzi: salvata?.grezzi ?? {},
          versioneCaricata: salvata?.versione ?? 0,
        },
      ],
      calendario: null,
    });
    const dopo = (await getDoc(doc(db, percorsoRiga(M11, idDip(3))))).get('giorni');
    expect(Object.keys(dopo).sort()).toEqual(['05', '09']);
    expect(dopo['09']).toEqual({ turno: 'boh' });
  });
});
