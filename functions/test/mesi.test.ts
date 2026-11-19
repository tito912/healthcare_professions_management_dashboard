// Parti pure dei trigger dei mesi: confronto dei dati e mesi toccati da una riga.
import { chiaveMese } from '@turni/domain';
import { describe, expect, it } from 'vitest';
import { stessiDati } from '../src/mesi/aggiorna-riepiloghi-mese';
import { mesiInteressati } from '../src/mesi/ricalcolo';

describe('stessiDati', () => {
  it('ignora l’ordine delle chiavi, a ogni livello', () => {
    expect(
      stessiDati(
        { festivita: { '25': { id: 'natale', nome: 'Natale' } }, attribuzioneNotte: 'inizio' },
        { attribuzioneNotte: 'inizio', festivita: { '25': { nome: 'Natale', id: 'natale' } } },
      ),
    ).toBe(true);
  });

  it('distingue valori, chiavi in più e ordine delle liste', () => {
    expect(stessiDati({ a: 1 }, { a: 2 })).toBe(false);
    expect(stessiDati({ a: 1 }, { a: 1, b: 1 })).toBe(false);
    expect(stessiDati([1, 2], [2, 1])).toBe(false);
    expect(stessiDati({ a: null }, { a: undefined })).toBe(false);
  });
});

describe('mesiInteressati', () => {
  it('sono il mese della riga e i due adiacenti, anche a cavallo d’anno', () => {
    expect(mesiInteressati(chiaveMese('2026-11'))).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(mesiInteressati(chiaveMese('2026-12'))).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(mesiInteressati(chiaveMese('2026-01'))).toEqual(['2025-12', '2026-01', '2026-02']);
  });
});
