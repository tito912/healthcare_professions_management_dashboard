// validaMese (ARCHITETTURA §5.9): coerenza delle sostituzioni tra le righe dello stesso mese.
import { describe, expect, it } from 'vitest';
import type { CellaDoc } from '../documenti';
import { cella, m, reperibilitaDiProva, riga } from '../test-utili';
import { validaMese } from './valida-mese';
import { validaRiga } from './valida-riga';

const NOVEMBRE = { chiaveMese: m('2026-11') };
const conReperibilita = (
  altro: Partial<{ sostituisce: string; copertaDa: string }>,
  codice = 'R2',
): CellaDoc => ({ ...cella(), reperibilita: [reperibilitaDiProva(codice, [], altro)] });

describe('validaMese', () => {
  it('sostituzione reciproca del turno: nessun errore', () => {
    expect(
      validaMese([
        riga('a', { '05': cella('M1', 'MA', { copertoDa: 'b' }) }),
        riga('b', { '05': cella('M1', { sostituisce: 'a' }) }),
      ]),
    ).toEqual([]);
  });

  it('A coperto da B ma B senza «sostituisce: A»: validaRiga non vede nulla, validaMese sì (PIANO 2.1, criterio 11)', () => {
    const a = riga('a', { '05': cella('M1', 'MA', { copertoDa: 'b' }) });
    const b = riga('b', { '05': cella('M1') });
    expect(validaRiga(a, NOVEMBRE)).toEqual([]);
    expect(validaRiga(b, NOVEMBRE)).toEqual([]);
    expect(validaMese([a, b])).toEqual([
      {
        livello: 'blocco',
        codice: 'sostituzioneNonReciproca',
        dipendenteId: 'a',
        chiaveGiorno: '05',
      },
    ]);
  });

  it('B sostituisce A ma A non è coperto da B', () => {
    expect(
      validaMese([
        riga('a', { '05': cella('M1', 'MA') }),
        riga('b', { '05': cella('M1', { sostituisce: 'a' }) }),
      ]),
    ).toEqual([
      {
        livello: 'blocco',
        codice: 'sostituzioneNonReciproca',
        dipendenteId: 'b',
        chiaveGiorno: '05',
      },
    ]);
  });

  it('il collega non ha una riga nel mese', () => {
    expect(validaMese([riga('b', { '05': cella('M1', { sostituisce: 'z' }) })])).toEqual([
      { livello: 'blocco', codice: 'sostituzioneSenzaRiga', dipendenteId: 'b', chiaveGiorno: '05' },
    ]);
    expect(validaMese([riga('a', { '05': cella('M1', 'MA', { copertoDa: 'z' }) })])).toEqual([
      { livello: 'blocco', codice: 'sostituzioneSenzaRiga', dipendenteId: 'a', chiaveGiorno: '05' },
    ]);
  });

  it('il collega ha la riga ma non la cella quel giorno', () => {
    expect(
      validaMese([riga('a', { '05': cella('M1', 'MA', { copertoDa: 'b' }) }), riga('b', {})]),
    ).toMatchObject([{ codice: 'sostituzioneNonReciproca', dipendenteId: 'a' }]);
  });

  it('un turno scoperto ha al massimo un sostituto', () => {
    expect(
      validaMese([
        riga('a', { '05': cella('M1', 'MA', { copertoDa: 'b' }) }),
        riga('b', { '05': cella('M1', { sostituisce: 'a' }) }),
        riga('c', { '05': cella('M1', { sostituisce: 'a' }) }),
      ]),
    ).toEqual([
      {
        livello: 'blocco',
        codice: 'sostituzioneNonReciproca',
        dipendenteId: 'c',
        chiaveGiorno: '05',
      },
    ]);
  });

  it('reperibilità: reciproca ok, non reciproca in entrambe le direzioni', () => {
    expect(
      validaMese([
        riga('a', { '05': conReperibilita({ copertaDa: 'b' }) }),
        riga('b', { '05': conReperibilita({ sostituisce: 'a' }) }),
      ]),
    ).toEqual([]);
    expect(
      validaMese([
        riga('a', { '05': conReperibilita({ copertaDa: 'b' }) }),
        riga('b', { '05': cella('R2') }),
      ]),
    ).toMatchObject([{ codice: 'sostituzioneNonReciproca', dipendenteId: 'a' }]);
    expect(
      validaMese([
        riga('a', { '05': cella('R2') }),
        riga('b', { '05': conReperibilita({ sostituisce: 'a' }) }),
      ]),
    ).toMatchObject([{ codice: 'sostituzioneNonReciproca', dipendenteId: 'b' }]);
    expect(validaMese([riga('b', { '05': conReperibilita({ sostituisce: 'z' }) })])).toMatchObject([
      { codice: 'sostituzioneSenzaRiga', dipendenteId: 'b' },
    ]);
  });
});
