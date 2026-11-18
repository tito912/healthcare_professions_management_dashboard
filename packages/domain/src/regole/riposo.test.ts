// Riposo di 11 ore (PIANO 2.1, criterio 2; D8 per la chiamata con ora di inizio).
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { cella, d, m, o, reperibilitaDiProva } from '../test-utili';
import type { CellaDoc } from '../documenti';
import {
  avvisiRiposo,
  fineEffettivaPerRiposo,
  giorniDaRighe,
  periodiDiLavoro,
  type GiornoRiga,
} from './riposo';

const utc = (testo: string): number => DateTime.fromISO(`${testo}Z`, { setZone: true }).toMillis();
const g = (data: string, c: CellaDoc): GiornoRiga => ({ giorno: d(data), cella: c });
const reale = (inizio: string, fine: string) => ({
  orarioReale: { inizio: o(inizio), fine: o(fine) },
});

describe('avvisiRiposo', () => {
  it('«Riposo di 9 ore tra il 4 e il 5»: P1 il 4 (fine 22:00), M1 il 5 (inizio 07:00)', () => {
    expect(avvisiRiposo([g('2026-11-04', cella('P1')), g('2026-11-05', cella('M1'))])).toEqual([
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: '2026-11-05',
        giornoPrecedente: '2026-11-04',
        minutiRiposo: 540,
        origine: 'turno',
      },
    ]);
  });

  it.each([
    // fine reale del turno del 4, minuti di riposo fino alle 07:00 del 5, avviso?
    ['20:00', 660, false], // 11 ore esatte: nessun avviso
    ['20:01', 659, true], // un minuto in meno
    ['19:59', 661, false],
  ])('turno del 4 che finisce alle %s e M1 del 5: riposo %i, avviso %s', (fine, minuti, avviso) => {
    const esito = avvisiRiposo([
      g('2026-11-04', cella('P1', reale('14:00', fine))),
      g('2026-11-05', cella('M1')),
    ]);
    expect(esito.map((a) => a.minutiRiposo)).toEqual(avviso ? [minuti] : []);
  });

  it('a cavallo di due mesi: P1 il 30/11, M1 l’1/12', () => {
    const giorni = giorniDaRighe([
      { chiaveMese: m('2026-12'), giorni: { '01': cella('M1') } },
      { chiaveMese: m('2026-11'), giorni: { '30': cella('P1') } },
    ]);
    expect(avvisiRiposo(giorni)).toMatchObject([
      { giorno: '2026-12-01', giornoPrecedente: '2026-11-30', minutiRiposo: 540 },
    ]);
  });

  it('a cavallo dell’anno: N1 il 31/12 (fine 07:00 dell’1/1), P1 l’1/1 alle 14:00 → 7 ore', () => {
    expect(
      avvisiRiposo([g('2026-12-31', cella('N1')), g('2027-01-01', cella('P1'))]),
    ).toMatchObject([{ giorno: '2027-01-01', giornoPrecedente: '2026-12-31', minutiRiposo: 420 }]);
  });

  it('febbraio bisestile: N1 il 28/02/2028, M1 il 29 → riposo zero', () => {
    expect(
      avvisiRiposo([g('2028-02-28', cella('N1')), g('2028-02-29', cella('M1'))]),
    ).toMatchObject([{ giorno: '2028-02-29', giornoPrecedente: '2028-02-28', minutiRiposo: 0 }]);
  });

  it.each([
    // cambio d'ora: il riposo si misura in minuti reali
    ['2026-03-28', '2026-03-29', 'P1', 480], // 22:00 → 07:00 con un'ora in meno
    ['2026-10-24', '2026-10-25', 'P1', 600], // un'ora in più, ma sempre sotto le 11
  ])('P1 il %s, M1 il %s: riposo reale %i', (primo, secondo, codice, minuti) => {
    expect(avvisiRiposo([g(primo, cella(codice)), g(secondo, cella('M1'))])).toMatchObject([
      { minutiRiposo: minuti },
    ]);
  });

  it('cambio d’ora in autunno: 10 ore nominali sono 11 reali, quindi nessun avviso', () => {
    expect(
      avvisiRiposo([
        g('2026-10-24', cella('P1', reale('14:00', '21:00'))),
        g('2026-10-25', cella('M1')),
      ]),
    ).toEqual([]);
  });

  it('cambio d’ora in primavera: 12 ore nominali sono 11 reali (nessun avviso), un minuto in più sì', () => {
    expect(
      avvisiRiposo([
        g('2026-03-28', cella('P1', reale('14:00', '19:00'))),
        g('2026-03-29', cella('M1')),
      ]),
    ).toEqual([]);
    expect(
      avvisiRiposo([
        g('2026-03-28', cella('P1', reale('14:00', '19:01'))),
        g('2026-03-29', cella('M1')),
      ]),
    ).toMatchObject([{ minutiRiposo: 659 }]);
  });

  it('notte seguita dalla mattina: riposo zero', () => {
    expect(
      avvisiRiposo([g('2026-11-04', cella('N1')), g('2026-11-05', cella('M1'))]),
    ).toMatchObject([{ minutiRiposo: 0 }]);
  });

  it('turni sovrapposti contano come riposo zero', () => {
    expect(
      avvisiRiposo([
        g('2026-11-04', cella('N1', reale('22:00', '08:00'))),
        g('2026-11-05', cella('M1')),
      ]),
    ).toMatchObject([{ minutiRiposo: 0 }]);
  });

  it('M1 il 4 (fine 14:00) e N1 il 5 (inizio 22:00): 32 ore, nessun avviso', () => {
    expect(avvisiRiposo([g('2026-11-04', cella('M1')), g('2026-11-05', cella('N1'))])).toEqual([]);
  });

  it('usa l’orario reale al posto del pianificato', () => {
    expect(
      avvisiRiposo([
        g('2026-11-04', cella('P1', reale('12:00', '18:00'))),
        g('2026-11-05', cella('M1')),
      ]),
    ).toEqual([]);
  });

  it('non conta i turni non svolti (scoperti o coperti da altri) né le assenze', () => {
    expect(
      avvisiRiposo([g('2026-11-04', cella('P1', 'MA')), g('2026-11-05', cella('M1'))]),
    ).toEqual([]);
    expect(avvisiRiposo([g('2026-11-04', cella('R')), g('2026-11-05', cella('M1'))])).toEqual([]);
  });

  it('una reperibilità senza chiamata non interrompe il riposo', () => {
    expect(
      avvisiRiposo([g('2026-11-04', cella('M1', 'R1')), g('2026-11-05', cella('M1'))]),
    ).toEqual([]);
  });

  it('accetta l’elenco in qualsiasi ordine', () => {
    expect(
      avvisiRiposo([g('2026-11-05', cella('M1')), g('2026-11-04', cella('P1'))]),
    ).toMatchObject([{ giorno: '2026-11-05', giornoPrecedente: '2026-11-04' }]);
  });

  it('più avvisi nella stessa sequenza', () => {
    expect(
      avvisiRiposo([
        g('2026-11-04', cella('P1')),
        g('2026-11-05', cella('M1')),
        g('2026-11-06', cella('N1')),
        g('2026-11-07', cella('P1')),
      ]).map((a) => [a.giornoPrecedente, a.giorno, a.minutiRiposo]),
    ).toEqual([
      ['2026-11-04', '2026-11-05', 540],
      ['2026-11-06', '2026-11-07', 420],
    ]);
  });
});

