// Conteggi del report bimestrale (PIANO 4.1 criterio 1 e 6) su uno scenario di novembre-dicembre 2026 passato dal
// vero `calcolaRiepilogo()`: notte tra sabato e domenica, festivo infrasettimanale (8 dicembre, martedì), sabato
// festivo (26 dicembre), malattia con sostituzione. Calendario di novembre 2026: 1° domenica (Ognissanti), 7 sabato,
// 8 domenica, 10 e 14 martedì e sabato; dicembre: 8 martedì (Immacolata), 12 sabato, 15 martedì, 25 venerdì
// (Natale), 26 sabato (Santo Stefano).
import { describe, expect, it } from 'vitest';
import { calendarioMese } from '../calendario/calendario-mese';
import { idBimestre } from '../calendario/bimestri';
import type { CellaDoc } from '../documenti';
import { calcolaRiepilogo } from '../riepiloghi/calcola-riepilogo';
import { cella, m, riga } from '../test-utili';
import type { ChiaveGiorno } from '../tipi';
import {
  conteggiBimestre,
  CONTEGGI_VUOTI,
  sommaConteggi,
  type RiepilogoPerReport,
} from './conteggi';

const ID = idBimestre('2026-B6');
const OTT = m('2026-10');
const NOV = m('2026-11');
const DIC = m('2026-12');
const TUTTE_LE_NAZIONALI = { nazionaliEscluse: [], locali: [] };

function riepilogo(
  dipendenteId: string,
  mese: string,
  giorni: Partial<Record<ChiaveGiorno, CellaDoc>>,
  notte: 'inizio' | 'fine' = 'inizio',
): RiepilogoPerReport {
  return calcolaRiepilogo({
    riga: riga(dipendenteId, giorni),
    chiaveMese: m(mese),
    statoMese: 'convalidato',
    calendario: calendarioMese(m(mese), TUTTE_LE_NAZIONALI, notte),
    righeAdiacenti: { precedente: null, successiva: null },
  });
}

function scenario(notte: 'inizio' | 'fine'): RiepilogoPerReport[] {
  return [
    // A, novembre: 01 domenica festiva (Ognissanti) M1; 06 N1 (venerdì notte), 07 N1 (la notte tra sabato e
    // domenica), 08 M1 domenica; 10 M1 in malattia, coperto da B; 12 ferie.
    riepilogo(
      'A',
      '2026-11',
      {
        '01': cella('M1'),
        '06': cella('N1'),
        '07': cella('N1'),
        '08': cella('M1'),
        '10': cella('M1', 'MA', { copertoDa: 'B' }),
        '12': cella('F'),
      },
      notte,
    ),
    // B, novembre: 10 sostituisce A (conta per B); 14 sabato M1.
    riepilogo(
      'B',
      '2026-11',
      { '10': cella('M1', { sostituisce: 'A' }), '14': cella('M1') },
      notte,
    ),
    // A, dicembre: 08 M1 (Immacolata, martedì), 15 reperibilità notte con una chiamata di 45 minuti, 26 M1 (sabato
    // festivo: conta tra i festivi, non tra i sabati).
    riepilogo(
      'A',
      '2026-12',
      {
        '08': cella('M1'),
        '15': cella('R2', {
          chiamata: { codice: 'R2', chiamata: { durataMinuti: 45, oraInizio: null } },
        }),
        '26': cella('M1'),
      },
      notte,
    ),
    // B, dicembre: 12 sabato M1; 20 malattia (non conta); 25 Natale P1.
    riepilogo('B', '2026-12', { '12': cella('M1'), '20': cella('MA'), '25': cella('P1') }, notte),
  ];
}

