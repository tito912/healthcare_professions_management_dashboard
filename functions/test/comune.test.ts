// Test unitari dei moduli comuni, senza emulatori.
import { CODICI_ERRORE, schemaCreaCoordinatoreInput, schemaDettagliErrore } from '@turni/domain';
import { HttpsError } from 'firebase-functions/v2/https';
import { describe, expect, it } from 'vitest';
import { errore } from '../src/comune/errori';
import { validaInput } from '../src/comune/validazione';
import { passwordCasuale } from '../src/utenti/password';

describe('errore', () => {
  it.each(CODICI_ERRORE)('%s: HttpsError con details.codice', (codice) => {
    const e = errore(codice);
    expect(e).toBeInstanceOf(HttpsError);
    expect(schemaDettagliErrore.parse(e.details)).toEqual({ codice });
    expect(e.message.length).toBeGreaterThan(0);
  });

  it.each([
    ['NON_AUTENTICATO', 'unauthenticated'],
    ['UTENTE_NON_ABILITATO', 'permission-denied'],
    ['RUOLO_NON_AUTORIZZATO', 'permission-denied'],
    ['NON_PROPRIETARIO', 'permission-denied'],
    ['INPUT_NON_VALIDO', 'invalid-argument'],
    ['NON_TROVATO', 'not-found'],
    ['EMAIL_GIA_USATA', 'already-exists'],
    ['NON_COORDINATORE', 'failed-precondition'],
    ['COORDINATORE_NON_VALIDO', 'failed-precondition'],
    ['ERRORE_INTERNO', 'internal'],
  ] as const)('%s → %s (ARCHITETTURA §8)', (codice, https) => {
    expect(errore(codice).code).toBe(https);
  });
});

describe('validaInput', () => {
  it('restituisce l’input normalizzato dallo schema', () => {
    expect(
      validaInput('prova', schemaCreaCoordinatoreInput, {
        email: ' A@B.it',
        nome: 'Maria',
        cognome: 'Rossi',
      }),
    ).toEqual({ email: 'a@b.it', nome: 'Maria', cognome: 'Rossi' });
  });

  it('rifiuta con INPUT_NON_VALIDO senza riportare i valori ricevuti', () => {
    let lanciato: unknown;
    try {
      validaInput('prova', schemaCreaCoordinatoreInput, {
        email: 'segreta.rossi@',
        nome: 'Maria',
        cognome: 'Rossi',
      });
    } catch (e) {
      lanciato = e;
    }
    expect(lanciato).toBeInstanceOf(HttpsError);
    expect(lanciato).toMatchObject({
      code: 'invalid-argument',
      details: { codice: 'INPUT_NON_VALIDO' },
    });
    expect(JSON.stringify(lanciato)).not.toContain('segreta');
    expect(String(lanciato)).not.toContain('segreta');
  });
});

describe('passwordCasuale', () => {
  it('è lunga, con tutte le classi di caratteri, e cambia a ogni chiamata', () => {
    const generate = Array.from({ length: 50 }, () => passwordCasuale());
    for (const password of generate) {
      expect(password.length).toBeGreaterThanOrEqual(47);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!#%+\-=?@_]/);
    }
    expect(new Set(generate).size).toBe(generate.length);
  });
});