describe('chiamata in reperibilità con ora di inizio (D8)', () => {
  const chiamata = (oraInizio: string | null, durataMinuti: number) => ({
    oraInizio: oraInizio === null ? null : o(oraInizio),
    durataMinuti,
  });

  it.each([
    // R1 14:00-20:00 il 4 con chiamata; M1 il 5 alle 07:00
    ['19:00', 60, []], // fine 20:00: 11 ore esatte
    ['19:00', 61, [659]], // fine 20:01
    [null, 300, []], // senza ora di inizio la chiamata non conta per il riposo
  ])('chiamata alle %s per %i minuti → avvisi %o', (ora, durata, attesi) => {
    const esito = avvisiRiposo([
      g(
        '2026-11-04',
        cella('M1', 'R1', { chiamata: { codice: 'R1', chiamata: chiamata(ora, durata) } }),
      ),
      g('2026-11-05', cella('M1')),
    ]);
    expect(esito.map((a) => a.minutiRiposo)).toEqual(attesi);
    if (attesi.length > 0) {
      expect(esito[0]).toMatchObject({ giornoPrecedente: '2026-11-04', origine: 'chiamata' });
    }
  });

  it('notte in reperibilità: chiamata alle 05:00 del 5 per 90 minuti, P1 il 5 alle 14:00 → 7 ore e 30', () => {
    expect(
      avvisiRiposo([
        g(
          '2026-11-04',
          cella('R2', { chiamata: { codice: 'R2', chiamata: chiamata('05:00', 90) } }),
        ),
        g('2026-11-05', cella('P1')),
      ]),
    ).toEqual([
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: '2026-11-05',
        giornoPrecedente: '2026-11-04',
        minutiRiposo: 450,
        origine: 'chiamata',
      },
    ]);
  });

  it('fineEffettivaPerRiposo: fine dell’intervento in istante reale, o null senza ora', () => {
    const r2 = reperibilitaDiProva('R2');
    expect(fineEffettivaPerRiposo(d('2026-11-04'), r2, chiamata('05:00', 90))).toBe(
      utc('2026-11-05T05:30'),
    );
    expect(fineEffettivaPerRiposo(d('2026-11-04'), r2, chiamata('21:00', 90))).toBe(
      utc('2026-11-04T21:30'),
    );
    // attraversa il cambio d'ora: 01:30 + 60 minuti reali = 03:30 dell'ora legale
    expect(fineEffettivaPerRiposo(d('2026-03-28'), r2, chiamata('01:30', 60))).toBe(
      utc('2026-03-29T01:30'),
    );
    expect(fineEffettivaPerRiposo(d('2026-11-04'), r2, chiamata(null, 90))).toBeNull();
  });
});

describe('periodiDiLavoro e giorniDaRighe', () => {
  it('turni svolti e chiamate con ora, in ordine di inizio', () => {
    const periodi = periodiDiLavoro([
      g('2026-11-05', cella('M1')),
      g(
        '2026-11-04',
        cella('R2', {
          chiamata: { codice: 'R2', chiamata: { oraInizio: o('23:00'), durataMinuti: 30 } },
        }),
      ),
      g('2026-11-04', cella('M1')),
    ]);
    expect(periodi.map((p) => [p.giorno, p.origine])).toEqual([
      ['2026-11-04', 'turno'],
      ['2026-11-04', 'chiamata'],
      ['2026-11-05', 'turno'],
    ]);
    expect(periodi[1]).toMatchObject({
      inizioMs: utc('2026-11-04T22:00'),
      fineMs: utc('2026-11-04T22:30'),
    });
  });

  it('giorniDaRighe scarta le chiavi che il mese non ha', () => {
    expect(
      giorniDaRighe([
        { chiaveMese: m('2026-11'), giorni: { '31': cella('M1'), '30': cella('P1') } },
      ]).map((x) => x.giorno),
    ).toEqual(['2026-11-30']);
  });
});
