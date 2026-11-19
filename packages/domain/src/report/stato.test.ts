import { describe, expect, it } from 'vitest';
import { idBimestre } from '../calendario/bimestri';
import { m } from '../test-utili';
import {
  avvisoReportNonInviato,
  reportInviato,
  reportInviatoPerBimestre,
  type StatoReportBimestre,
} from './stato';

const ID = idBimestre('2026-B5');
const B6 = idBimestre('2026-B6');
const stato = (
  inviato: boolean,
  primo: 'bozza' | 'convalidato' | null,
  secondo: 'bozza' | 'convalidato' | null,
): StatoReportBimestre => ({
  idBimestre: ID,
  inviato,
  mesi: [
    { chiave: m('2026-09'), stato: primo },
    { chiave: m('2026-10'), stato: secondo },
  ],
});

describe('reportInviato', () => {
  it('vale l’invio automatico o degli esiti senza errori; un errore o nessun esito no', () => {
    expect(reportInviato(true, [])).toBe(true);
    expect(reportInviato(false, ['senzaEmail', 'accodato'])).toBe(true);
    expect(reportInviato(false, ['senzaEmail', 'errore'])).toBe(false);
    expect(reportInviato(false, ['accodato', 'errore'])).toBe(false);
    expect(reportInviato(false, [])).toBe(false);
  });

  it('con tutti senzaEmail il report è evaso: non c’è nulla da fare (review 4.1, rilievo 6)', () => {
    expect(reportInviato(false, ['senzaEmail', 'senzaEmail'])).toBe(true);
  });
});

describe('reportInviatoPerBimestre', () => {
  const entrambi = [m('2026-11'), m('2026-12')];
  it('un invio con un solo mese non chiude il bimestre (review 4.1, rilievo 3)', () => {
    expect(
      reportInviatoPerBimestre(false, B6, [{ esito: 'accodato', mesiInclusi: [m('2026-11')] }]),
    ).toBe(false);
    expect(
      reportInviatoPerBimestre(false, B6, [{ esito: 'accodato', mesiInclusi: entrambi }]),
    ).toBe(true);
    expect(reportInviatoPerBimestre(true, B6, [])).toBe(true);
  });

  it('un errore o un invio parziale su un dipendente tiene aperto l’avviso', () => {
    expect(
      reportInviatoPerBimestre(false, B6, [
        { esito: 'accodato', mesiInclusi: entrambi },
        { esito: 'errore', mesiInclusi: entrambi },
      ]),
    ).toBe(false);
    expect(
      reportInviatoPerBimestre(false, B6, [
        { esito: 'accodato', mesiInclusi: entrambi },
        { esito: 'accodato', mesiInclusi: [m('2026-11')] },
      ]),
    ).toBe(false);
  });
});

describe('avvisoReportNonInviato (L15)', () => {
  it('nessun avviso se è già inviato o se non c’è alcun mese', () => {
    expect(avvisoReportNonInviato(stato(true, 'bozza', 'bozza'))).toBeNull();
    expect(avvisoReportNonInviato(stato(false, null, null))).toBeNull();
  });

  it('un mese in bozza o non creato dà «mese non convalidato» con i mesi che mancano', () => {
    expect(avvisoReportNonInviato(stato(false, 'convalidato', 'bozza'))).toEqual({
      tipo: 'meseNonConvalidato',
      mesi: ['2026-10'],
    });
    expect(avvisoReportNonInviato(stato(false, 'convalidato', null))).toEqual({
      tipo: 'meseNonConvalidato',
      mesi: ['2026-10'],
    });
    expect(avvisoReportNonInviato(stato(false, 'bozza', 'bozza'))).toEqual({
      tipo: 'meseNonConvalidato',
      mesi: ['2026-09', '2026-10'],
    });
  });

  it('con entrambi i mesi convalidati e nessun invio è «non inviato»', () => {
    expect(avvisoReportNonInviato(stato(false, 'convalidato', 'convalidato'))).toEqual({
      tipo: 'nonInviato',
    });
  });
});
