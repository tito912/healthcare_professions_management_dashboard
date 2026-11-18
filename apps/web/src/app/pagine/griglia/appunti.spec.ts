import { cellaVuota, codiceTurno, oraLocale, type CellaDoc } from '@turni/domain';
import { bloccoDaCelle, bloccoDaTesto, stessoTesto, testoPerAppunti } from './appunti';

const cella = (codice: string): CellaDoc => ({
  ...cellaVuota(),
  turno: {
    codice: codiceTurno(codice),
    inizio: oraLocale('07:00'),
    fine: oraLocale('14:00'),
    pausaMinuti: 30,
    notturno: false,
  },
});

describe('Appunti', () => {
  it('il blocco ha un testo per cella, vuoto per le celle senza contenuto', () => {
    expect(
      bloccoDaCelle([
        [cella('M1'), null],
        [null, cella('P1')],
      ]),
    ).toEqual([
      ['M1', ''],
      ['', 'P1'],
    ]);
  });

  it('negli appunti di sistema: tabulazioni tra le colonne, a-capo tra le righe', () => {
    expect(
      testoPerAppunti([
        ['M1', ''],
        ['', 'P1'],
      ]),
    ).toBe('M1\t\n\tP1');
  });

  it('il testo incollato torna blocco, anche da Excel (CRLF, a-capo finale, spazi)', () => {
    expect(bloccoDaTesto('M1\t\n\tP1')).toEqual([
      ['M1', ''],
      ['', 'P1'],
    ]);
    expect(bloccoDaTesto('M1\t N1 \r\nP1\t\r\n')).toEqual([
      ['M1', 'N1'],
      ['P1', ''],
    ]);
    expect(bloccoDaTesto('')).toEqual([['']]);
  });

  it('riconosce la copia interna ignorando gli a-capo finali', () => {
    expect(stessoTesto('M1\tP1\n', 'M1\tP1')).toBe(true);
    expect(stessoTesto('M1', 'P1')).toBe(false);
  });
});
