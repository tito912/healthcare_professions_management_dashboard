// Condizioni delle celle «C» di reparti/{rid} (ARCHITETTURA §7): forma, proprietà, passo in avanti.
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
  REPARTO_A,
  REPARTO_B,
  REPARTO_C,
  UID,
  ambiente,
  dbDi,
  eliminaCampo,
  oraServer,
  reparto,
  semina,
  senzaCampo,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-reparti');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);
const nuovo = (dati: Dati) => comeA().doc('reparti/repartoNuovo').set(dati);
const festivaLocale = (i: number) => ({ id: `loc-${i}`, nome: 'Patrono', giorno: 24, mese: 6 });

describe('reparti: create', () => {
  it('consentito con i campi esatti, passo turni e sé come coordinatore', async () => {
    await assertSucceeds(nuovo(reparto(UID.coordA)));
  });

  it('consentito con nazionali escluse valide e 20 festività locali', async () => {
    const locali = Array.from({ length: 20 }, (_, i) => festivaLocale(i));
    await assertSucceeds(
      nuovo(reparto(UID.coordA, { festivita: { nazionaliEscluse: ['natale', 'pasqua'], locali } })),
    );
  });

  it.each<[string, Dati]>([
    ['coordinatoreUid altrui', { coordinatoreUid: UID.coordB }],
    ['creatoDa altrui', { creatoDa: UID.coordB }],
    ['aggiornatoDa altrui', { aggiornatoDa: UID.coordB }],
    ['passo già avanzato', { configurazione: { passo: 'completata' } }],
    ['passo inesistente', { configurazione: { passo: 'fine' } }],
    ['configurazione con un campo in più', { configurazione: { passo: 'turni', extra: true } }],
    ['nome vuoto', { nome: '' }],
    ['nome di 61 caratteri', { nome: 'x'.repeat(61) }],
    ['nome non stringa', { nome: 42 }],
    ['attribuzioneNotte non ammessa', { impostazioni: { attribuzioneNotte: 'mezzanotte' } }],
    ['impostazioni con un campo in più', { impostazioni: { attribuzioneNotte: 'inizio', x: 1 } }],
    [
      'festività nazionale inesistente',
      { festivita: { nazionaliEscluse: ['carnevale'], locali: [] } },
    ],
    ['nazionaliEscluse non lista', { festivita: { nazionaliEscluse: 'natale', locali: [] } }],
    [
      '21 festività locali',
      {
        festivita: {
          nazionaliEscluse: [],
          locali: Array.from({ length: 21 }, (_, i) => festivaLocale(i)),
        },
      },
    ],
    ['locali non lista', { festivita: { nazionaliEscluse: [], locali: {} } }],
    ['festività senza locali', { festivita: { nazionaliEscluse: [] } }],
    ['festività con un campo in più', { festivita: { nazionaliEscluse: [], locali: [], x: 1 } }],
    ['creatoIl diverso da request.time', { creatoIl: ISTANTE_FISSO }],
    ['aggiornatoIl diverso da request.time', { aggiornatoIl: ISTANTE_FISSO }],
    ['campo in più', { archiviato: false }],
  ])('negato: %s', async (_caso, altro) => {
    await assertFails(nuovo(reparto(UID.coordA, altro)));
  });

  it('negato: campo mancante', async () => {
    await assertFails(nuovo(senzaCampo(reparto(UID.coordA), 'impostazioni')));
  });

  it('negato: «set» su un reparto esistente di un altro coordinatore (è un update)', async () => {
    await assertFails(comeA().doc(`reparti/${REPARTO_B}`).set(reparto(UID.coordA)));
  });
});

describe('reparti: update', () => {
  const aggiorna = (rid: string, campi: Dati) =>
    comeA()
      .doc(`reparti/${rid}`)
      .update({ aggiornatoIl: oraServer(), aggiornatoDa: UID.coordA, ...campi });

  it.each<[string, string, Dati]>([
    ['nome', REPARTO_A, { nome: 'Radiologia' }],
    ['impostazioni', REPARTO_A, { impostazioni: { attribuzioneNotte: 'fine' } }],
    ['festività', REPARTO_A, { festivita: { nazionaliEscluse: ['natale'], locali: [] } }],
    ['passo da turni a dipendenti', REPARTO_C, { configurazione: { passo: 'dipendenti' } }],
    ['passo da turni a completata', REPARTO_C, { configurazione: { passo: 'completata' } }],
  ])('consentito: %s', async (_caso, rid, campi) => {
    await assertSucceeds(aggiorna(rid, campi));
  });

  it.each<[string, Dati]>([
    ['cambio di coordinatoreUid', { coordinatoreUid: UID.coordB }],
    ['cambio di creatoDa', { creatoDa: UID.coordB }],
    ['cambio di creatoIl', { creatoIl: oraServer() }],
    ['passo all’indietro', { configurazione: { passo: 'turni' } }],
    ['aggiornatoDa altrui', { aggiornatoDa: UID.coordB }],
    ['aggiornatoIl diverso da request.time', { aggiornatoIl: ISTANTE_FISSO }],
    ['campo in più', { archiviato: true }],
    ['campo rimosso', { impostazioni: eliminaCampo() }],
    ['nome troppo lungo', { nome: 'x'.repeat(61) }],
    ['festività nazionale inesistente', { festivita: { nazionaliEscluse: ['x'], locali: [] } }],
  ])('negato: %s', async (_caso, campi) => {
    await assertFails(aggiorna(REPARTO_A, campi));
  });

  it('negato: aggiornamento senza aggiornatoIl e aggiornatoDa', async () => {
    await assertFails(comeA().doc(`reparti/${REPARTO_A}`).update({ nome: 'Radiologia' }));
  });

  it('negato: ADMIN che cambia coordinatoreUid (serve assegnaReparto)', async () => {
    await assertFails(
      dbDi(env, ADMIN).doc(`reparti/${REPARTO_A}`).update({
        coordinatoreUid: UID.coordB,
        aggiornatoIl: oraServer(),
        aggiornatoDa: UID.admin,
      }),
    );
  });
});

describe('reparti: list', () => {
  it('negato: coordinatore che filtra sull’uid di un altro', async () => {
    await assertFails(
      comeA().collection('reparti').where('coordinatoreUid', '==', UID.coordB).get(),
    );
  });

  it('consentito: query ordinata per nome sui propri reparti (indice coordinatoreUid, nome)', async () => {
    await assertSucceeds(
      comeA()
        .collection('reparti')
        .where('coordinatoreUid', '==', UID.coordA)
        .orderBy('nome')
        .get(),
    );
  });
});
