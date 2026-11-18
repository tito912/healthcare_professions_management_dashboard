import { describe, expect, it } from 'vitest';
import type { ConfigurazioneFestivita } from '../documenti';
import {
  dataPasqua,
  festivitaNazionali,
  festivitaReparto,
  idFestivitaLocale,
  nazionaliEscluseNellAnno,
  validaConfigurazioneFestivita,
  validaFestivitaLocale,
} from './festivita';
import { chiaveMeseDa, giorniNelMese } from './mesi';

const vuota: ConfigurazioneFestivita = { nazionaliEscluse: [], locali: [] };
const dateDi = (anno: number) => festivitaNazionali(anno).map((f) => [f.id, f.data]);

describe('Pasqua', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2038, '2038-04-25'],
  ])('nel %i è il %s', (anno, atteso) => {
    expect(dataPasqua(anno)).toBe(atteso);
  });
});

describe('festivitaNazionali', () => {
  it('2025: 12 festività, senza il 4 ottobre, con Pasqua e lunedì dell’Angelo calcolati', () => {
    const f = festivitaNazionali(2025);
    expect(f).toHaveLength(12);
    expect(f.some((x) => x.id === 'san-francesco')).toBe(false);
    expect(dateDi(2025)).toContainEqual(['pasqua', '2025-04-20']);
    expect(dateDi(2025)).toContainEqual(['pasquetta', '2025-04-21']);
  });

  it('dal 2026 c’è il 4 ottobre (Legge 151/2025)', () => {
    const f = festivitaNazionali(2026);
    expect(f).toHaveLength(13);
    expect(dateDi(2026)).toContainEqual(['san-francesco', '2026-10-04']);
    expect(dateDi(2026)).toContainEqual(['pasquetta', '2026-04-06']);
  });

  it('è in ordine di data e usa ogni ID una sola volta', () => {
    const f = festivitaNazionali(2026);
    expect(f.map((x) => x.data)).toEqual([...f.map((x) => x.data)].sort());
    expect(new Set(f.map((x) => x.id)).size).toBe(f.length);
    expect(f.every((x) => x.tipo === 'nazionale')).toBe(true);
  });
});

describe('festivitaReparto', () => {
  it('senza modifiche coincide con le nazionali', () => {
    expect(festivitaReparto(2026, vuota)).toEqual(festivitaNazionali(2026));
  });

  it('toglie le escluse (per ogni anno) e aggiunge le locali ricorrenti', () => {
    const configurazione: ConfigurazioneFestivita = {
      nazionaliEscluse: ['santo-stefano'],
      locali: [{ id: 'loc-san-giovanni', nome: 'San Giovanni Battista', giorno: 24, mese: 6 }],
    };
    for (const anno of [2026, 2027]) {
      const f = festivitaReparto(anno, configurazione);
      expect(f.some((x) => x.id === 'santo-stefano')).toBe(false);
      expect(f).toContainEqual({
        id: 'loc-san-giovanni',
        nome: 'San Giovanni Battista',
        data: `${anno}-06-24`,
        tipo: 'locale',
      });
      expect(f.map((x) => x.data)).toEqual([...f.map((x) => x.data)].sort());
    }
    expect(nazionaliEscluseNellAnno(2026, configurazione).map((f) => f.id)).toEqual([
      'santo-stefano',
    ]);
  });

  it('il 29 febbraio esiste solo negli anni bisestili', () => {
    const configurazione: ConfigurazioneFestivita = {
      nazionaliEscluse: [],
      locali: [{ id: 'loc-bisestile', nome: 'Bisestile', giorno: 29, mese: 2 }],
    };
    expect(festivitaReparto(2028, configurazione).some((f) => f.id === 'loc-bisestile')).toBe(true);
    expect(festivitaReparto(2027, configurazione).some((f) => f.id === 'loc-bisestile')).toBe(
      false,
    );
  });

  it('escludere san-francesco non cambia gli anni in cui non esiste', () => {
    const c: ConfigurazioneFestivita = { nazionaliEscluse: ['san-francesco'], locali: [] };
    expect(festivitaReparto(2025, c)).toHaveLength(12);
    expect(festivitaReparto(2026, c)).toHaveLength(12);
    expect(nazionaliEscluseNellAnno(2025, c)).toHaveLength(0);
  });
});

describe('validazione delle festività locali', () => {
  const buona = { id: 'loc-patrono', nome: 'Patrono', giorno: 24, mese: 6 };

  it('accetta una festività valida', () => {
    expect(validaFestivitaLocale(buona)).toBeNull();
    expect(validaFestivitaLocale({ ...buona, giorno: 29, mese: 2 })).toBeNull();
  });

  it.each([
    [{ nome: ' ' }, 'nomeVuoto'],
    [{ nome: 'x'.repeat(61) }, 'nomeTroppoLungo'],
    [{ mese: 13 }, 'meseNonValido'],
    [{ giorno: 0 }, 'giornoNonValido'],
    [{ giorno: 1.5 }, 'giornoNonValido'],
    [{ giorno: 31, mese: 4 }, 'dataInesistente'],
    [{ giorno: 30, mese: 2 }, 'dataInesistente'],
    [{ id: 'patrono' }, 'idNonValido'],
    [{ id: 'loc-' }, 'idNonValido'],
  ])('respinge %j (%s)', (modifica, motivo) => {
    expect(validaFestivitaLocale({ ...buona, ...modifica })).toBe(motivo);
  });

  it('controlla numero, ID ripetuti e nazionali sconosciute', () => {
    const locale = (i: number) => ({ id: `loc-${i}`, nome: 'P', giorno: 1, mese: 1 });
    expect(
      validaConfigurazioneFestivita({
        nazionaliEscluse: ['natale'],
        locali: Array.from({ length: 20 }, (_, i) => locale(i)),
      }),
    ).toBeNull();
    expect(
      validaConfigurazioneFestivita({
        nazionaliEscluse: [],
        locali: Array.from({ length: 21 }, (_, i) => locale(i)),
      }),
    ).toBe('troppeLocali');
    expect(
      validaConfigurazioneFestivita({ nazionaliEscluse: [], locali: [locale(1), locale(1)] }),
    ).toBe('idRipetuto');
    expect(
      validaConfigurazioneFestivita({ nazionaliEscluse: ['natale', 'natale'], locali: [] }),
    ).toBe('nazionaleSconosciuta');
  });
});

describe('idFestivitaLocale', () => {
  it('produce un ID valido anche con accenti, simboli e nomi lunghi', () => {
    for (const nome of ['San Giovanni Battista', 'Sant’Ambrogio', '***', 'x'.repeat(80), 'Città']) {
      const id = idFestivitaLocale(nome, 'a1b2');
      expect(validaFestivitaLocale({ id, nome: 'n', giorno: 1, mese: 1 })).toBeNull();
    }
    expect(idFestivitaLocale('San Giovanni', 'a1b2')).toBe('loc-san-giovanni-a1b2');
  });
});

describe('mesi', () => {
  it('giorni del mese e chiave', () => {
    expect(giorniNelMese(2026, 2)).toBe(28);
    expect(giorniNelMese(2028, 2)).toBe(29);
    expect(giorniNelMese(2026, 13)).toBe(0);
    expect(chiaveMeseDa(2026, 3)).toBe('2026-03');
  });
});
