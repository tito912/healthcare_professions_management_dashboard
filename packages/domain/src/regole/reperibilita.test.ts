// Reperibilità (PIANO 2.1, criterio 3): massimo 2 al giorno, unità da 12 ore nel mese, sovrapposizione col turno.
import { describe, expect, it } from 'vitest';
import type { CellaDoc, RigaDoc } from '../documenti';
import { CHIAVI_GIORNO } from '../tipi';
import { cella, d, m, o, reperibilitaDiProva } from '../test-utili';
import {
  avvisiSovrapposizione,
  avvisoReperibilitaMese,
  minutiReperibilitaMese,
  reperibilitaSvolta,
  superaMassimoReperibilita,
  unitaReperibilita,
} from './reperibilita';
import type { GiornoRiga } from './riposo';

const g = (data: string, c: CellaDoc): GiornoRiga => ({ giorno: d(data), cella: c });

/** Mese di novembre 2026 con la stessa cella nei primi `n` giorni. */
function ripeti(n: number, c: CellaDoc): RigaDoc['giorni'] {
  const giorni: RigaDoc['giorni'] = {};
  for (const chiave of CHIAVI_GIORNO.slice(0, n)) {
    giorni[chiave] = c;
  }
  return giorni;
}

describe('massimo 2 reperibilità al giorno (blocco)', () => {
  it.each([
    [cella(), false],
    [cella('R1'), false],
    [cella('R1', 'R2'), false],
    [
      {
        ...cella('R1', 'R2'),
        reperibilita: [...cella('R1', 'R2').reperibilita, reperibilitaDiProva('R3')],
      },
      true,
    ],
  ])('%#', (c, atteso) => {
    expect(superaMassimoReperibilita(c)).toBe(atteso);
  });
});

describe('unità di reperibilità nel mese', () => {
  it('tre fasce da 4 ore fanno 1 unità', () => {
    const minuti = minutiReperibilitaMese(m('2026-11'), {
      '02': cella('R3'),
      '03': cella('R4'),
      '04': cella('R5'),
    });
    expect(minuti).toBe(720);
    expect(unitaReperibilita(minuti)).toBe(1);
  });

  it('due fasce da 4 ore nello stesso giorno più una da 4 il giorno dopo: sempre 1 unità', () => {
    expect(
      unitaReperibilita(
        minutiReperibilitaMese(m('2026-11'), { '02': cella('R3', 'R5'), '03': cella('R4') }),
      ),
    ).toBe(1);
  });

  it.each([
    ['2026-03', '28', 660], // la notte del 28/03/2026 dura un'ora in meno
    ['2026-10', '24', 780], // la notte del 24/10/2026 un'ora in più
    ['2026-11', '30', 720], // notte a cavallo di fine mese: tutta al mese in cui inizia (L10)
    ['2026-12', '31', 720], // a cavallo di fine anno
  ])('R2 (20:00-08:00) del %s-%s dura %i minuti reali', (mese, giorno, minuti) => {
    expect(minutiReperibilitaMese(m(mese), { [giorno]: cella('R2') })).toBe(minuti);
  });

  it('non conta le reperibilità coperte da un collega né quelle in un giorno di assenza neutra', () => {
    const coperta: CellaDoc = {
      ...cella(),
      reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'b' })],
    };
    expect(
      minutiReperibilitaMese(m('2026-11'), {
        '02': coperta,
        '03': cella('MA', 'R2'),
        '04': cella('R', 'R2'), // reperibilità nel giorno di riposo: conta
        '05': { ...cella(), reperibilita: [reperibilitaDiProva('R1', [], { sostituisce: 'c' })] }, // sostituisce un collega: conta
      }),
    ).toBe(720 + 360);
    expect(reperibilitaSvolta(cella('MA', 'R2'), reperibilitaDiProva('R2'))).toBe(false);
    expect(reperibilitaSvolta(cella('F', 'R2'), reperibilitaDiProva('R2'))).toBe(false);
    expect(reperibilitaSvolta(cella('S', 'R2'), reperibilitaDiProva('R2'))).toBe(true);
  });

  it.each([
    [7, 'R2', null], // 7 unità: al limite, nessun avviso
    [8, 'R2', 8 * 720], // oltre 7
    [14, 'R1', null], // 14 × 6 ore = 7 unità
    [15, 'R1', 15 * 360], // 7,5 unità
  ])('%i volte %s → avviso con %s minuti', (volte, codice, minutiAvviso) => {
    const minuti = minutiReperibilitaMese(m('2026-11'), ripeti(volte, cella(codice)));
    const avviso = avvisoReperibilitaMese(minuti);
    if (minutiAvviso === null) {
      expect(avviso).toBeNull();
    } else {
      expect(avviso).toEqual({
        livello: 'avviso',
        codice: 'reperibilitaOltreLimite',
        giorno: null,
        minutiReperibilita: minutiAvviso,
        unita: minutiAvviso / 720,
        limiteUnita: 7,
      });
    }
  });
});

