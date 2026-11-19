import { describe, expect, it } from 'vitest';
import { idBimestre } from '../calendario/bimestri';
import { m } from '../test-utili';
import { avvisoReportNonInviato, reportInviato, type StatoReportBimestre } from './stato';

const ID = idBimestre('2026-B5');
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
  it('vale l’invio automatico o almeno una email accodata; senza email o errore no', () => {
    expect(reportInviato(true, [])).toBe(true);
    expect(reportInviato(false, ['senzaEmail', 'accodato'])).toBe(true);
    expect(reportInviato(false, ['senzaEmail', 'errore'])).toBe(false);
    expect(reportInviato(false, [])).toBe(false);
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
