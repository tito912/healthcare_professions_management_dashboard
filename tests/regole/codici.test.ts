// Le copie in firestore.rules di regex ed elenchi del dominio devono coincidere (D9, ARCHITETTURA §4).
// Il test legge il file delle regole: non serve l'emulatore.
import {
  CHIAVI_GIORNO,
  ID_COLORI_TURNO,
  ID_FESTIVITA_NAZIONALI,
  REGEX_CHIAVE_MESE,
  REGEX_CODICE_ASSENZA,
  REGEX_CODICE_TURNO,
  REGEX_DATA_ISO,
  REGEX_ORA_LOCALE,
} from '@turni/domain';
import { describe, expect, it } from 'vitest';
import { regoleFirestore } from './aiuti';

/** Corpo della funzione `nome` in firestore.rules. */
function corpo(nome: string): string {
  const inizio = regoleFirestore.indexOf(`function ${nome}(`);
  expect(inizio, `funzione ${nome} in firestore.rules`).toBeGreaterThanOrEqual(0);
  const fine = regoleFirestore.indexOf('}', inizio);
  return regoleFirestore.slice(inizio, fine);
}

/** Unica espressione regolare usata con matches() nella funzione. */
function regexDi(nome: string): string {
  const trovate = [...corpo(nome).matchAll(/\.matches\('([^']*)'\)/g)].map((m) => m[1]);
  expect(trovate, `una sola regex in ${nome}`).toHaveLength(1);
  return trovate[0] ?? '';
}

/** Elenco di stringhe restituito dalla funzione. */
function elencoDi(nome: string): string[] {
  const testo = corpo(nome);
  const lista = testo.slice(testo.indexOf('['), testo.lastIndexOf(']') + 1);
  return [...lista.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
}

describe('firestore.rules allineato al dominio', () => {
  it.each([
    ['codiceTurnoValido', REGEX_CODICE_TURNO],
    ['codiceAssenzaValido', REGEX_CODICE_ASSENZA],
    ['oraValida', REGEX_ORA_LOCALE],
    ['dataValida', REGEX_DATA_ISO],
    ['chiaveMeseValida', REGEX_CHIAVE_MESE],
  ])('%s usa la stessa regex del dominio', (nome, regex) => {
    expect(regexDi(nome)).toBe(regex.source);
  });

  it.each([
    ['coloriTurno', ID_COLORI_TURNO],
    ['festivitaNazionali', ID_FESTIVITA_NAZIONALI],
    ['chiaviGiorno', CHIAVI_GIORNO],
  ])('%s elenca gli stessi valori del dominio', (nome, valori) => {
    expect(elencoDi(nome)).toEqual([...valori]);
  });
});
