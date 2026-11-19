// Variazioni di orario (PIANO 3.1a criterio 1): differenza in minuti reali tra orario reale e previsto.
// La pausa è la stessa sui due orari (L37), quindi la differenza di ore lavorate è la differenza di durata reale.
import { describe, expect, it } from 'vitest';
import type { OrarioReale } from '../documenti';
import { cella, d, m, o, turnoDiProva } from '../test-utili';
import { orarioVariato, variazioneOrario, variazioniMese } from './variazione';

const orario = (inizio: string, fine: string): OrarioReale => ({
  inizio: o(inizio),
  fine: o(fine),
});

describe('variazioneOrario', () => {
  it.each([
    // [descrizione, giorno, previsto, reale, minuti attesi]
    ['uscita 30 minuti dopo', '2026-11-05', ['07:00', '14:00'], ['07:00', '14:30'], 30],
    ['ingresso 15 minuti prima', '2026-11-05', ['07:00', '14:00'], ['06:45', '14:00'], 15],
    ['uscita anticipata di un’ora', '2026-11-05', ['07:00', '14:00'], ['07:00', '13:00'], -60],
    [
      'ingresso posticipato di 20 minuti',
      '2026-11-05',
      ['14:00', '22:00'],
      ['14:20', '22:00'],
      -20,
    ],
    [
      'spostato di mezz’ora, stessa durata',
      '2026-11-05',
      ['07:00', '14:00'],
      ['07:30', '14:30'],
      0,
    ],
    ['identico al previsto', '2026-11-05', ['07:00', '14:00'], ['07:00', '14:00'], 0],
    [
      'pomeriggio che sfora la mezzanotte: 14:00-00:30 contro 14:00-22:00',
      '2026-11-05',
      ['14:00', '22:00'],
      ['14:00', '00:30'],
      150,
    ],
    ['notte che finisce più tardi', '2026-11-04', ['22:00', '07:00'], ['22:00', '07:45'], 45],
    ['notte iniziata più tardi', '2026-11-04', ['22:00', '07:00'], ['22:30', '07:00'], -30],
    // 24/10/2026: alle 03:00 del 25 le lancette tornano alle 02:00. 22:00-07:30 = 10 h 30 reali, 22:00-07:00 = 10 h.
    ['notte del cambio d’ora d’autunno', '2026-10-24', ['22:00', '07:00'], ['22:00', '07:30'], 30],
    // Previsto 18:00-00:00 = 360 minuti; reale 18:00 CEST (16:00 UTC) - 03:00 CET (02:00 UTC) = 600: +240, non +180.
    [
      'autunno: il reale attraversa il cambio d’ora, il previsto no',
      '2026-10-24',
      ['18:00', '00:00'],
      ['18:00', '03:00'],
      240,
    ],
    // 28/03/2026: alle 02:00 del 29 le lancette vanno alle 03:00. Reale 18:00 CET (17:00 UTC) - 03:00 CEST (01:00 UTC) = 480: +120.
    [
      'primavera: il reale attraversa il cambio d’ora, il previsto no',
      '2026-03-28',
      ['18:00', '00:00'],
      ['18:00', '03:00'],
      120,
    ],
  ] as const)('%s', (_descrizione, giorno, previsto, reale, attesi) => {
    expect(
      variazioneOrario(d(giorno), orario(previsto[0], previsto[1]), orario(reale[0], reale[1])),
    ).toBe(attesi);
  });
});

describe('orarioVariato', () => {
  const m1 = turnoDiProva('M1');
  it.each([
    ['senza orario reale', null, false],
    ['orario reale uguale al previsto', orario('07:00', '14:00'), false],
    ['uscita diversa', orario('07:00', '14:30'), true],
    ['ingresso diverso', orario('06:45', '14:00'), true],
    ['spostato con la stessa durata', orario('07:30', '14:30'), true],
  ] as const)('%s', (_descrizione, reale, atteso) => {
    expect(orarioVariato(m1, reale)).toBe(atteso);
  });
});

describe('variazioniMese', () => {
  it('conta le celle con orario reale diverso dal previsto e somma le differenze con il segno', () => {
    const esito = variazioniMese(m('2026-11'), {
      '02': cella('M1', { orarioReale: orario('07:00', '14:30') }), // +30
      '03': cella('P1', { orarioReale: orario('14:00', '21:00') }), // -60
      '04': cella('M1', { orarioReale: orario('07:00', '14:00') }), // uguale: non è una variazione
      '05': cella('M1', { orarioReale: orario('07:30', '14:30') }), // spostato: variazione di 0 minuti
      '06': cella('M1'),
      '09': cella('R'),
    });
    expect(esito).toEqual({ variazioni: 3, minutiVariazioni: -30 });
  });

  it('la notte del cambio d’ora conta in minuti reali', () => {
    expect(
      variazioniMese(m('2026-10'), {
        '24': cella('N1', { orarioReale: orario('22:00', '07:30') }),
      }),
    ).toEqual({ variazioni: 1, minutiVariazioni: 30 });
  });

  it('non conta gli orari reali su turni non svolti (dati non validi per validaRiga)', () => {
    expect(
      variazioniMese(m('2026-11'), {
        '02': cella('M1', 'MA', { orarioReale: orario('07:00', '15:00') }),
      }),
    ).toEqual({ variazioni: 0, minutiVariazioni: 0 });
  });

  it('mese vuoto: nessuna variazione', () => {
    expect(variazioniMese(m('2026-11'), {})).toEqual({ variazioni: 0, minutiVariazioni: 0 });
  });
});
