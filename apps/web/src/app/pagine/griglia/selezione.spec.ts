import {
  colonnaIntera,
  contiene,
  limita,
  numeroCelle,
  posizioniDi,
  rettangolo,
  rigaIntera,
  stessoRettangolo,
} from './selezione';

describe('Selezione a rettangolo', () => {
  it('unisce ancora e cella attiva in qualunque direzione', () => {
    const r = rettangolo({ riga: 3, colonna: 5 }, { riga: 1, colonna: 7 });
    expect(r).toEqual({ rigaDa: 1, rigaA: 3, colonnaDa: 5, colonnaA: 7 });
    expect(numeroCelle(r)).toBe(9);
    expect(posizioniDi(r)).toHaveLength(9);
    expect(posizioniDi(r)[0]).toEqual({ riga: 1, colonna: 5 });
    expect(posizioniDi(r)[8]).toEqual({ riga: 3, colonna: 7 });
  });

  it('contiene solo le celle dentro', () => {
    const r = rettangolo({ riga: 0, colonna: 0 }, { riga: 1, colonna: 2 });
    expect(contiene(r, { riga: 1, colonna: 2 })).toBe(true);
    expect(contiene(r, { riga: 2, colonna: 0 })).toBe(false);
    expect(contiene(r, { riga: 0, colonna: 3 })).toBe(false);
  });

  it('limita tiene la posizione dentro la griglia, anche vuota', () => {
    expect(limita({ riga: -2, colonna: 40 }, 10, 31)).toEqual({ riga: 0, colonna: 30 });
    expect(limita({ riga: 3, colonna: 3 }, 0, 0)).toEqual({ riga: 0, colonna: 0 });
  });

  it('riga e colonna intere', () => {
    expect(rigaIntera(2, 7)).toEqual({ rigaDa: 2, rigaA: 2, colonnaDa: 0, colonnaA: 6 });
    expect(colonnaIntera(4, 40)).toEqual({ rigaDa: 0, rigaA: 39, colonnaDa: 4, colonnaA: 4 });
  });

  it('uguaglianza dei rettangoli, anche nulli', () => {
    const r = rettangolo({ riga: 0, colonna: 0 }, { riga: 1, colonna: 1 });
    expect(stessoRettangolo(r, { ...r })).toBe(true);
    expect(stessoRettangolo(r, null)).toBe(false);
    expect(stessoRettangolo(null, null)).toBe(true);
  });
});
