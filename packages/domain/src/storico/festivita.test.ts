// Storico delle festività (U6, PIANO 2.3 criterio 5): finestra degli anni e conteggi dai riepiloghi.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { m } from '../test-utili';
import {
  aggregaStoricoFestivita,
  intervalloStoricoFestivita,
  type RiepilogoPerStorico,
} from './festivita';

const lav = (idFestivita: string, codice: string, giorno: '24' | '25' = '25') => ({
  idFestivita,
  giorno,
  codice: codiceTurno(codice),
});

function riepilogo(
  dipendenteId: string,
  chiave: string,
  festivitaLavorate: RiepilogoPerStorico['festivitaLavorate'],
): RiepilogoPerStorico {
  return {
    dipendenteId,
    chiaveMese: m(chiave),
    anno: Number(chiave.slice(0, 4)),
    festivitaLavorate,
  };
}

describe('intervalloStoricoFestivita', () => {
  it('sono i 5 anni prima di quello del mese mostrato, interi', () => {
    expect(intervalloStoricoFestivita(m('2026-12'))).toEqual({
      da: '2021-01',
      a: '2025-12',
      anni: [2025, 2024, 2023, 2022, 2021],
    });
  });

  it('il mese mostrato non rientra, nemmeno a gennaio', () => {
    expect(intervalloStoricoFestivita(m('2027-01')).a).toBe('2026-12');
  });
});

describe('aggregaStoricoFestivita', () => {
  const riepiloghi = [
    riepilogo('A', '2025-12', [lav('natale', 'M1')]),
    riepilogo('B', '2025-12', [lav('natale', 'N1', '24'), lav('santo-stefano', 'P1')]),
    riepilogo('A', '2024-12', [lav('natale', 'P1')]),
    riepilogo('A', '2022-12', [lav('natale', 'M1')]),
    riepilogo('C', '2021-12', [lav('natale', 'M1')]),
    riepilogo('A', '2020-12', [lav('natale', 'M1')]), // fuori dai 5 anni
    riepilogo('A', '2026-12', [lav('natale', 'M1')]), // il mese mostrato
  ];

  it('conta quante volte ogni dipendente ha lavorato quella festività negli anni dello storico', () => {
    const storico = aggregaStoricoFestivita('natale', m('2026-12'), riepiloghi);
    expect([...storico.perDipendente.entries()].sort()).toEqual([
      ['A', 3],
      ['B', 1],
      ['C', 1],
    ]);
  });

  it('il dettaglio ha un elemento per ogni anno, dal più recente, anche senza nessuno', () => {
    const storico = aggregaStoricoFestivita('natale', m('2026-12'), riepiloghi);
    expect(storico.perAnno.map((a) => a.anno)).toEqual([2025, 2024, 2023, 2022, 2021]);
    expect(storico.perAnno[0]?.voci).toEqual([
      { dipendenteId: 'A', codice: 'M1' },
      { dipendenteId: 'B', codice: 'N1' },
    ]);
    expect(storico.perAnno[2]?.voci).toEqual([]);
  });

  it('ignora le altre festività e i riepiloghi senza festività', () => {
    const storico = aggregaStoricoFestivita('santo-stefano', m('2026-12'), [
      ...riepiloghi,
      riepilogo('Z', '2025-03', []),
    ]);
    expect([...storico.perDipendente.entries()]).toEqual([['B', 1]]);
  });

  it('un dipendente con due turni nella stessa festività (due giorni) conta due volte nell’anno', () => {
    const storico = aggregaStoricoFestivita('natale', m('2026-12'), [
      riepilogo('A', '2025-12', [lav('natale', 'N1', '24'), lav('natale', 'M1')]),
    ]);
    expect(storico.perDipendente.get('A')).toBe(2);
    expect(storico.perAnno[0]?.voci).toHaveLength(2);
  });

  it('i riepiloghi doppi dello stesso dipendente e mese contano una volta sola', () => {
    const doppio = riepilogo('A', '2025-12', [lav('natale', 'M1')]);
    expect(
      aggregaStoricoFestivita('natale', m('2026-12'), [doppio, doppio]).perDipendente.get('A'),
    ).toBe(1);
  });
});
