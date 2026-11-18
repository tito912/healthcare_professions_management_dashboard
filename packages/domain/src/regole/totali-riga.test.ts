// Totali di fine riga (PIANO 2.1 criterio 7): ore pianificate, dovute, differenza, unità di reperibilità.
import { describe, expect, it } from 'vitest';
import { festivitaReparto } from '../calendario/festivita';
import { CONTRATTO_PIENO, cella, d, m } from '../test-utili';
import { totaliRiga } from './totali-riga';

const FESTIVITA_2026 = festivitaReparto(2026, { nazionaliEscluse: [], locali: [] });

describe('totaliRiga', () => {
  it('novembre 2026, 36 ore: pianificate, dovute, differenza e unità', () => {
    const totali = totaliRiga(
      {
        contratto: CONTRATTO_PIENO,
        giorni: {
          '02': cella('M1'), // 390
          '03': cella('P1'), // 450
          '04': cella('N1'), // 540
          '07': cella('M1'), // sabato: 390
          '09': cella('R1'), // solo reperibilità 6 ore
          '10': cella('R'),
        },
      },
      { chiaveMese: m('2026-11'), festivita: FESTIVITA_2026 },
    );
    expect(totali).toEqual({
      minutiPianificati: 1770,
      minutiDovuti: 21 * 432,
      differenzaMinuti: 1770 - 21 * 432,
      minutiReperibilita: 360,
      unitaReperibilita: 0.5,
    });
  });

  it.each([
    ['2026-03', '28', 480], // notte del cambio d'ora in primavera
    ['2026-10', '24', 600], // in autunno
    ['2026-11', '30', 540], // notte a cavallo di fine mese: tutta al mese di inizio (L10)
    ['2026-12', '31', 540], // a cavallo di fine anno
  ])('N1 del %s-%s pianifica %i minuti', (mese, giorno, minuti) => {
    expect(
      totaliRiga(
        { contratto: CONTRATTO_PIENO, giorni: { [giorno]: cella('N1') } },
        { chiaveMese: m(mese), festivita: FESTIVITA_2026 },
      ).minutiPianificati,
    ).toBe(minuti);
  });

  it('il turno scoperto non è pianificato per l’assente e la malattia è neutra', () => {
    const totali = totaliRiga(
      { contratto: CONTRATTO_PIENO, giorni: { '16': cella('M1', 'MA'), '17': cella('M1') } },
      { chiaveMese: m('2026-11'), festivita: FESTIVITA_2026 },
    );
    expect(totali.minutiPianificati).toBe(390);
    expect(totali.minutiDovuti).toBe(20 * 432);
  });

  it('turno che finisce alle 00:00 e turno di 24 ore', () => {
    expect(
      totaliRiga(
        { contratto: CONTRATTO_PIENO, giorni: { '16': cella('S1'), '17': cella('G1') } },
        { chiaveMese: m('2026-11'), festivita: FESTIVITA_2026 },
      ).minutiPianificati,
    ).toBe(330 + 1440);
  });

  it('assunto a metà mese: dovute solo dai giorni di servizio', () => {
    const totali = totaliRiga(
      {
        contratto: { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-16') },
        giorni: { '16': cella('M1') },
      },
      { chiaveMese: m('2026-11'), festivita: FESTIVITA_2026 },
    );
    expect(totali).toMatchObject({
      minutiPianificati: 390,
      minutiDovuti: 11 * 432,
      differenzaMinuti: 390 - 11 * 432,
    });
  });

  it('tre fasce da 4 ore: 1 unità', () => {
    expect(
      totaliRiga(
        {
          contratto: CONTRATTO_PIENO,
          giorni: { '02': cella('R3'), '03': cella('R4'), '04': cella('R5') },
        },
        { chiaveMese: m('2026-11'), festivita: FESTIVITA_2026 },
      ).unitaReperibilita,
    ).toBe(1);
  });
});
