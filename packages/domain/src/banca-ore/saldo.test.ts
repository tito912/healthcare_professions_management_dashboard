// Ore lavorate e saldo (PIANO 3.1a criteri 2-3, D4). Valori in minuti, calcolati a mano nei commenti.
// Con 36 ore settimanali un feriale vale 36 × 60 ÷ 5 = 432 minuti (7,2 ore).
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { festivitaNazionali } from '../calendario/festivita';
import type { CellaDoc, ContrattoRiga, OrarioReale, TurnoInCella } from '../documenti';
import { CONTRATTO_PIENO, cella, d, m, o, reperibilitaDiProva } from '../test-utili';
import {
  bancaOreAnno,
  minutiLavoratiMese,
  minutiLavoratiTurno,
  riportoDa,
  saldoAnno,
  saldoGiorno,
  saldoMese,
  type RiepilogoPerBancaOre,
} from './saldo';

const FESTIVITA_2026 = festivitaNazionali(2026);
const orario = (inizio: string, fine: string): OrarioReale => ({
  inizio: o(inizio),
  fine: o(fine),
});
/** Turno di 8 ore piene, senza pausa (esempio di D4). */
const D8: TurnoInCella = {
  codice: codiceTurno('D1'),
  inizio: o('07:00'),
  fine: o('15:00'),
  pausaMinuti: 0,
  notturno: false,
};
const conTurno = (turno: TurnoInCella): CellaDoc => ({ ...cella(), turno });
const SOLO_R1_CON_CHIAMATA: CellaDoc = {
  ...cella(),
  reperibilita: [reperibilitaDiProva('R1', [{ durataMinuti: 90, oraInizio: null }])],
};
const MEZZO_TEMPO: ContrattoRiga = { ...CONTRATTO_PIENO, oreSettimanali: 18 };
const ASSUNTO_IL_16: ContrattoRiga = { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-16') };

describe('minutiLavoratiTurno', () => {
  it.each([
    ['M1 pianificato: 7 h − 30 min di pausa', '2026-11-05', cella('M1'), 390],
    // L37: sugli orari reali si applica la pausa del turno previsto. 07:00-14:30 = 450 − 30 = 420 (7 h).
    [
      'M1 con orario reale 07:00-14:30 = 7 h',
      '2026-11-05',
      cella('M1', { orarioReale: orario('07:00', '14:30') }),
      420,
    ],
    ['P1 pianificato: 8 h − 30', '2026-11-05', cella('P1'), 450],
    ['N1 senza pausa: 9 h', '2026-11-04', cella('N1'), 540],
    ['N1 nella notte del cambio d’ora d’autunno: 10 h reali', '2026-10-24', cella('N1'), 600],
    ['N1 nella notte del cambio d’ora di primavera: 8 h reali', '2026-03-28', cella('N1'), 480],
    ['G1 di 24 ore', '2026-11-02', cella('G1'), 1440],
    [
      'sostituzione: le ore sono di chi la fa',
      '2026-11-05',
      cella('P1', { sostituisce: 'B' }),
      450,
    ],
    ['turno scoperto per malattia: niente ore all’assente', '2026-11-05', cella('M1', 'MA'), 0],
    [
      'turno coperto da un collega: niente ore all’assente',
      '2026-11-05',
      cella('M1', 'MA', { copertoDa: 'B' }),
      0,
    ],
    ['riposo', '2026-11-05', cella('R'), 0],
    ['ferie', '2026-11-05', cella('F'), 0],
    ['cella vuota', '2026-11-05', cella(), 0],
    [
      'solo reperibilità con chiamata: le chiamate non entrano',
      '2026-11-05',
      cella('R1', {
        chiamata: { codice: 'R1', chiamata: { durataMinuti: 60, oraInizio: o('15:00') } },
      }),
      0,
    ],
    [
      'orario reale più corto della pausa: zero, mai negativo',
      '2026-11-05',
      cella('M1', { orarioReale: orario('07:00', '07:20') }),
      0,
    ],
  ] as const)('%s', (_descrizione, giorno, c, attesi) => {
    expect(minutiLavoratiTurno(d(giorno), c)).toBe(attesi);
  });
});

describe('minutiLavoratiMese', () => {
  it('somma i turni svolti; esclude assenze, turni scoperti o coperti, reperibilità e chiamate', () => {
    const minuti = minutiLavoratiMese(m('2026-11'), {
      '02': cella('M1'), // 390
      '03': cella('M1', { orarioReale: orario('07:00', '14:30') }), // 420
      '04': cella('P1', { sostituisce: 'B' }), // 450
      '05': cella('M1', 'MA'), // 0
      '06': cella('M1', 'MA', { copertoDa: 'B' }), // 0
      '07': cella('R', 'R2', {
        chiamata: { codice: 'R2', chiamata: { durataMinuti: 120, oraInizio: o('23:00') } },
      }), // 0
      '09': cella('F'), // 0
    });
    expect(minuti).toBe(390 + 420 + 450);
  });

  it('la notte dell’ultimo giorno conta tutta nel mese in cui inizia (L10)', () => {
    expect(minutiLavoratiMese(m('2026-11'), { '30': cella('N1') })).toBe(540);
    expect(minutiLavoratiMese(m('2026-12'), {})).toBe(0);
  });

  it('ignora le chiavi che il mese non ha', () => {
    expect(minutiLavoratiMese(m('2026-11'), { '31': cella('M1') })).toBe(0);
  });
});

describe('saldoGiorno (D4, 36 h: 432 minuti dovuti per feriale)', () => {
  it.each([
    // D4: «un riposo in un feriale vale −7,2»
    ['riposo in un feriale: −7,2 h', '2026-11-03', CONTRATTO_PIENO, cella('R'), -432],
    // D4: «un turno di 8 ore di domenica vale +8»
    ['turno di 8 ore di domenica: +8 h', '2026-11-08', CONTRATTO_PIENO, conTurno(D8), 480],
    ['turno di 8 ore in un feriale: +0,8 h', '2026-11-03', CONTRATTO_PIENO, conTurno(D8), 48],
    [
      'cella vuota in un feriale vale come un riposo (L32)',
      '2026-11-03',
      CONTRATTO_PIENO,
      null,
      -432,
    ],
    ['smonto in un feriale: zero ore lavorate', '2026-11-03', CONTRATTO_PIENO, cella('S'), -432],
    ['M1 in un feriale: 390 − 432', '2026-11-03', CONTRATTO_PIENO, cella('M1'), -42],
    ['P1 in un feriale: 450 − 432', '2026-11-03', CONTRATTO_PIENO, cella('P1'), 18],
    ['M1 di sabato: ore intere', '2026-11-07', CONTRATTO_PIENO, cella('M1'), 390],
    ['riposo di domenica: zero', '2026-11-08', CONTRATTO_PIENO, cella('R'), 0],
    ['ferie in un feriale: neutre', '2026-11-03', CONTRATTO_PIENO, cella('F'), 0],
    [
      'malattia su un turno in un feriale: neutra',
      '2026-11-03',
      CONTRATTO_PIENO,
      cella('M1', 'MA'),
      0,
    ],
    ['malattia di domenica: neutra', '2026-11-08', CONTRATTO_PIENO, cella('MA'), 0],
    [
      'festivo infrasettimanale vuoto (Immacolata, martedì): zero',
      '2026-12-08',
      CONTRATTO_PIENO,
      null,
      0,
    ],
    [
      'M1 nel festivo infrasettimanale: ore intere',
      '2026-12-08',
      CONTRATTO_PIENO,
      cella('M1'),
      390,
    ],
    ['giorno prima dell’assunzione: zero', '2026-11-10', ASSUNTO_IL_16, null, 0],
    ['giorno dell’assunzione: dovute', '2026-11-16', ASSUNTO_IL_16, null, -432],
    ['G1 di 24 ore in un feriale: 1440 − 432', '2026-11-02', CONTRATTO_PIENO, cella('G1'), 1008],
    [
      'N1 di sabato nella notte del cambio d’ora: 10 h',
      '2026-10-24',
      CONTRATTO_PIENO,
      cella('N1'),
      600,
    ],
    [
      'sostituzione in un feriale: 450 − 432',
      '2026-11-03',
      CONTRATTO_PIENO,
      cella('P1', { sostituisce: 'B' }),
      18,
    ],
    [
      'solo reperibilità con chiamata in un feriale: come un riposo',
      '2026-11-03',
      CONTRATTO_PIENO,
      SOLO_R1_CON_CHIAMATA,
      -432,
    ],
    [
      'mezzo tempo (18 h): riposo in un feriale −3,6 h',
      '2026-11-03',
      MEZZO_TEMPO,
      cella('R'),
      -216,
    ],
  ] as const)('%s', (_descrizione, giorno, contratto, c, attesi) => {
    expect(saldoGiorno(d(giorno), contratto, FESTIVITA_2026, c)).toBe(attesi);
  });
});

describe('saldoMese', () => {
  it('novembre 2026 vuoto con 36 h: 21 feriali × −432', () => {
    expect(saldoMese(m('2026-11'), CONTRATTO_PIENO, [], {})).toEqual({
      minutiLavorati: 0,
      minutiDovuti: 9072,
      saldoMinuti: -9072,
    });
  });

  it('novembre 2026 con M1 in ogni feriale: 21 × (390 − 432)', () => {
    const giorni: Record<string, CellaDoc> = {};
    for (const giorno of ['02', '03', '04', '05', '06', '09', '10', '11', '12', '13']) {
      giorni[giorno] = cella('M1');
    }
    for (const giorno of ['16', '17', '18', '19', '20', '23', '24', '25', '26', '27', '30']) {
      giorni[giorno] = cella('M1');
    }
    expect(saldoMese(m('2026-11'), CONTRATTO_PIENO, [], giorni)).toEqual({
      minutiLavorati: 21 * 390,
      minutiDovuti: 21 * 432,
      saldoMinuti: 21 * -42,
    });
  });

  it('assenze neutre e lavoro nel fine settimana', () => {
    // Novembre 2026, 21 feriali. Ferie lun 2 - ven 6 (5 feriali neutri): dovute 16 × 432 = 6912.
    // Lavorate: N1 di sabato 7 (540) + D8 di domenica 8 (480) = 1020. Saldo 1020 − 6912 = −5892.
    const esito = saldoMese(m('2026-11'), CONTRATTO_PIENO, [], {
      '02': cella('F'),
      '03': cella('F'),
      '04': cella('F'),
      '05': cella('F'),
      '06': cella('F'),
      '07': cella('N1'),
      '08': conTurno(D8),
    });
    expect(esito).toEqual({ minutiLavorati: 1020, minutiDovuti: 6912, saldoMinuti: -5892 });
  });

  it('assunzione a metà mese: contano solo i giorni di servizio (11 feriali dal 16)', () => {
    expect(saldoMese(m('2026-11'), ASSUNTO_IL_16, [], {}).minutiDovuti).toBe(11 * 432);
  });
});

describe('riportoDa e saldoAnno', () => {
  it('senza anno precedente il riporto è zero e definitivo (L13)', () => {
    expect(riportoDa(null)).toEqual({ minuti: 0, provvisorio: false });
  });

  it('il saldo dell’anno precedente diventa il riporto, provvisorio se lo era', () => {
    expect(riportoDa({ saldoAnnoMinuti: -168, provvisorio: false })).toEqual({
      minuti: -168,
      provvisorio: false,
    });
    expect(riportoDa({ saldoAnnoMinuti: 348, provvisorio: true })).toEqual({
      minuti: 348,
      provvisorio: true,
    });
  });

  it.each([
    ['nessun mese, nessun riporto', { minuti: 0, provvisorio: false }, {}, 0, 0, false],
    ['solo il riporto', { minuti: 600, provvisorio: false }, {}, 600, 600, false],
    [
      'riporto + un mese convalidato + uno in bozza',
      { minuti: 600, provvisorio: false },
      {
        '01': { saldoMinuti: -768, definitivo: true },
        '02': { saldoMinuti: 516, definitivo: false },
      },
      600 - 768 + 516,
      600 - 768,
      true,
    ],
    [
      'tutti i mesi convalidati ma riporto provvisorio',
      { minuti: -100, provvisorio: true },
      { '03': { saldoMinuti: 50, definitivo: true } },
      -50,
      -50,
      true,
    ],
  ] as const)('%s', (_d, riporto, mesi, anno, definitivo, provvisorio) => {
    expect(saldoAnno(riporto, mesi)).toEqual({
      saldoAnnoMinuti: anno,
      saldoDefinitivoMinuti: definitivo,
      provvisorio,
    });
  });
});

describe('bancaOreAnno', () => {
  const riepilogo = (
    dipendenteId: string,
    mese: string,
    lavorati: number,
    dovuti: number,
    statoMese: 'bozza' | 'convalidato',
    valida = true,
  ): RiepilogoPerBancaOre => ({
    dipendenteId,
    chiaveMese: m(mese),
    minutiLavorati: lavorati,
    minutiDovuti: dovuti,
    saldoMinuti: lavorati - dovuti,
    statoMese,
    valida,
  });

  it('compone i mesi dell’anno dai riepiloghi del dipendente e calcola i saldi', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: { minuti: 600, provvisorio: false },
      riepiloghi: [
        riepilogo('A', '2026-10', 7440, 8208, 'convalidato'), // −768
        riepilogo('A', '2026-11', 9000, 8640, 'bozza'), // +360
        riepilogo('B', '2026-10', 1, 0, 'convalidato'), // altro dipendente: ignorato
        riepilogo('A', '2025-12', 1, 0, 'convalidato'), // altro anno: ignorato
      ],
    });
    expect(banca).toEqual({
      dipendenteId: 'A',
      anno: 2026,
      riportoMinuti: 600,
      mesi: {
        '10': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true },
        '11': { minutiLavorati: 9000, minutiDovuti: 8640, saldoMinuti: 360, definitivo: false },
      },
      saldoAnnoMinuti: 600 - 768 + 360,
      saldoDefinitivoMinuti: 600 - 768,
      provvisorio: true,
    });
  });

  it('a fine anno il saldo diventa il riporto dell’anno nuovo', () => {
    const anno2025 = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2025,
      riporto: riportoDa(null),
      riepiloghi: [riepilogo('A', '2025-12', 1000, 400, 'convalidato')],
    });
    const anno2026 = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: riportoDa(anno2025),
      riepiloghi: [riepilogo('A', '2026-01', 0, 432, 'convalidato')],
    });
    expect(anno2025.saldoAnnoMinuti).toBe(600);
    expect(anno2026.riportoMinuti).toBe(600);
    expect(anno2026.saldoAnnoMinuti).toBe(600 - 432);
    expect(anno2026.provvisorio).toBe(false);
    expect(riportoDa(anno2026)).toEqual({ minuti: 168, provvisorio: false });
  });

  it('un mese non creato non pesa sul saldo dell’anno', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: riportoDa(null),
      riepiloghi: [],
    });
    expect(banca.mesi).toEqual({});
    expect(banca.saldoAnnoMinuti).toBe(0);
    expect(banca.provvisorio).toBe(false);
  });

  it('due riepiloghi dello stesso mese: vale l’ultimo dell’elenco', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: riportoDa(null),
      riepiloghi: [
        riepilogo('A', '2026-10', 100, 0, 'bozza'),
        riepilogo('A', '2026-10', 200, 0, 'convalidato'),
      ],
    });
    expect(banca.saldoAnnoMinuti).toBe(200);
    expect(banca.provvisorio).toBe(false);
  });

  // Review 3.1a, rilievo 3: con un contratto non valido le dovute sono 0 e il saldo coinciderebbe con tutte le ore
  // lavorate. Un riepilogo di una riga non valida non entra nella banca ore.
  it('esclude i riepiloghi di righe non valide e segna il documento provvisorio', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: { minuti: 100, provvisorio: false },
      riepiloghi: [
        riepilogo('A', '2026-09', 7440, 8208, 'convalidato'), // −768
        riepilogo('A', '2026-10', 9000, 0, 'bozza', false), // contratto non valido: saldo gonfiato, escluso
      ],
    });
    expect(banca.mesi).toEqual({
      '09': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true },
    });
    expect(banca.saldoAnnoMinuti).toBe(100 - 768);
    expect(banca.saldoDefinitivoMinuti).toBe(100 - 768);
    expect(banca.provvisorio).toBe(true);
  });

  it('con due riepiloghi dello stesso mese conta l’ultimo, anche se non valido (escluso)', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: riportoDa(null),
      riepiloghi: [
        riepilogo('A', '2026-10', 100, 0, 'bozza'),
        riepilogo('A', '2026-10', 5000, 0, 'bozza', false),
      ],
    });
    expect(banca.mesi).toEqual({});
    expect(banca.saldoAnnoMinuti).toBe(0);
    expect(banca.provvisorio).toBe(true);
  });

  it('un riepilogo non valido di un altro dipendente o di un altro anno non rende provvisorio', () => {
    const banca = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto: riportoDa(null),
      riepiloghi: [
        riepilogo('B', '2026-10', 5000, 0, 'bozza', false),
        riepilogo('A', '2025-10', 5000, 0, 'bozza', false),
        riepilogo('A', '2026-10', 432, 432, 'convalidato'),
      ],
    });
    expect(banca.provvisorio).toBe(false);
  });
});
