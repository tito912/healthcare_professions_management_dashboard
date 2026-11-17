// Condizioni delle celle «C» di reparti/{rid}/turni/{codice} (ARCHITETTURA §7, D9, L8, L29).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  COORD_A,
  ISTANTE_FISSO,
  REPARTO_A,
  REPARTO_B,
  REPARTO_C,
  UID,
  ambiente,
  dbDi,
  oraServer,
  reparto,
  reperibilita,
  semina,
  senzaCampo,
  turno,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-turni');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);
const crea = (codice: string, dati: Dati, rid = REPARTO_A) =>
  comeA().doc(`reparti/${rid}/turni/${codice}`).set(dati);

describe('turni: create', () => {
  it.each<[string, Dati]>([
    ['turno diurno', turno('P1', { inizio: '14:00', fine: '22:00' })],
    [
      'turno notturno',
      turno('N1', {
        inizio: '22:00',
        fine: '07:00',
        pausaMinuti: 0,
        notturno: true,
        colore: 'blu-notte',
      }),
    ],
    [
      'turno che finisce alle 00:00 (non notturno, L8)',
      turno('S1', { inizio: '16:00', fine: '00:00' }),
    ],
    [
      'turno di 24 ore 08:00-08:00 (notturno, L8)',
      turno('G1', { inizio: '08:00', fine: '08:00', notturno: true }),
    ],
    [
      'turno di 24 ore 00:00-00:00 (notturno, L8)',
      turno('G2', { inizio: '00:00', fine: '00:00', notturno: true }),
    ],
    ['reperibilità senza colore e senza pausa', reperibilita('R3')],
    ['pausa di 240 minuti', turno('L1', { pausaMinuti: 240 })],
    ['turno disattivato', turno('V1', { attivo: false })],
  ])('consentito: %s', async (_caso, dati) => {
    await assertSucceeds(crea(String(dati['codice']), dati));
  });

  it.each<[string, string, Dati]>([
    ['codice di due lettere', 'MM', turno('MM')],
    ['codice minuscolo', 'm1', turno('m1')],
    ['codice di tre caratteri', 'M10', turno('M10')],
    ['codice di sole cifre', '11', turno('11')],
    ['codice diverso dall’ID', 'P1', turno('P2')],
    ['tipo non ammesso', 'P1', turno('P1', { tipo: 'straordinario' })],
    ['nome vuoto', 'P1', turno('P1', { nome: '' })],
    ['nome di 41 caratteri', 'P1', turno('P1', { nome: 'x'.repeat(41) })],
    ['inizio 24:00', 'P1', turno('P1', { inizio: '24:00' })],
    ['inizio senza zero iniziale', 'P1', turno('P1', { inizio: '7:00' })],
    ['fine non stringa', 'P1', turno('P1', { fine: 1400 })],
    ['pausa negativa', 'P1', turno('P1', { pausaMinuti: -1 })],
    ['pausa di 241 minuti', 'P1', turno('P1', { pausaMinuti: 241 })],
    ['pausa non intera', 'P1', turno('P1', { pausaMinuti: 30.5 })],
    ['colore fuori palette', 'P1', turno('P1', { colore: 'viola' })],
    ['turno senza colore', 'P1', turno('P1', { colore: null })],
    ['reperibilità con colore', 'R3', reperibilita('R3', { colore: 'azzurro' })],
    ['reperibilità con pausa', 'R3', reperibilita('R3', { pausaMinuti: 30 })],
    [
      'notturno falso su 22:00-07:00',
      'N1',
      turno('N1', { inizio: '22:00', fine: '07:00', notturno: false }),
    ],
    ['notturno vero su 07:00-14:00', 'P1', turno('P1', { notturno: true })],
    [
      'notturno vero su 16:00-00:00 (L8)',
      'S1',
      turno('S1', { inizio: '16:00', fine: '00:00', notturno: true }),
    ],
    [
      'notturno falso su 00:00-00:00 (L8)',
      'G2',
      turno('G2', { inizio: '00:00', fine: '00:00', notturno: false }),
    ],
    ['notturno non booleano', 'P1', turno('P1', { notturno: 'no' })],
    ['attivo non booleano', 'P1', turno('P1', { attivo: 1 })],
    ['ordine non intero', 'P1', turno('P1', { ordine: 1.5 })],
    ['ordine negativo', 'P1', turno('P1', { ordine: -1 })],
    ['campo in più (durata)', 'P1', turno('P1', { durataMinuti: 420 })],
    ['campo mancante', 'P1', senzaCampo(turno('P1'), 'ordine')],
    ['creatoIl diverso da request.time', 'P1', turno('P1', { creatoIl: ISTANTE_FISSO })],
  ])('negato: %s', async (_caso, id, dati) => {
    await assertFails(crea(id, dati));
  });

  it('consentito: reparto e turno nello stesso batch (proprietarioDopo)', async () => {
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc('reparti/repartoNuovo'), reparto(UID.coordA));
    batch.set(db.doc('reparti/repartoNuovo/turni/M1'), turno('M1'));
    await assertSucceeds(batch.commit());
  });

  it('negato: turno nel reparto di B, anche in un batch che prova a «prendersi» il reparto', async () => {
    await assertFails(crea('P1', turno('P1'), REPARTO_B));
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc(`reparti/${REPARTO_B}`), reparto(UID.coordA));
    batch.set(db.doc(`reparti/${REPARTO_B}/turni/P1`), turno('P1'));
    await assertFails(batch.commit());
  });

  it('negato: turno sotto un reparto inesistente', async () => {
    await assertFails(crea('P1', turno('P1'), 'repartoFantasma'));
  });
});

describe('turni: update', () => {
  const aggiorna = (campi: Dati) =>
    comeA()
      .doc(`reparti/${REPARTO_A}/turni/M1`)
      .update({ aggiornatoIl: oraServer(), ...campi });

  it.each<[string, Dati]>([
    [
      'orari coerenti con notturno',
      { inizio: '22:00', fine: '06:00', notturno: true, pausaMinuti: 0 },
    ],
    ['disattivazione', { attivo: false }],
    ['colore e ordine', { colore: 'verde', ordine: 4 }],
  ])('consentito: %s', async (_caso, campi) => {
    await assertSucceeds(aggiorna(campi));
  });

  it.each<[string, Dati]>([
    ['cambio di tipo', { tipo: 'reperibilita', colore: null, pausaMinuti: 0 }],
    ['cambio di creatoIl', { creatoIl: oraServer() }],
    ['orari incoerenti con notturno', { inizio: '22:00', fine: '06:00' }],
    ['aggiornatoIl diverso da request.time', { aggiornatoIl: ISTANTE_FISSO }],
    ['campo in più', { durataMinuti: 420 }],
  ])('negato: %s', async (_caso, campi) => {
    await assertFails(aggiorna(campi));
  });
});

describe('turni: delete (L29)', () => {
  it('negato: eliminazione di un turno a configurazione completata', async () => {
    await assertFails(comeA().doc(`reparti/${REPARTO_A}/turni/M1`).delete());
  });

  it('consentito: eliminazione durante la configurazione', async () => {
    await assertSucceeds(comeA().doc(`reparti/${REPARTO_C}/turni/M1`).delete());
  });
});
