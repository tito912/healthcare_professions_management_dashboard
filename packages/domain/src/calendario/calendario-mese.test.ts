// Calendario da copiare nel documento del mese (ARCHITETTURA §5.8) e giorni di servizio (§5.5).
import { describe, expect, it } from 'vitest';
import { d, m } from '../test-utili';
import { calendarioMese } from './calendario-mese';
import {
  dipendentiInServizio,
  giorniDiServizio,
  inServizioIl,
  inServizioNelMese,
} from './servizio';

describe('calendarioMese', () => {
  it('copia le festività del mese (nazionali non escluse e locali) e l’attribuzione della notte', () => {
    expect(
      calendarioMese(
        m('2026-12'),
        {
          nazionaliEscluse: ['santo-stefano'],
          locali: [{ id: 'loc-vigilia', nome: 'Vigilia di Natale', giorno: 24, mese: 12 }],
        },
        'fine',
      ),
    ).toEqual({
      festivita: {
        '08': { id: 'immacolata', nome: 'Immacolata Concezione' },
        '24': { id: 'loc-vigilia', nome: 'Vigilia di Natale' },
        '25': { id: 'natale', nome: 'Natale' },
      },
      attribuzioneNotte: 'fine',
    });
  });

  it('se una locale cade su una nazionale, resta la nazionale', () => {
    const calendario = calendarioMese(
      m('2026-12'),
      { nazionaliEscluse: [], locali: [{ id: 'loc-a', nome: 'Aaa', giorno: 25, mese: 12 }] },
      'inizio',
    );
    expect(calendario.festivita['25']).toEqual({ id: 'natale', nome: 'Natale' });
  });

  it('il 29 febbraio locale esiste solo negli anni bisestili', () => {
    const configurazione = {
      nazionaliEscluse: [],
      locali: [{ id: 'loc-bis', nome: 'Bisestile', giorno: 29, mese: 2 }],
    };
    expect(calendarioMese(m('2026-02'), configurazione, 'inizio').festivita).toEqual({});
    expect(calendarioMese(m('2028-02'), configurazione, 'inizio').festivita).toEqual({
      '29': { id: 'loc-bis', nome: 'Bisestile' },
    });
  });

  it('un mese senza festività ha la mappa vuota', () => {
    expect(
      calendarioMese(m('2026-03'), { nazionaliEscluse: [], locali: [] }, 'inizio').festivita,
    ).toEqual({});
  });
});

describe('servizio', () => {
  const sempre = { dataAssunzione: null, dataCessazione: null };
  const assuntoIl16 = { dataAssunzione: d('2026-11-16'), dataCessazione: null };
  const cessatoIl13 = { dataAssunzione: null, dataCessazione: d('2026-11-13') };

  it.each([
    [sempre, '1990-01-01', true],
    [assuntoIl16, '2026-11-15', false],
    [assuntoIl16, '2026-11-16', true],
    [cessatoIl13, '2026-11-13', true], // l'ultimo giorno di servizio è compreso
    [cessatoIl13, '2026-11-14', false],
  ])('inServizioIl(%o, %s) = %s', (contratto, data, atteso) => {
    expect(inServizioIl(contratto, d(data))).toBe(atteso);
  });

  it('assunto a metà mese: servizio dal 16 al 30', () => {
    const giorni = giorniDiServizio(assuntoIl16, m('2026-11'));
    expect(giorni).toHaveLength(15);
    expect(giorni[0]).toBe('2026-11-16');
    expect(giorni.at(-1)).toBe('2026-11-30');
  });

  it('cessato a metà mese: servizio dall’1 al 13', () => {
    const giorni = giorniDiServizio(cessatoIl13, m('2026-11'));
    expect(giorni).toHaveLength(13);
    expect(giorni.at(-1)).toBe('2026-11-13');
  });

  it('assunto e cessato nello stesso mese', () => {
    expect(
      giorniDiServizio(
        { dataAssunzione: d('2026-11-10'), dataCessazione: d('2026-11-20') },
        m('2026-11'),
      ),
    ).toHaveLength(11);
  });

  it('dipendentiInServizio tiene chi ha almeno un giorno di servizio nel mese, nell’ordine dato', () => {
    const dipendenti = [
      { id: 'a', ...sempre },
      { id: 'b', dataAssunzione: null, dataCessazione: d('2026-10-31') },
      { id: 'c', dataAssunzione: d('2026-12-01'), dataCessazione: null },
      { id: 'd', dataAssunzione: d('2026-11-30'), dataCessazione: null },
      { id: 'e', dataAssunzione: null, dataCessazione: d('2026-11-01') },
    ];
    expect(dipendentiInServizio(m('2026-11'), dipendenti).map((x) => x.id)).toEqual([
      'a',
      'd',
      'e',
    ]);
    expect(inServizioNelMese(dipendenti[1] ?? sempre, m('2026-11'))).toBe(false);
  });
});
