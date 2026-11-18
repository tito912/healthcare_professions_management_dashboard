// Inserimento veloce (U7, UX §9.2): dal testo digitato all'assegnazione o all'errore con il motivo.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { CONFIGURAZIONE, cella, o, turnoDiProva } from '../test-utili';
import {
  assegnazioneDaCodice,
  interpretaInserimento,
  type ContestoInserimento,
} from './inserimento';

const contesto: ContestoInserimento = {
  configurazione: CONFIGURAZIONE,
  turniEsclusi: [codiceTurno('N1')],
  inServizio: true,
};

describe('interpretaInserimento', () => {
  it.each([
    [' m1 ', null, cella('M1'), 'turno'],
    ['ma', cella('M1'), cella('M1', 'MA'), 'assenza'],
    ['r', cella('M1'), cella('R'), 'assenza'],
    ['r1', cella('M1'), cella('M1', 'R1'), 'reperibilita'],
    ['R2', cella('R1'), cella('R1', 'R2'), 'reperibilita'],
    ['G1', null, cella('G1'), 'turno'],
  ])('«%s» su %o → applicata', (testo, prima, dopo, tipo) => {
    const esito = interpretaInserimento(testo, prima, contesto);
    expect(esito).toMatchObject({ esito: 'applicata', cella: dopo, assegnazione: { tipo } });
  });

  it.each([
    ['', null, 'vuoto', ''],
    ['   ', null, 'vuoto', ''],
    ['X9', null, 'codiceInesistente', 'X9'],
    ['z', null, 'codiceInesistente', 'Z'],
    ['1m', null, 'codiceInesistente', '1M'],
    ['M12', null, 'codiceInesistente', 'M12'],
    ['x1', null, 'codiceDisattivato', 'X1'],
    ['px', null, 'codiceDisattivato', 'PX'],
    ['R9', null, 'codiceDisattivato', 'R9'],
    ['n1', null, 'turnoEscluso', 'N1'],
    ['R3', cella('R1', 'R2'), 'massimoReperibilita', 'R3'],
    ['R1', cella('R1'), 'reperibilitaGiaPresente', 'R1'],
  ])('«%s» → rifiutata: %s', (testo, prima, motivo, codice) => {
    expect(interpretaInserimento(testo, prima, contesto)).toEqual({
      esito: 'rifiutata',
      motivo,
      codice,
    });
  });

  it('fuori servizio', () => {
    expect(interpretaInserimento('M1', null, { ...contesto, inServizio: false })).toEqual({
      esito: 'rifiutata',
      motivo: 'fuoriServizio',
      codice: 'M1',
    });
  });

  it('cella con consuntivo', () => {
    const prima = cella('M1', { orarioReale: { inizio: o('07:00'), fine: o('15:00') } });
    expect(interpretaInserimento('P1', prima, contesto)).toEqual({
      esito: 'rifiutata',
      motivo: 'consuntivo',
      codice: 'P1',
    });
  });

  it('un codice disattivato vale prima di un codice escluso', () => {
    expect(
      interpretaInserimento('X1', null, { ...contesto, turniEsclusi: [codiceTurno('X1')] }),
    ).toMatchObject({ motivo: 'codiceDisattivato' });
  });
});

describe('assegnazioneDaCodice', () => {
  it('copia nella cella orari, pausa e notturno della configurazione (L28)', () => {
    expect(assegnazioneDaCodice('N1', CONFIGURAZIONE)).toEqual({
      esito: 'trovata',
      assegnazione: { tipo: 'turno', turno: turnoDiProva('N1') },
    });
  });

  it('reperibilità senza chiamate e senza sostituzioni', () => {
    expect(assegnazioneDaCodice('R1', CONFIGURAZIONE)).toEqual({
      esito: 'trovata',
      assegnazione: {
        tipo: 'reperibilita',
        reperibilita: {
          codice: 'R1',
          inizio: '14:00',
          fine: '20:00',
          chiamate: [],
          sostituisce: null,
          copertaDa: null,
        },
      },
    });
  });

  it('codice sconosciuto', () => {
    expect(assegnazioneDaCodice('Q7', CONFIGURAZIONE)).toEqual({
      esito: 'nonTrovata',
      motivo: 'codiceInesistente',
    });
  });
});
