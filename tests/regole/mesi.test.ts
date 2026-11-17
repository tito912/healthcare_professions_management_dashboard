// Condizioni delle celle «C» di reparti/{rid}/mesi/{mid} (ARCHITETTURA §7, D2, D18).
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  ADMIN,
  COORD_A,
  ISTANTE_FISSO,
  MESE_BOZZA,
  MESE_CONVALIDATO,
  REPARTO_A,
  REPARTO_C,
  UID,
  ambiente,
  dbDi,
  mese,
  oraServer,
  semina,
  senzaCampo,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-mesi');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);
const percorso = (mid: string, rid = REPARTO_A) => `reparti/${rid}/mesi/${mid}`;
const NATALE = { '25': { id: 'natale', nome: 'Natale' } };

describe('mesi: create', () => {
  it.each<[string, string, Dati]>([
    ['mese in bozza', '2026-12', mese('2026-12', UID.coordA)],
    [
      'mese di gennaio con festività',
      '2027-01',
      mese('2027-01', UID.coordA, {
        calendario: {
          festivita: { '01': { id: 'capodanno', nome: 'Capodanno' } },
          attribuzioneNotte: 'fine',
        },
      }),
    ],
  ])('consentito: %s', async (_caso, mid, dati) => {
    await assertSucceeds(comeA().doc(percorso(mid)).set(dati));
  });

  it.each<[string, string, Dati]>([
    ['mese già convalidato', '2026-12', mese('2026-12', UID.coordA, { stato: 'convalidato' })],
    ['stato non ammesso', '2026-12', mese('2026-12', UID.coordA, { stato: 'chiuso' })],
    ['chiave diversa dall’ID', '2026-12', mese('2027-12', UID.coordA)],
    ['ID non nel formato AAAA-MM', '2026-13', mese('2026-13', UID.coordA)],
    ['anno incoerente con l’ID', '2026-12', mese('2026-12', UID.coordA, { anno: 2027 })],
    ['mese incoerente con l’ID', '2026-12', mese('2026-12', UID.coordA, { mese: 11 })],
    ['anno come stringa', '2026-12', mese('2026-12', UID.coordA, { anno: '2026' })],
    [
      'convalidatoIl impostato',
      '2026-12',
      mese('2026-12', UID.coordA, { convalidatoIl: oraServer() }),
    ],
    [
      'convalidatoDa impostato',
      '2026-12',
      mese('2026-12', UID.coordA, { convalidatoDa: UID.coordA }),
    ],
    [
      'convalidatoDaNome impostato',
      '2026-12',
      mese('2026-12', UID.coordA, { convalidatoDaNome: 'N C' }),
    ],
    ['creatoDa altrui', '2026-12', mese('2026-12', UID.coordA, { creatoDa: UID.coordB })],
    ['aggiornatoDa altrui', '2026-12', mese('2026-12', UID.coordA, { aggiornatoDa: UID.coordB })],
    [
      'creatoIl diverso da request.time',
      '2026-12',
      mese('2026-12', UID.coordA, { creatoIl: ISTANTE_FISSO }),
    ],
    [
      'calendario con un campo in più',
      '2026-12',
      mese('2026-12', UID.coordA, {
        calendario: { festivita: {}, attribuzioneNotte: 'inizio', copertura: true },
      }),
    ],
    [
      'calendario senza attribuzioneNotte',
      '2026-12',
      mese('2026-12', UID.coordA, { calendario: { festivita: {} } }),
    ],
    [
      'attribuzioneNotte non ammessa',
      '2026-12',
      mese('2026-12', UID.coordA, { calendario: { festivita: {}, attribuzioneNotte: 'meta' } }),
    ],
    [
      'festività nel giorno 32',
      '2026-12',
      mese('2026-12', UID.coordA, {
        calendario: { festivita: { '32': { id: 'x', nome: 'x' } }, attribuzioneNotte: 'inizio' },
      }),
    ],
    [
      'festività con giorno senza zero',
      '2026-12',
      mese('2026-12', UID.coordA, {
        calendario: { festivita: { '8': { id: 'x', nome: 'x' } }, attribuzioneNotte: 'inizio' },
      }),
    ],
    [
      'festività come lista',
      '2026-12',
      mese('2026-12', UID.coordA, { calendario: { festivita: [], attribuzioneNotte: 'inizio' } }),
    ],
    ['campo in più', '2026-12', mese('2026-12', UID.coordA, { righe: 30 })],
    ['campo mancante', '2026-12', senzaCampo(mese('2026-12', UID.coordA), 'convalidatoDaNome')],
  ])('negato: %s', async (_caso, mid, dati) => {
    await assertFails(comeA().doc(percorso(mid)).set(dati));
  });

  it('negato: reparto con la configurazione non completata', async () => {
    await assertFails(comeA().doc(percorso('2026-12', REPARTO_C)).set(mese('2026-12', UID.coordA)));
  });

  it('negato: «set» in bozza sopra un mese convalidato (riapertura dal browser)', async () => {
    await assertFails(
      comeA().doc(percorso(MESE_CONVALIDATO)).set(mese(MESE_CONVALIDATO, UID.coordA)),
    );
  });
});

describe('mesi: update', () => {
  const aggiorna = (mid: string, campi: Dati) =>
    comeA()
      .doc(percorso(mid))
      .update({ aggiornatoIl: oraServer(), aggiornatoDa: UID.coordA, ...campi });

  it('consentito: allineamento del calendario in bozza', async () => {
    await assertSucceeds(
      aggiorna(MESE_BOZZA, { calendario: { festivita: NATALE, attribuzioneNotte: 'fine' } }),
    );
  });

  it.each<[string, Dati]>([
    ['cambio di stato a convalidato (cambio di stato dal browser)', { stato: 'convalidato' }],
    ['convalidatoIl impostato', { convalidatoIl: oraServer() }],
    ['convalidatoDa impostato', { convalidatoDa: UID.coordA }],
    ['convalidatoDaNome impostato', { convalidatoDaNome: 'Nome Cognome' }],
    ['cambio di anno', { anno: 2030 }],
    ['cambio di creatoDa', { creatoDa: UID.coordB }],
    ['aggiornatoDa altrui', { aggiornatoDa: UID.coordB }],
    ['aggiornatoIl diverso da request.time', { aggiornatoIl: ISTANTE_FISSO }],
    [
      'calendario con giorno non valido',
      { calendario: { festivita: { '00': {} }, attribuzioneNotte: 'fine' } },
    ],
    ['campo in più', { note: 'x' }],
  ])('negato in bozza: %s', async (_caso, campi) => {
    await assertFails(aggiorna(MESE_BOZZA, campi));
  });

  it.each<[string, Dati]>([
    [
      'allineamento del calendario',
      { calendario: { festivita: NATALE, attribuzioneNotte: 'fine' } },
    ],
    [
      'riapertura: stato in bozza',
      { stato: 'bozza', convalidatoIl: null, convalidatoDa: null, convalidatoDaNome: null },
    ],
    ['solo aggiornatoIl e aggiornatoDa', {}],
  ])('negato su mese convalidato (D2): %s', async (_caso, campi) => {
    await assertFails(aggiorna(MESE_CONVALIDATO, campi));
  });

  it('negato: ADMIN che convalida o riapre dal browser', async () => {
    await assertFails(dbDi(env, ADMIN).doc(percorso(MESE_BOZZA)).update({ stato: 'convalidato' }));
    await assertFails(dbDi(env, ADMIN).doc(percorso(MESE_CONVALIDATO)).update({ stato: 'bozza' }));
  });
});
