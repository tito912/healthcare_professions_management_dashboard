// Condizioni delle celle «C» di reparti/{rid}/assenze/{codice} (ARCHITETTURA §5.4, §7; D9, L29).
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
  assenza,
  dbDi,
  oraServer,
  reparto,
  semina,
  senzaCampo,
  type Dati,
} from './aiuti';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await ambiente('demo-regole-assenze');
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await semina(env);
});

const comeA = () => dbDi(env, COORD_A);
const crea = (codice: string, dati: Dati, rid = REPARTO_A) =>
  comeA().doc(`reparti/${rid}/assenze/${codice}`).set(dati);

/**
 * Create nel batch del passo 1 (reparto nuovo + tipologia): il reparto nuovo non ha ancora R e MA,
 * quindi la scrittura passa davvero dal create e non diventa un update di un documento esistente.
 */
function creaNelPasso1(codice: string, dati: Dati): Promise<void> {
  const db = comeA();
  const batch = db.batch();
  batch.set(db.doc('reparti/repartoNuovo'), reparto(UID.coordA));
  batch.set(db.doc(`reparti/repartoNuovo/assenze/${codice}`), dati);
  return batch.commit();
}

describe('assenze: create', () => {
  it('consentito: passo 1, reparto con R e MA nello stesso batch (proprietarioDopo)', async () => {
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc('reparti/repartoNuovo'), reparto(UID.coordA));
    batch.set(db.doc('reparti/repartoNuovo/assenze/R'), assenza('R'));
    batch.set(db.doc('reparti/repartoNuovo/assenze/MA'), assenza('MA'));
    await assertSucceeds(batch.commit());
  });

  it('negato: R e MA predefinite create nel reparto di B', async () => {
    // repartoB ha già R (update di un documento altrui) ma non MA (create con proprietarioDopo).
    await assertFails(crea('R', assenza('R'), REPARTO_B));
    await assertFails(crea('MA', assenza('MA'), REPARTO_B));
  });

  it('consentito: tipologia personalizzata nel batch del passo 1', async () => {
    await assertSucceeds(creaNelPasso1('PS', assenza('PS')));
  });

  // Review 1.1, rilievo 4: come in turni.test.ts, il batch è respinto già dalla scrittura del
  // reparto di B; la difesa vera è che coordinatoreUid non cambia dal browser (reparti.test.ts).
  it('negato: R e MA nel reparto di B con un batch che riscrive il reparto (basta la regola del reparto)', async () => {
    const db = comeA();
    const batch = db.batch();
    batch.set(db.doc(`reparti/${REPARTO_B}`), reparto(UID.coordA));
    batch.set(db.doc(`reparti/${REPARTO_B}/assenze/MA`), assenza('MA'));
    await assertFails(batch.commit());
  });

  it.each<[string, Dati]>([
    ['tipologia personalizzata neutra', assenza('PS', { descrizione: 'Permesso studio' })],
    [
      'tipologia personalizzata come riposo (smonto, L12)',
      assenza('S', { descrizione: 'Smonto', effetto: 'comeRiposo' }),
    ],
    ['tipologia disattivata', assenza('AS', { attivo: false })],
  ])('consentito: %s', async (_caso, dati) => {
    await assertSucceeds(crea(String(dati['codice']), dati));
  });

  it.each<[string, string, Dati]>([
    ['codice di tre lettere', 'ABC', assenza('ABC')],
    ['codice con una cifra (sarebbe un turno)', 'A1', assenza('A1')],
    ['codice minuscolo', 'f', assenza('f')],
    ['codice diverso dall’ID', 'PS', assenza('PT')],
    ['R con effetto neutra', 'R', assenza('R', { effetto: 'neutra' })],
    ['R con malattia', 'R', assenza('R', { malattia: true })],
    ['R non predefinita', 'R', assenza('R', { predefinita: false })],
    ['R disattivata', 'R', assenza('R', { attivo: false })],
    ['MA come riposo', 'MA', assenza('MA', { effetto: 'comeRiposo' })],
    ['MA senza malattia', 'MA', assenza('MA', { malattia: false })],
    ['MA non predefinita', 'MA', assenza('MA', { predefinita: false })],
    ['personalizzata predefinita', 'PS', assenza('PS', { predefinita: true })],
    ['personalizzata con malattia', 'PS', assenza('PS', { malattia: true })],
    ['effetto non ammesso', 'PS', assenza('PS', { effetto: 'positivo' })],
    ['descrizione vuota', 'PS', assenza('PS', { descrizione: '' })],
    ['descrizione di 41 caratteri', 'PS', assenza('PS', { descrizione: 'x'.repeat(41) })],
    ['ordine non intero', 'PS', assenza('PS', { ordine: 'primo' })],
    ['campo in più', 'PS', assenza('PS', { colore: 'rosa' })],
    ['campo mancante', 'PS', senzaCampo(assenza('PS'), 'malattia')],
    ['creatoIl diverso da request.time', 'PS', assenza('PS', { creatoIl: ISTANTE_FISSO })],
  ])('negato: %s', async (_caso, id, dati) => {
    await assertFails(creaNelPasso1(id, dati));
  });
});

describe('assenze: update', () => {
  const aggiorna = (codice: string, campi: Dati) =>
    comeA()
      .doc(`reparti/${REPARTO_A}/assenze/${codice}`)
      .update({ aggiornatoIl: oraServer(), ...campi });

  it.each<[string, string, Dati]>([
    ['R: descrizione', 'R', { descrizione: 'Riposo settimanale' }],
    ['R: ordine', 'R', { ordine: 9 }],
    ['F: disattivazione', 'F', { attivo: false }],
    ['F: effetto', 'F', { effetto: 'comeRiposo' }],
  ])('consentito: %s', async (_caso, codice, campi) => {
    await assertSucceeds(aggiorna(codice, campi));
  });

  it.each<[string, string, Dati]>([
    ['R disattivata (assenza predefinita modificata)', 'R', { attivo: false }],
    ['R con effetto cambiato', 'R', { effetto: 'neutra' }],
    ['R non più predefinita', 'R', { predefinita: false }],
    ['MA senza malattia', 'MA', { malattia: false }],
    ['F diventa predefinita', 'F', { predefinita: true }],
    ['F diventa malattia', 'F', { malattia: true }],
    ['F con creatoIl cambiato', 'F', { creatoIl: oraServer() }],
    ['F con aggiornatoIl diverso da request.time', 'F', { aggiornatoIl: ISTANTE_FISSO }],
  ])('negato: %s', async (_caso, codice, campi) => {
    await assertFails(aggiorna(codice, campi));
  });
});

describe('assenze: delete (L29)', () => {
  it('negato: R predefinita, anche durante la configurazione', async () => {
    await assertFails(comeA().doc(`reparti/${REPARTO_C}/assenze/R`).delete());
  });

  it('negato: tipologia personalizzata a configurazione completata', async () => {
    await assertFails(comeA().doc(`reparti/${REPARTO_A}/assenze/F`).delete());
  });

  it('consentito: tipologia personalizzata durante la configurazione', async () => {
    await assertSucceeds(comeA().doc(`reparti/${REPARTO_C}/assenze/F`).delete());
  });
});
