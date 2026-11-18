import { describe, expect, it } from 'vitest';
import {
  eCodiceFiscaleValido,
  normalizzaCodiceFiscale,
  validaCodiceFiscale,
} from './codice-fiscale';

// Vettori calcolati con un programma indipendente (tabelle dell'Agenzia delle Entrate) e confrontati
// con codici di esempio ampiamente citati (RSSMRA85T10A562S, MRTMTT91D08F205J).
const VALIDI = [
  'RSSMRA85T10A562S', // uomo
  'MRTMTT91D08F205J',
  'BNCLRA80A41H501D', // donna: giorno 41
  'VRDGPP60C15L219A',
  'LVRFNC55P50G273I', // donna: giorno 50
];

describe('normalizzaCodiceFiscale', () => {
  it('rende maiuscolo e toglie ogni spazio', () => {
    expect(normalizzaCodiceFiscale(' rssmra 85t10\ta562s\n')).toBe('RSSMRA85T10A562S');
  });

  it('è idempotente', () => {
    const una = normalizzaCodiceFiscale(' rssmra85t10a562s ');
    expect(normalizzaCodiceFiscale(una)).toBe(una);
  });
});

describe('validaCodiceFiscale', () => {
  it.each(VALIDI)('%s è valido', (codice) => {
    expect(validaCodiceFiscale(codice)).toEqual({ valido: true, codice });
  });

  it('accetta minuscole e spazi e restituisce la forma normalizzata', () => {
    expect(validaCodiceFiscale(' rssmra85t10a562s ')).toEqual({
      valido: true,
      codice: 'RSSMRA85T10A562S',
    });
  });

  it('vuoto', () => {
    expect(validaCodiceFiscale('')).toEqual({ valido: false, motivo: 'vuoto' });
    expect(validaCodiceFiscale('   ')).toEqual({ valido: false, motivo: 'vuoto' });
  });

  it.each(['RSSMRA85T10A562', 'RSSMRA85T10A562SS', 'RSSMRA'])('%s: lunghezza', (codice) => {
    expect(validaCodiceFiscale(codice)).toEqual({ valido: false, motivo: 'lunghezza' });
  });

  it.each([
    ['1SSMRA85T10A562S', 'cifra al posto di una lettera del cognome'],
    ['RSSMRA85X10A562S', 'lettera del mese non ammessa'],
    ['RSSMRA85T00A562S', 'giorno 0'],
    ['RSSMRA85T32A562S', 'giorno 32'],
    ['RSSMRA85T40A562S', 'giorno 40'],
    ['RSSMRA85T72A562S', 'giorno 72'],
    ['RSSMRA85T10A562!', 'carattere speciale in coda'],
    ['RSSMRA85T10AA62S', 'lettera che non è una sostituzione di omocodia'],
  ])('%s: respinto (%s)', (codice) => {
    expect(eCodiceFiscaleValido(codice)).toBe(false);
  });

  it('carattere di controllo sbagliato', () => {
    expect(validaCodiceFiscale('RSSMRA85T10A562X')).toEqual({ valido: false, motivo: 'controllo' });
    expect(validaCodiceFiscale('MRTMTT91D08F205A')).toEqual({ valido: false, motivo: 'controllo' });
  });

  it('una cifra cambiata fa fallire il controllo', () => {
    expect(validaCodiceFiscale('RSSMRA85T11A562S')).toEqual({ valido: false, motivo: 'controllo' });
  });

  it('la struttura sbagliata ha il motivo «formato»', () => {
    expect(validaCodiceFiscale('RSSMRA85X10A562S')).toEqual({ valido: false, motivo: 'formato' });
    expect(validaCodiceFiscale('RSSMRA85T32A562S')).toEqual({ valido: false, motivo: 'formato' });
    expect(validaCodiceFiscale('1SSMRA85T10A562S')).toEqual({ valido: false, motivo: 'formato' });
  });

  describe('omocodia', () => {
    // RSSMRA85T10A562S con le cifre sostituite dalle lettere LMNPQRSTUV (0-9) nelle posizioni
    // 7, 8, 10, 11, 13, 14, 15; il carattere di controllo cambia con i caratteri.
    it.each([
      ['RSSMRA85T10A56NH', 'ultima cifra'],
      ['RSSMRAU5T10A562P', 'prima cifra dell’anno'],
      ['RSSMRAURTMLARSNL', 'tutte le sette posizioni'],
    ])('%s (%s) è valido', (codice) => {
      expect(validaCodiceFiscale(codice)).toEqual({ valido: true, codice });
    });

    it('con il controllo della forma non omocodica non quadra', () => {
      expect(validaCodiceFiscale('RSSMRA85T10A56NS')).toEqual({
        valido: false,
        motivo: 'controllo',
      });
    });

    it('una lettera fuori da LMNPQRSTUV in una posizione numerica è un errore di formato', () => {
      expect(validaCodiceFiscale('RSSMRAA5T10A562S')).toEqual({ valido: false, motivo: 'formato' });
    });
  });

  it('non riporta mai il valore ricevuto nell’esito', () => {
    expect(JSON.stringify(validaCodiceFiscale('rssmra85t10a562x'))).not.toMatch(/rssmra/i);
  });
});
