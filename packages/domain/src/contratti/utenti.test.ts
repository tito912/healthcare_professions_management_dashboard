import { describe, expect, it } from 'vitest';
import { analizzaInput } from './analisi';
import {
  schemaAssegnaRepartoInput,
  schemaCreaCoordinatoreInput,
  schemaIdDocumento,
  schemaImpostaStatoUtenteInput,
} from './utenti';

describe('creaCoordinatore: input', () => {
  it('normalizza email e nomi', () => {
    const esito = analizzaInput(schemaCreaCoordinatoreInput, {
      email: '  M.Rossi@Ospedale.IT ',
      nome: ' Maria ',
      cognome: 'Rossi',
    });
    expect(esito).toEqual({
      valido: true,
      valore: { email: 'm.rossi@ospedale.it', nome: 'Maria', cognome: 'Rossi' },
    });
  });

  it.each([
    ['email non valida', { email: 'non-una-email', nome: 'Maria', cognome: 'Rossi' }, ['email']],
    ['nome vuoto', { email: 'a@b.it', nome: '   ', cognome: 'Rossi' }, ['nome']],
    [
      'cognome troppo lungo',
      { email: 'a@b.it', nome: 'Maria', cognome: 'x'.repeat(61) },
      ['cognome'],
    ],
    [
      'carattere di controllo',
      { email: 'a@b.it', nome: 'Ma\u0000ria', cognome: 'Rossi' },
      ['nome'],
    ],
    [
      'campo in più',
      { email: 'a@b.it', nome: 'Maria', cognome: 'Rossi', ruolo: 'ADMIN' },
      ['(radice)'],
    ],
    ['campo mancante', { email: 'a@b.it', nome: 'Maria' }, ['cognome']],
  ])('%s', (_caso, dati, campi) => {
    expect(analizzaInput(schemaCreaCoordinatoreInput, dati)).toEqual({ valido: false, campi });
  });

  it('non riporta mai i valori ricevuti', () => {
    const esito = analizzaInput(schemaCreaCoordinatoreInput, { email: 'segreta@x', nome: 1 });
    expect(JSON.stringify(esito)).not.toContain('segreta');
  });

  it('rifiuta un input che non è un oggetto', () => {
    expect(analizzaInput(schemaCreaCoordinatoreInput, null)).toEqual({
      valido: false,
      campi: ['(radice)'],
    });
  });
});

describe('impostaStatoUtente: input', () => {
  it('accetta uid e stato', () => {
    expect(
      analizzaInput(schemaImpostaStatoUtenteInput, { uid: 'abc123', attivo: false }).valido,
    ).toBe(true);
  });

  it.each([
    [{ uid: 'a/b', attivo: false }],
    [{ uid: '..', attivo: false }],
    [{ uid: '', attivo: true }],
    [{ uid: 'abc', attivo: 'false' }],
    [{ uid: 'x'.repeat(129), attivo: true }],
  ])('rifiuta %j', (dati) => {
    expect(analizzaInput(schemaImpostaStatoUtenteInput, dati).valido).toBe(false);
  });
});

describe('schemaIdDocumento (review 1.1, rilievo 1)', () => {
  // Firestore riserva gli ID che corrispondono a __.*__: un documento con quell'ID non si può leggere né
  // scrivere (INVALID_ARGUMENT). Lo schema dice «ID di un documento Firestore», quindi deve rifiutarli.
  it.each(['__x__', '____', '__name__'])('rifiuta l’ID riservato %j', (id) => {
    expect(analizzaInput(schemaIdDocumento, id).valido).toBe(false);
  });

  it('accetta gli ID che iniziano o finiscono con un solo trattino basso', () => {
    expect(analizzaInput(schemaIdDocumento, '_a').valido).toBe(true);
    expect(analizzaInput(schemaIdDocumento, 'a__').valido).toBe(true);
  });
});

describe('assegnaReparto: input', () => {
  it('accetta due ID', () => {
    expect(
      analizzaInput(schemaAssegnaRepartoInput, { repartoId: 'R1', coordinatoreUid: 'u_1' }).valido,
    ).toBe(true);
  });

  it('rifiuta un percorso al posto dell’ID del reparto', () => {
    expect(
      analizzaInput(schemaAssegnaRepartoInput, { repartoId: 'reparti/R1', coordinatoreUid: 'u1' }),
    ).toEqual({ valido: false, campi: ['repartoId'] });
  });
});