describe('conteggiBimestre: scenario novembre-dicembre 2026', () => {
  it('notte attribuita al giorno d’inizio (D6): la notte sabato-domenica conta come sabato', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), [NOV, DIC]);
    expect(r.mesiInclusi).toEqual(['2026-11', '2026-12']);
    // A: novembre 4 turni (01, 06, 07, 08; il 10 è scoperto), 2 notti, sabati 1 (la notte del 07), domeniche e festivi
    // 2 (01 festivo, 08); dicembre 2 turni, 2 festivi; 1 reperibilità con 1 chiamata di 45 minuti.
    expect(r.righe['A']).toMatchObject({
      turniSvolti: 6,
      notti: 2,
      sabati: 1,
      domenicheEFestivi: 4,
      reperibilitaSvolte: 1,
      chiamate: 1,
      minutiChiamate: 45,
    });
    // B: novembre il turno di A del 10 (martedì) e il sabato 14; dicembre il sabato 12 e il Natale; la malattia non conta.
    expect(r.righe['B']).toMatchObject({
      turniSvolti: 4,
      notti: 0,
      sabati: 2,
      domenicheEFestivi: 1,
      reperibilitaSvolte: 0,
      chiamate: 0,
      minutiChiamate: 0,
    });
    expect(r.totali).toMatchObject({
      turniSvolti: 10,
      notti: 2,
      sabati: 3,
      domenicheEFestivi: 5,
      reperibilitaSvolte: 1,
      chiamate: 1,
      minutiChiamate: 45,
    });
  });

  it('notte attribuita al giorno di fine: la notte sabato-domenica diventa domenica e quella del venerdì sabato', () => {
    const r = conteggiBimestre(ID, scenario('fine'), [NOV, DIC]);
    // A, novembre: 06 → sabato 07; 07 → domenica 08.
    expect(r.righe['A']).toMatchObject({
      turniSvolti: 6,
      notti: 2,
      sabati: 1,
      domenicheEFestivi: 5,
    });
    expect(r.righe['B']).toMatchObject({ turniSvolti: 4, sabati: 2, domenicheEFestivi: 1 });
    expect(r.totali).toMatchObject({ turniSvolti: 10, notti: 2, sabati: 3, domenicheEFestivi: 6 });
  });

  it('il sabato festivo conta tra le domeniche e i festivi (L11) e il festivo infrasettimanale anche', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), [DIC]);
    // A, dicembre: 08 (martedì festivo) e 26 (sabato festivo) → 2 festivi e nessun sabato.
    expect(r.righe['A']).toMatchObject({ turniSvolti: 2, sabati: 0, domenicheEFestivi: 2 });
  });

  it('con un solo mese incluso (l’altro in bozza) i conteggi sono quelli di quel mese', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), [NOV]);
    expect(r.mesiInclusi).toEqual(['2026-11']);
    expect(r.righe['A']).toMatchObject({ turniSvolti: 4, reperibilitaSvolte: 0, chiamate: 0 });
    expect(r.righe['B']).toMatchObject({ turniSvolti: 2, sabati: 1 });
    expect(r.totali.turniSvolti).toBe(6);
    expect(Object.keys(r.perMese)).toEqual(['2026-11']);
  });

  it('perMese ha gli stessi conteggi mese per mese e la somma torna', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), [NOV, DIC]);
    const novembre = r.perMese['2026-11']?.['A'];
    const dicembre = r.perMese['2026-12']?.['A'];
    expect(novembre?.turniSvolti).toBe(4);
    expect(dicembre?.turniSvolti).toBe(2);
    expect(sommaConteggi(novembre ?? CONTEGGI_VUOTI, dicembre ?? CONTEGGI_VUOTI)).toEqual(
      r.righe['A'],
    );
  });

  it('nessun mese incluso: nessuna riga e totali a zero', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), []);
    expect(r.mesiInclusi).toEqual([]);
    expect(r.righe).toEqual({});
    expect(r.totali).toEqual(CONTEGGI_VUOTI);
  });

  it('ignora i riepiloghi di altri mesi e, con un doppione dello stesso mese, vale l’ultimo', () => {
    const base = scenario('inizio');
    const fuori = riepilogo('A', '2026-10', { '01': cella('M1') });
    const doppione = riepilogo('A', '2026-11', { '02': cella('M1') });
    const r = conteggiBimestre(ID, [fuori, ...base, doppione], [OTT, NOV, DIC]);
    expect(r.mesiInclusi).toEqual(['2026-11', '2026-12']);
    // novembre di A sostituito dal doppione (1 turno) + dicembre 2
    expect(r.righe['A']?.turniSvolti).toBe(3);
  });

  it('un dipendente con un riepilogo senza attività compare con i conteggi a zero (le ore dovute restano)', () => {
    const r = conteggiBimestre(ID, [riepilogo('C', '2026-11', {})], [NOV]);
    expect(r.righe['C']).toMatchObject({
      ...CONTEGGI_VUOTI,
      minutiDovuti: expect.any(Number),
      saldoMinuti: expect.any(Number),
    });
    expect(r.righe['C']?.turniSvolti).toBe(0);
    expect(r.righe['C']?.minutiLavorati).toBe(0);
  });
});

