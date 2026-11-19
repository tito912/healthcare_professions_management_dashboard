import { chiaveMese } from '@turni/domain';
import {
  configurazioneVista,
  giorniVisibili,
  limitaSettimana,
  passoSettimane,
  settimanaDelGiorno,
  settimaneDelMese,
  type Vista,
} from './vista';

const NOVEMBRE = chiaveMese('2026-11');

describe('Misure delle viste (UX §8.1)', () => {
  // Larghezza per i giorni = finestra − 408 px (menu ridotto, margini e barra di scorrimento).
  it.each<[Vista, number, number, number]>([
    ['mese', 1280, 31, 28],
    ['mese', 1366, 31, 30],
    ['mese', 1920, 31, 48],
    ['settimane2', 1280, 14, 62],
    ['settimane2', 1366, 14, 68],
    ['settimane2', 1920, 14, 108],
    ['settimana', 1280, 7, 124],
    ['settimana', 1366, 7, 136],
    ['settimana', 1920, 7, 216],
  ])('%s a %i px con %i giorni: giorno largo %i px', (vista, finestra, giorni, atteso) => {
    const configurazione = configurazioneVista(vista, finestra - 408, giorni);
    expect(configurazione.larghezzaGiorno).toBe(atteso);
    expect(configurazione.scorrimentoOrizzontale).toBe(false);
  });

  it('altezze di riga e del chip per vista', () => {
    expect(configurazioneVista('mese', 958, 31)).toMatchObject({
      altezzaRiga: 40,
      altezzaChip: 24,
    });
    expect(configurazioneVista('settimane2', 958, 14)).toMatchObject({
      altezzaRiga: 56,
      altezzaChip: 26,
    });
    expect(configurazioneVista('settimana', 958, 7)).toMatchObject({
      altezzaRiga: 64,
      altezzaChip: 34,
      orarioSottoCodice: true,
    });
  });

  it('sotto il minimo la griglia scorre in orizzontale e il giorno resta al minimo', () => {
    const stretta = configurazioneVista('mese', 600, 31);
    expect(stretta.larghezzaGiorno).toBe(28);
    expect(stretta.scorrimentoOrizzontale).toBe(true);
    expect(configurazioneVista('settimana', 500, 7).larghezzaGiorno).toBe(112);
  });

  it('resa delle reperibilità: ore nel mese (10 px a 1366, 11 con i minuti a 1920), righe nelle settimane', () => {
    expect(configurazioneVista('mese', 958, 31)).toMatchObject({
      striscia: 'ore',
      fontStriscia: 10,
      mostraMinutiStriscia: false,
      angolo: 5,
    });
    expect(configurazioneVista('mese', 1512, 31)).toMatchObject({
      striscia: 'ore',
      fontStriscia: 11,
      mostraMinutiStriscia: true,
      angolo: 6,
    });
    expect(configurazioneVista('settimane2', 958, 14).striscia).toBe('righe');
    expect(configurazioneVista('settimana', 958, 7).striscia).toBe('righeComplete');
  });
});

describe('Settimane del mese', () => {
  it('novembre 2026 inizia di domenica: la prima settimana ha un solo giorno', () => {
    const settimane = settimaneDelMese(NOVEMBRE);
    expect(settimane.map((s) => [s.da, s.a, s.giorni.length])).toEqual([
      ['2026-11-01', '2026-11-01', 1],
      ['2026-11-02', '2026-11-08', 7],
      ['2026-11-09', '2026-11-15', 7],
      ['2026-11-16', '2026-11-22', 7],
      ['2026-11-23', '2026-11-29', 7],
      ['2026-11-30', '2026-11-30', 1],
    ]);
  });

  it('i giorni visibili: mese intero, una o due settimane, ferme ai bordi', () => {
    expect(giorniVisibili(NOVEMBRE, 'mese', 0)).toHaveLength(30);
    expect(giorniVisibili(NOVEMBRE, 'settimana', 2)).toEqual([
      '09',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ]);
    expect(giorniVisibili(NOVEMBRE, 'settimane2', 1)).toHaveLength(14);
    // Oltre l'ultima settimana si ferma: con due settimane l'ultima coppia è la quarta e la quinta.
    expect(giorniVisibili(NOVEMBRE, 'settimane2', 99)[0]).toBe('23');
    expect(giorniVisibili(NOVEMBRE, 'settimana', 99)).toEqual(['30']);
    expect(giorniVisibili(NOVEMBRE, 'settimana', -3)).toEqual(['01']);
  });

  it('passo e limiti della navigazione tra settimane', () => {
    expect(passoSettimane('settimana')).toBe(1);
    expect(passoSettimane('settimane2')).toBe(2);
    expect(limitaSettimana(NOVEMBRE, 'settimana', 6)).toBe(5);
    expect(limitaSettimana(NOVEMBRE, 'settimane2', 6)).toBe(4);
    expect(settimanaDelGiorno(NOVEMBRE, '10')).toBe(2);
    expect(settimanaDelGiorno(NOVEMBRE, '30')).toBe(5);
  });
});