describe('reperibilità sovrapposta al turno principale', () => {
  it('M1 07:00-14:00 e R3 08:00-12:00 nello stesso giorno', () => {
    expect(avvisiSovrapposizione([g('2026-11-10', cella('M1', 'R3'))])).toEqual([
      {
        livello: 'avviso',
        codice: 'reperibilitaSovrapposta',
        giorno: '2026-11-10',
        codiceReperibilita: 'R3',
        codiceTurno: 'M1',
        giornoTurno: '2026-11-10',
      },
    ]);
  });

  it('turno e reperibilità che si toccano non si sovrappongono (M1 fino alle 14:00, R1 dalle 14:00)', () => {
    expect(avvisiSovrapposizione([g('2026-11-10', cella('M1', 'R1'))])).toEqual([]);
  });

  it('R2 del 10 (fino alle 08:00 dell’11) e M1 dell’11: sovrapposizione col turno del giorno dopo', () => {
    expect(
      avvisiSovrapposizione([g('2026-11-10', cella('R2')), g('2026-11-11', cella('M1'))]),
    ).toMatchObject([{ giorno: '2026-11-10', codiceTurno: 'M1', giornoTurno: '2026-11-11' }]);
  });

  it('N1 del 9 (fino alle 07:00 del 10) e R3 del 10 alle 08:00: nessuna sovrapposizione', () => {
    expect(
      avvisiSovrapposizione([g('2026-11-09', cella('N1')), g('2026-11-10', cella('R3'))]),
    ).toEqual([]);
  });

  it('N1 del 30/11 e R2 dell’1/12 alle 20:00: no; N1 del 30/11 e R3 dell’1/12 con N1 prolungata alle 09:00: sì', () => {
    expect(
      avvisiSovrapposizione([g('2026-11-30', cella('N1')), g('2026-12-01', cella('R2'))]),
    ).toEqual([]);
    expect(
      avvisiSovrapposizione([
        g('2026-11-30', cella('N1', { orarioReale: { inizio: o('22:00'), fine: o('09:00') } })),
        g('2026-12-01', cella('R3')),
      ]),
    ).toMatchObject([{ giorno: '2026-12-01', codiceTurno: 'N1', giornoTurno: '2026-11-30' }]);
  });

  it('usa l’orario reale: M1 finita alle 11:30 non si sovrappone a R4 delle 12:00', () => {
    expect(
      avvisiSovrapposizione([
        g(
          '2026-11-10',
          cella('M1', 'R4', { orarioReale: { inizio: o('07:00'), fine: o('11:30') } }),
        ),
      ]),
    ).toEqual([]);
    expect(avvisiSovrapposizione([g('2026-11-10', cella('M1', 'R4'))])).toHaveLength(1);
  });

  it('turno scoperto o reperibilità non svolta: nessun avviso', () => {
    expect(avvisiSovrapposizione([g('2026-11-10', cella('M1', 'MA', 'R3'))])).toEqual([]);
  });
});
