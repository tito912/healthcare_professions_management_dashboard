// Tempo reale di un turno (PIANO 2.1, criterio 1): giorno, inizio e fine a Europe/Rome; fine <= inizio = giorno dopo.
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { d, o } from '../test-utili';
import { durataEffettiva, durataLavorata, durataReale, intervalloReale } from './durata';

/** Millisecondi di un istante scritto in UTC ('AAAA-MM-GGTHH:mm'). */
const utc = (testo: string): number => DateTime.fromISO(`${testo}Z`, { setZone: true }).toMillis();

describe('intervalloReale', () => {
  it.each([
    // giorno, inizio, fine, inizio UTC, fine UTC
    ['2026-11-18', '07:00', '14:00', '2026-11-18T06:00', '2026-11-18T13:00'],
    ['2026-11-30', '22:00', '07:00', '2026-11-30T21:00', '2026-12-01T06:00'], // notte a cavallo di fine mese
    ['2026-12-31', '22:00', '07:00', '2026-12-31T21:00', '2027-01-01T06:00'], // notte a cavallo di fine anno
    ['2026-11-18', '18:00', '00:00', '2026-11-18T17:00', '2026-11-18T23:00'], // finisce alle 00:00 del giorno dopo
    ['2026-11-18', '08:00', '08:00', '2026-11-18T07:00', '2026-11-19T07:00'], // 24 ore
    ['2026-07-01', '07:00', '14:00', '2026-07-01T05:00', '2026-07-01T12:00'], // ora legale
    ['2026-03-28', '22:00', '06:00', '2026-03-28T21:00', '2026-03-29T04:00'], // le lancette vanno avanti
    ['2026-10-24', '22:00', '06:00', '2026-10-24T20:00', '2026-10-25T05:00'], // le lancette tornano indietro
    ['2028-02-28', '22:00', '07:00', '2028-02-28T21:00', '2028-02-29T06:00'], // bisestile
    ['2028-02-29', '22:00', '07:00', '2028-02-29T21:00', '2028-03-01T06:00'],
    ['2026-02-28', '22:00', '07:00', '2026-02-28T21:00', '2026-03-01T06:00'],
  ])('%s %s-%s', (giorno, inizio, fine, inizioUtc, fineUtc) => {
    expect(intervalloReale(d(giorno), o(inizio), o(fine))).toEqual({
      inizioMs: utc(inizioUtc),
      fineMs: utc(fineUtc),
    });
  });
});

describe('durataReale e durataLavorata', () => {
  it.each([
    // giorno di inizio, inizio, fine, pausa, durata reale, durata lavorata
    ['2026-11-18', '07:00', '14:00', 30, 420, 390],
    ['2026-11-18', '14:00', '22:00', 30, 480, 450],
    ['2026-11-18', '22:00', '07:00', 0, 540, 540],
    ['2026-11-18', '18:00', '00:00', 30, 360, 330],
    ['2026-11-18', '08:00', '08:00', 0, 1440, 1440],
    // termina il 29/03/2026: un'ora in meno (prompt: 22:00-06:00 = 7 ore)
    ['2026-03-28', '22:00', '06:00', 0, 420, 420],
    ['2026-03-28', '22:00', '07:00', 0, 480, 480],
    ['2026-03-28', '08:00', '08:00', 0, 1380, 1380],
    ['2026-03-28', '18:00', '00:00', 30, 360, 330], // finisce prima delle 02:00: nessun effetto
    // termina il 25/10/2026: un'ora in più (prompt: 22:00-06:00 = 9 ore)
    ['2026-10-24', '22:00', '06:00', 0, 540, 540],
    ['2026-10-24', '22:00', '07:00', 0, 600, 600],
    ['2026-10-24', '08:00', '08:00', 0, 1500, 1500],
    // il giorno dopo il cambio d'ora tutto torna normale
    ['2026-03-29', '22:00', '06:00', 0, 480, 480],
    ['2026-10-25', '22:00', '06:00', 0, 480, 480],
    // notte a cavallo di fine mese, fine anno, febbraio
    ['2026-11-30', '22:00', '07:00', 0, 540, 540],
    ['2026-12-31', '22:00', '07:00', 0, 540, 540],
    ['2028-02-28', '22:00', '07:00', 0, 540, 540],
    ['2028-02-29', '22:00', '07:00', 0, 540, 540],
    // pausa più lunga del turno: mai negativa
    ['2026-11-18', '07:00', '08:00', 120, 60, 0],
  ])(
    '%s %s-%s (pausa %i): reale %i, lavorata %i',
    (giorno, inizio, fine, pausa, reale, lavorata) => {
      expect(durataReale(d(giorno), o(inizio), o(fine))).toBe(reale);
      expect(durataLavorata(d(giorno), o(inizio), o(fine), pausa)).toBe(lavorata);
      expect(durataEffettiva(d(giorno), o(inizio), o(fine), pausa)).toBe(lavorata);
    },
  );

  it('un orario che non esiste (02:30 del 29/03/2026) si sposta avanti di un’ora, come fa Luxon', () => {
    expect(intervalloReale(d('2026-03-29'), o('02:30'), o('06:00')).inizioMs).toBe(
      utc('2026-03-29T01:30'),
    );
    expect(durataReale(d('2026-03-29'), o('02:30'), o('06:00'))).toBe(150);
  });

  it('un orario ripetuto (02:30 del 25/10/2026) vale la seconda volta, nell’ora solare', () => {
    expect(intervalloReale(d('2026-10-25'), o('02:30'), o('06:00')).inizioMs).toBe(
      utc('2026-10-25T01:30'),
    );
  });
});
