// Scritture della creazione guidata e della configurazione (step 1.3): i batch che il browser invia,
// e gli stessi batch con un dato non valido «forzato», che le regole devono respingere per intero.
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  COORD_A,
  REPARTO_C,
  UID,
  ambiente,
  assenza,
  dbDi,
  oraServer,
  reparto,
  reperibilita,
  semina,
  turno,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-configurazione');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);

async function esiste(percorso: string): Promise<boolean> {
  let trovato = false;
  await env.withSecurityRulesDisabled(async (contesto) => {
    trovato = (await contesto.firestore().doc(percorso).get()).exists;
  });
  return trovato;
}

/** Il batch del passo 1: reparto con `passo: 'turni'` più R e MA, come lo scrive ConfigurazioneRepo.creaReparto. */
function batchPasso1(modifica: (r: Dati) => Dati = (r) => r) {
  const db = comeA();
  const batch = db.batch();
  batch.set(
    db.doc('reparti/repartoGuidato'),
    modifica(reparto(UID.coordA, { nome: 'Radiologia' })),
  );
  batch.set(db.doc('reparti/repartoGuidato/assenze/R'), assenza('R', { ordine: 0 }));
  batch.set(db.doc('reparti/repartoGuidato/assenze/MA'), assenza('MA', { ordine: 1 }));
  return batch;
}

/**
 * Il batch di «Salva e continua» su un reparto al passo 'turni' con M1, R, MA e F già salvati: aggiorna il
 * reparto (passo avanti, festività con una nazionale esclusa e una locale), cambia M1, crea un turno notturno
 * e una fascia, crea una tipologia di assenza, disattiva F.
 */
function batchSalvataggio(modificaNuovoTurno: (t: Dati) => Dati = (t) => t) {
  const db = comeA();
  const batch = db.batch();
  const nuovo = (percorso: string) => db.doc(`reparti/${REPARTO_C}/${percorso}`);
  batch.update(db.doc(`reparti/${REPARTO_C}`), {
    nome: 'Cardiologia 2',
    impostazioni: { attribuzioneNotte: 'fine' },
    festivita: {
      nazionaliEscluse: ['santo-stefano'],
      locali: [{ id: 'loc-san-giovanni-ab12', nome: 'San Giovanni', giorno: 24, mese: 6 }],
    },
    configurazione: { passo: 'dipendenti' },
    aggiornatoIl: oraServer(),
    aggiornatoDa: UID.coordA,
  });
  batch.update(nuovo('turni/M1'), { fine: '15:00', aggiornatoIl: oraServer() });
  batch.set(
    nuovo('turni/N1'),
    modificaNuovoTurno(
      turno('N1', {
        nome: 'Notte',
        colore: 'ardesia',
        inizio: '22:00',
        fine: '07:00',
        pausaMinuti: 0,
        notturno: true,
        ordine: 1,
      }),
    ),
  );
  batch.set(nuovo('turni/R1'), reperibilita('R1', { ordine: 2 }));
  batch.set(nuovo('assenze/PS'), assenza('PS', { descrizione: 'Permesso', ordine: 3 }));
  batch.update(nuovo('assenze/F'), { attivo: false, aggiornatoIl: oraServer() });
  return batch;
}

describe('creazione guidata: batch del passo 1', () => {
  it('consentito: reparto, R e MA come li scrive l’applicazione', async () => {
    await assertSucceeds(batchPasso1().commit());
    expect(await esiste('reparti/repartoGuidato/assenze/MA')).toBe(true);
  });

  it('negato: lo stesso batch con il passo già avanzato', async () => {
    await assertFails(
      batchPasso1((r) => ({ ...r, configurazione: { passo: 'completata' } })).commit(),
    );
    expect(await esiste('reparti/repartoGuidato')).toBe(false);
  });
});

describe('configurazione: batch di «Salva e continua»', () => {
  it('consentito: reparto, turni, fascia e assenze nello stesso batch', async () => {
    await assertSucceeds(batchSalvataggio().commit());
    expect(await esiste(`reparti/${REPARTO_C}/turni/N1`)).toBe(true);
    expect(await esiste(`reparti/${REPARTO_C}/turni/R1`)).toBe(true);
    expect(await esiste(`reparti/${REPARTO_C}/assenze/PS`)).toBe(true);
  });

  it.each<[string, (t: Dati) => Dati]>([
    ['campo codice diverso dall’ID (N10 nel documento N1)', (t) => ({ ...t, codice: 'N10' })],
    ['notturno incoerente (22:00-07:00 non notturno)', (t) => ({ ...t, notturno: false })],
    ['colore fuori palette', (t) => ({ ...t, colore: 'fucsia' })],
    ['orario non valido', (t) => ({ ...t, fine: '24:00' })],
  ])('negato per intero se un turno forzato ha: %s', async (_caso, modifica) => {
    await assertFails(batchSalvataggio(modifica).commit());
    // Niente è stato scritto: nemmeno le parti valide del batch.
    expect(await esiste(`reparti/${REPARTO_C}/turni/R1`)).toBe(false);
    expect(await esiste(`reparti/${REPARTO_C}/assenze/PS`)).toBe(false);
  });

  it('negato: ID del documento non valido (M10) anche se il campo codice coincide', async () => {
    const db = comeA();
    await assertFails(db.doc(`reparti/${REPARTO_C}/turni/M10`).set(turno('M10')));
  });

  it('negato: un codice da turno come assenza e un codice da assenza come turno', async () => {
    const db = comeA();
    await assertFails(db.doc(`reparti/${REPARTO_C}/assenze/N1`).set(assenza('N1')));
    await assertFails(db.doc(`reparti/${REPARTO_C}/turni/PS`).set(turno('PS')));
  });

  it('negato: ricreare un codice già salvato con un set (diventa un update che cambia creatoIl)', async () => {
    const db = comeA();
    await assertFails(db.doc(`reparti/${REPARTO_C}/turni/M1`).set(turno('M1')));
  });
});
