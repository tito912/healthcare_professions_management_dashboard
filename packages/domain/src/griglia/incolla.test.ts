// Incolla di un intervallo (UX §9.4): celle applicate, saltate con il motivo, scartate fuori dal mese.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { CONFIGURAZIONE, CONTRATTO_PIENO, cella, d, m, o } from '../test-utili';
import { incollaIntervallo, type RigaDestinazione } from './incolla';

const rigaA: RigaDestinazione = {
  dipendenteId: 'a',
  turniEsclusi: [],
  contratto: CONTRATTO_PIENO,
  giorni: { '02': cella('P1', 'R3') },
};
const rigaB: RigaDestinazione = {
  dipendenteId: 'b',
  turniEsclusi: [codiceTurno('N1')],
  contratto: CONTRATTO_PIENO,
  giorni: { '03': cella('M1', { orarioReale: { inizio: o('07:00'), fine: o('15:00') } }) },
};
const rigaC: RigaDestinazione = {
  dipendenteId: 'c',
  turniEsclusi: [],
  contratto: { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-04') },
  giorni: {},
};

describe('incollaIntervallo', () => {
  it('blocco 2 × 3 su due righe: una cella saltata per consuntivo, una per turno escluso', () => {
    const esito = incollaIntervallo({
      chiaveMese: m('2026-11'),
      giornoIniziale: '02',
      blocco: [
        ['M1', 'N1', 'R1 R2'],
        ['MA', '', 'N1'],
      ],
      righe: [rigaA, rigaB],
      configurazione: CONFIGURAZIONE,
    });
    expect(esito).toEqual({
      applicate: [
        { dipendenteId: 'a', giorno: '02', cella: cella('M1') }, // sostituisce P1 e R3: incolla = contenuto copiato
        { dipendenteId: 'a', giorno: '03', cella: cella('N1') },
        { dipendenteId: 'a', giorno: '04', cella: cella('R1', 'R2') },
        { dipendenteId: 'b', giorno: '02', cella: cella('MA') },
      ],
      saltate: [
        { dipendenteId: 'b', giorno: '03', motivo: 'consuntivo', codice: null },
        { dipendenteId: 'b', giorno: '04', motivo: 'turnoEscluso', codice: 'N1' },
      ],
      scartate: 0,
    });
  });

  it('scarta ciò che esce dal mese (colonne) o dall’elenco delle righe', () => {
    const esito = incollaIntervallo({
      chiaveMese: m('2026-11'),
      giornoIniziale: '29',
      blocco: [
        ['M1', 'M1', 'M1'],
        ['P1', 'P1', 'P1'],
      ],
      righe: [rigaC],
      configurazione: CONFIGURAZIONE,
    });
    expect(esito.applicate.map((a) => a.giorno)).toEqual(['29', '30']);
    expect(esito.scartate).toBe(4);
  });

  it('fuori servizio: saltata prima dell’assunzione, applicata dopo', () => {
    const esito = incollaIntervallo({
      chiaveMese: m('2026-11'),
      giornoIniziale: '03',
      blocco: [['M1', 'M1']],
      righe: [rigaC],
      configurazione: CONFIGURAZIONE,
    });
    expect(esito.saltate).toEqual([
      { dipendenteId: 'c', giorno: '03', motivo: 'fuoriServizio', codice: 'M1' },
    ]);
    expect(esito.applicate).toEqual([{ dipendenteId: 'c', giorno: '04', cella: cella('M1') }]);
  });

  it.each([
    ['M1 MA', cella('M1', 'MA')], // turno scoperto
    ['ma  m1', cella('M1', 'MA')], // ordine e maiuscole indifferenti
    ['R r1', cella('R', 'R1')],
    ['', null], // cella vuota: svuota la destinazione
  ])('testo «%s»', (testo, attesa) => {
    const esito = incollaIntervallo({
      chiaveMese: m('2026-11'),
      giornoIniziale: '02',
      blocco: [[testo]],
      righe: [rigaA],
      configurazione: CONFIGURAZIONE,
    });
    expect(esito.applicate).toEqual([
      { dipendenteId: 'a', giorno: '02', cella: attesa ?? cella() },
    ]);
  });

  it.each([
    ['X9', 'codiceInesistente', 'X9'],
    ['X1', 'codiceDisattivato', 'X1'],
    ['M1 P1', 'testoNonValido', null],
    ['MA F', 'testoNonValido', null],
    ['R1 R2 R3', 'massimoReperibilita', 'R3'],
    ['R1 R1', 'reperibilitaGiaPresente', 'R1'],
  ])('testo «%s» → saltata: %s', (testo, motivo, codice) => {
    const esito = incollaIntervallo({
      chiaveMese: m('2026-11'),
      giornoIniziale: '05',
      blocco: [[testo]],
      righe: [rigaA],
      configurazione: CONFIGURAZIONE,
    });
    expect(esito.saltate).toEqual([{ dipendenteId: 'a', giorno: '05', motivo, codice }]);
    expect(esito.applicate).toEqual([]);
  });

  it('blocco vuoto: nulla', () => {
    expect(
      incollaIntervallo({
        chiaveMese: m('2026-11'),
        giornoIniziale: '05',
        blocco: [],
        righe: [rigaA],
        configurazione: CONFIGURAZIONE,
      }),
    ).toEqual({ applicate: [], saltate: [], scartate: 0 });
  });
});
