import { describe, expect, it } from 'vitest';
import type { ConfigurazioneFestivita } from '../documenti';
import { codiceTurno } from '../codici';
import type { RiepilogoPerStorico } from '../storico/festivita';
import { m } from '../test-utili';
import { festivitaAnno } from './festivita-anno';

const CONFIG: ConfigurazioneFestivita = {
  nazionaliEscluse: ['pasquetta'],
  locali: [{ id: 'loc-patrono', nome: 'Santo patrono', giorno: 10, mese: 6 }],
};

const lavorata = (idFestivita: string, giorno: string, codice: string) => ({
  idFestivita,
  giorno: giorno as '01',
  codice: codiceTurno(codice),
});

function riepilogo(
  dipendenteId: string,
  mese: string,
  lavorate: RiepilogoPerStorico['festivitaLavorate'],
): RiepilogoPerStorico {
  return {
    dipendenteId,
    chiaveMese: m(mese),
    anno: Number(mese.slice(0, 4)),
    festivitaLavorate: lavorate,
  };
}

describe('festivitaAnno', () => {
  it('colonne: festività del reparto in ordine di data, con le locali e senza le escluse', () => {
    const r = festivitaAnno(2026, CONFIG, []);
    const ids = r.colonne.map((c) => c.id);
    expect(ids).toContain('capodanno');
    expect(ids).toContain('loc-patrono');
    expect(ids).not.toContain('pasquetta');
    expect(ids.indexOf('capodanno')).toBe(0);
    expect(ids.indexOf('loc-patrono')).toBeGreaterThan(ids.indexOf('repubblica') - 1);
    expect(r.colonne.map((c) => c.data)).toEqual([...r.colonne.map((c) => c.data)].sort());
    expect(r.righe).toEqual({});
  });

  it('per dipendente: i codici dei turni delle festività lavorate e il totale', () => {
    const r = festivitaAnno(2026, CONFIG, [
      riepilogo('A', '2026-01', [
        lavorata('capodanno', '01', 'M1'),
        lavorata('epifania', '06', 'N1'),
      ]),
      riepilogo('A', '2026-12', [lavorata('natale', '25', 'P1')]),
      riepilogo('B', '2026-12', [
        lavorata('natale', '25', 'M1'),
        lavorata('santo-stefano', '26', 'M1'),
      ]),
    ]);
    expect(r.righe['A']).toEqual({
      perFestivita: { capodanno: ['M1'], epifania: ['N1'], natale: ['P1'] },
      totale: 3,
    });
    expect(r.righe['B']).toEqual({
      perFestivita: { natale: ['M1'], 'santo-stefano': ['M1'] },
      totale: 2,
    });
  });

  it('ignora i riepiloghi di altri anni e un riepilogo doppio conta una volta (vale l’ultimo)', () => {
    const r = festivitaAnno(2026, CONFIG, [
      riepilogo('A', '2025-12', [lavorata('natale', '25', 'M1')]),
      riepilogo('A', '2026-12', [lavorata('natale', '25', 'M1')]),
      riepilogo('A', '2026-12', [lavorata('natale', '25', 'P1')]),
    ]);
    expect(r.righe['A']).toEqual({ perFestivita: { natale: ['P1'] }, totale: 1 });
  });

  it('una festività lavorata che oggi non è più in elenco resta come colonna', () => {
    const r = festivitaAnno(2026, CONFIG, [
      riepilogo('A', '2026-04', [lavorata('pasquetta', '06', 'M1')]),
      riepilogo('A', '2026-09', [lavorata('loc-vecchia', '14', 'M1')]),
    ]);
    const pasquetta = r.colonne.find((c) => c.id === 'pasquetta');
    expect(pasquetta).toMatchObject({
      nome: 'Lunedì dell’Angelo',
      tipo: 'nonPiuInElenco',
      data: '2026-04-06',
    });
    const vecchia = r.colonne.find((c) => c.id === 'loc-vecchia');
    expect(vecchia).toMatchObject({ nome: null, tipo: 'nonPiuInElenco', data: '2026-09-14' });
    expect(r.righe['A']?.totale).toBe(2);
  });
});