describe('conteggiBimestre: ore del bimestre (L44)', () => {
  it('ore dovute, lavorate e saldo sono la somma dei riepiloghi dei mesi inclusi', () => {
    const tutti = scenario('inizio');
    const r = conteggiBimestre(ID, tutti, [NOV, DIC]);
    for (const id of ['A', 'B']) {
      const suoi = tutti.filter((x) => x.dipendenteId === id);
      const dovuti = suoi.reduce((somma, x) => somma + x.minutiDovuti, 0);
      const lavorati = suoi.reduce((somma, x) => somma + x.minutiLavorati, 0);
      expect(dovuti).toBeGreaterThan(0);
      expect(lavorati).toBeGreaterThan(0);
      expect(r.righe[id]).toMatchObject({
        minutiDovuti: dovuti,
        minutiLavorati: lavorati,
        saldoMinuti: lavorati - dovuti,
      });
    }
  });

  it('il saldo è lavorate − dovute e può essere negativo; i totali sommano i dipendenti', () => {
    const r = conteggiBimestre(ID, scenario('inizio'), [NOV, DIC]);
    for (const riga of [...Object.values(r.righe), r.totali]) {
      expect(riga.saldoMinuti).toBe(riga.minutiLavorati - riga.minutiDovuti);
    }
    const a = r.righe['A'];
    const b = r.righe['B'];
    expect(r.totali.minutiDovuti).toBe((a?.minutiDovuti ?? 0) + (b?.minutiDovuti ?? 0));
    expect(r.totali.minutiLavorati).toBe((a?.minutiLavorati ?? 0) + (b?.minutiLavorati ?? 0));
    expect(r.righe['C']).toBeUndefined();
    // Un mese senza turni ha ore dovute e nessuna lavorata: saldo negativo.
    const soloDovute = conteggiBimestre(ID, [riepilogo('C', '2026-11', {})], [NOV]).righe['C'];
    expect(soloDovute?.minutiLavorati).toBe(0);
    expect(soloDovute?.minutiDovuti).toBeGreaterThan(0);
    expect(soloDovute?.saldoMinuti).toBe(-(soloDovute?.minutiDovuti ?? 0));
  });

  it('con un solo mese incluso le ore sono quelle di quel mese; perMese ha le ore mese per mese', () => {
    const tutti = scenario('inizio');
    const r = conteggiBimestre(ID, tutti, [NOV]);
    const novembreA = tutti.find((x) => x.dipendenteId === 'A' && x.chiaveMese === '2026-11');
    expect(r.righe['A']?.minutiDovuti).toBe(novembreA?.minutiDovuti);
    expect(r.perMese['2026-11']?.['A']?.minutiLavorati).toBe(novembreA?.minutiLavorati);
  });

  it('CONTEGGI_VUOTI ha le ore a zero', () => {
    expect(CONTEGGI_VUOTI).toMatchObject({ minutiDovuti: 0, minutiLavorati: 0, saldoMinuti: 0 });
  });
});
