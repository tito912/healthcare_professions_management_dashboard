import { describe, expect, it } from 'vitest';
import { dataISO, oraLocale } from '../codici';
import { durataConPausa, durataEffettiva, durataNominale } from './durata';
import { TURNI_MODELLO } from './modello-iniziale';
import { eNotturno } from './notturno';
import { pausaProposta } from './pausa';
import { validaTurno } from './validazione';

const ora = oraLocale;

describe('durata', () => {
  it.each([
    ['07:00', '14:00', 420],
    ['14:00', '22:00', 480],
    ['22:00', '07:00', 540],
    ['22:00', '00:00', 120],
    ['08:00', '08:00', 1440],
    ['00:00', '00:00', 1440],
    ['00:00', '08:00', 480],
  ])('%s-%s dura %i minuti', (inizio, fine, atteso) => {
    expect(durataNominale(ora(inizio), ora(fine))).toBe(atteso);
  });

  it('sottrae la pausa e non scende sotto zero', () => {
    expect(durataConPausa(ora('07:00'), ora('14:00'), 30)).toBe(390);
    expect(durataConPausa(ora('22:00'), ora('07:00'), 0)).toBe(540);
    expect(durataConPausa(ora('07:00'), ora('08:00'), 120)).toBe(0);
  });

  it('nella notte del cambio d’ora la durata effettiva cambia', () => {
    // 2026-03-29: alle 02:00 le lancette vanno avanti (23 ore); 2026-10-25: tornano indietro (25 ore).
    expect(durataEffettiva(dataISO('2026-03-28'), ora('22:00'), ora('07:00'), 0)).toBe(480);
    expect(durataEffettiva(dataISO('2026-10-24'), ora('22:00'), ora('07:00'), 0)).toBe(600);
    expect(durataEffettiva(dataISO('2026-11-18'), ora('22:00'), ora('07:00'), 0)).toBe(540);
    expect(durataEffettiva(dataISO('2026-11-18'), ora('07:00'), ora('14:00'), 30)).toBe(390);
  });
});

describe('notturno (L8)', () => {
  it.each([
    ['22:00', '00:00', false],
    ['22:00', '07:00', true],
    ['07:00', '14:00', false],
    ['08:00', '08:00', true],
    ['00:00', '00:00', true],
    ['00:00', '08:00', false],
    ['23:00', '00:00', false],
    ['12:00', '00:00', false],
  ])('%s-%s: notturno = %s', (inizio, fine, atteso) => {
    expect(eNotturno(ora(inizio), ora(fine))).toBe(atteso);
  });
});

describe('pausa proposta (D5)', () => {
  it('30 per i diurni, 0 per i notturni e per le reperibilità', () => {
    expect(pausaProposta('turno', ora('07:00'), ora('14:00'))).toBe(30);
    expect(pausaProposta('turno', ora('22:00'), ora('07:00'))).toBe(0);
    expect(pausaProposta('reperibilita', ora('14:00'), ora('20:00'))).toBe(0);
  });
});

describe('modello iniziale (U11)', () => {
  it('ha M1, P1 e N1 con gli orari di UX §7.4', () => {
    expect(TURNI_MODELLO.map((t) => [t.codice, t.nome, t.inizio, t.fine, t.pausaMinuti])).toEqual([
      ['M1', 'Mattina', '07:00', '14:00', 30],
      ['P1', 'Pomeriggio', '14:00', '22:00', 30],
      ['N1', 'Notte', '22:00', '07:00', 0],
    ]);
    expect(TURNI_MODELLO.map((t) => t.notturno)).toEqual([false, false, true]);
    expect(TURNI_MODELLO.map((t) => t.colore)).toEqual(['arancio', 'verde', 'ardesia']);
  });
});

describe('validaTurno', () => {
  const buono = {
    tipo: 'turno',
    nome: 'Mattina',
    colore: 'arancio',
    inizio: '07:00',
    fine: '14:00',
    pausaMinuti: 30,
  } as const;

  it('accetta un turno valido e una reperibilità senza colore', () => {
    expect(validaTurno(buono)).toEqual({});
    expect(validaTurno({ ...buono, tipo: 'reperibilita', colore: null, pausaMinuti: 0 })).toEqual(
      {},
    );
  });

  it('segnala i campi sbagliati', () => {
    expect(validaTurno({ ...buono, nome: '  ' }).nome).toBe('nomeVuoto');
    expect(validaTurno({ ...buono, nome: 'x'.repeat(41) }).nome).toBe('nomeTroppoLungo');
    expect(validaTurno({ ...buono, colore: null }).colore).toBe('coloreMancante');
    expect(validaTurno({ ...buono, colore: 'fucsia' }).colore).toBe('coloreMancante');
    expect(validaTurno({ ...buono, inizio: '25:00' }).inizio).toBe('oraNonValida');
    expect(validaTurno({ ...buono, fine: '' }).fine).toBe('oraNonValida');
    expect(validaTurno({ ...buono, pausaMinuti: 1.5 }).pausa).toBe('pausaNonValida');
    expect(validaTurno({ ...buono, pausaMinuti: Number.NaN }).pausa).toBe('pausaNonValida');
    expect(validaTurno({ ...buono, pausaMinuti: 241 }).pausa).toBe('pausaTroppoLunga');
    expect(validaTurno({ ...buono, pausaMinuti: 420 }).pausa).toBe('pausaTroppoLunga');
    expect(
      validaTurno({ ...buono, tipo: 'reperibilita', colore: null, pausaMinuti: 15 }).pausa,
    ).toBe('pausaNonValida');
  });
});
