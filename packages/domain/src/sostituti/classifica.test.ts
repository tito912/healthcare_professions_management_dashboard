// Classifica dei sostituti (PIANO 3.1a criterio 4, U8, L9). Novembre 2026: il 4 è mercoledì, il 5 giovedì.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import type { CellaDoc, TurnoInCella } from '../documenti';
import { CONTRATTO_PIENO, cella, d, m, o, reperibilitaDiProva, riga } from '../test-utili';
import type { OggettoSostituzione, RigaConsuntivo } from '../consuntivo/sostituzione';
import {
  classificaSostituti,
  type DatiClassifica,
  type RiepilogoPerClassifica,
} from './classifica';

const TURNO: OggettoSostituzione = { tipo: 'turno' };
const rep = (codice: string): OggettoSostituzione => ({
  tipo: 'reperibilita',
  codice: codiceTurno(codice),
});
/** Turno di prova 06:00-13:00 (L9, caso a). */
const M2: TurnoInCella = {
  codice: codiceTurno('M2'),
  inizio: o('06:00'),
  fine: o('13:00'),
  pausaMinuti: 30,
  notturno: false,
};
const scopertoM2: CellaDoc = { ...cella('MA'), turno: M2 };
const conM2: CellaDoc = { ...cella(), turno: M2 };

function dati(
  oggetto: OggettoSostituzione,
  righe: readonly RigaConsuntivo[],
  altro: Partial<DatiClassifica> = {},
): DatiClassifica {
  return {
    chiaveMese: m('2026-11'),
    giorno: '05',
    assenteId: 'A',
    oggetto,
    righe,
    righeAdiacenti: {},
    turniEsclusi: {},
    riepiloghi: [],
    saldi: {},
    ...altro,
  };
}

/** Riga dell'assente con M1 scoperto per malattia il 5. */
const A_M1 = riga('A', { '05': cella('M1', 'MA') });
/** Riga dell'assente con la reperibilità R2 20:00-08:00 scoperta per malattia il 5. */
const A_R2 = riga('A', { '05': cella('MA', 'R2') });

function classifica(dc: DatiClassifica): NonNullable<ReturnType<typeof classificaSostituti>> {
  const esito = classificaSostituti(dc);
  if (esito === null) {
    throw new Error('classifica nulla');
  }
  return esito;
}
const ids = (elenco: readonly { dipendenteId: string }[]): string[] =>
  elenco.map((voce) => voce.dipendenteId);

describe('classificaSostituti: casi di L9 (PIANO 3.1a criterio 4)', () => {
  it('(a) N1 22:00-07:00 il 4 e turno scoperto 06:00-13:00 il 5: già in servizio (N1 del 4)', () => {
    const esito = classifica(
      dati(TURNO, [riga('A', { '05': scopertoM2 }), riga('B', { '04': cella('N1') })]),
    );
    expect(esito.disponibili).toEqual([]);
    expect(esito.nonDisponibili).toEqual([
      {
        dipendenteId: 'B',
        motivo: {
          codice: 'giaInServizio',
          tipo: 'turno',
          giorno: d('2026-11-04'),
          codiceTurno: 'N1',
          inizio: '22:00',
          fine: '07:00',
        },
      },
    ]);
  });

  it('(b) reperibilità scoperta 20:00-08:00 e candidato con M1 07:00-14:00 lo stesso giorno: disponibile', () => {
    const esito = classifica(dati(rep('R2'), [A_R2, riga('C', { '05': cella('M1') })]));
    expect(ids(esito.disponibili)).toEqual(['C']);
    expect(esito.disponibili[0]).toMatchObject({ reperibile: false, riposo: null });
    expect(esito.nonDisponibili).toEqual([]);
  });

  it('(c) stessa reperibilità e candidato con P1 14:00-22:00: non disponibile per sovrapposizione', () => {
    const esito = classifica(dati(rep('R2'), [A_R2, riga('D', { '05': cella('P1') })]));
    expect(esito.disponibili).toEqual([]);
    expect(esito.nonDisponibili).toEqual([
      {
        dipendenteId: 'D',
        motivo: {
          codice: 'giaInServizio',
          tipo: 'turno',
          giorno: d('2026-11-05'),
          codiceTurno: 'P1',
          inizio: '14:00',
          fine: '22:00',
        },
      },
    ]);
  });

  it('(d) turno principale scoperto e candidato con una reperibilità sovrapposta: disponibile con «Reperibile»', () => {
    const esito = classifica(dati(TURNO, [A_M1, riga('E', { '05': cella('R3') })]));
    expect(esito.disponibili).toEqual([
      { dipendenteId: 'E', volte: 0, saldoMinuti: null, reperibile: true, riposo: null },
    ]);
  });
});

describe('classificaSostituti: sovrapposizioni con il giorno prima e dopo', () => {
  it('turno di 24 ore del giorno prima (G1 08:00-08:00) sovrapposto a M1 07:00 del 5', () => {
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '04': cella('G1') })]));
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      giorno: '2026-11-04',
      codiceTurno: 'G1',
    });
  });

  it('turno del giorno dopo sovrapposto a una notte scoperta', () => {
    const esito = classifica(
      dati(TURNO, [riga('A', { '05': cella('N1', 'MA') }), riga('B', { '06': conM2 })]),
    );
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      giorno: '2026-11-06',
      codiceTurno: 'M2',
    });
  });

  it('turni che si toccano non si sovrappongono: N1 fino alle 07:00 e M1 dalle 07:00 (ma il riposo è zero)', () => {
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '04': cella('N1') })]));
    expect(esito.disponibili).toEqual([
      {
        dipendenteId: 'B',
        volte: 0,
        saldoMinuti: null,
        reperibile: false,
        riposo: { prima: 0, dopo: null },
      },
    ]);
  });

  it('a cavallo di mese: la notte del 31 ottobre (riga del mese prima) contro un turno scoperto l’1', () => {
    const esito = classifica(
      dati(TURNO, [riga('A', { '01': scopertoM2 }), riga('B', {})], {
        giorno: '01',
        righeAdiacenti: { B: { precedente: { '31': cella('N1') }, successiva: null } },
      }),
    );
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      giorno: '2026-10-31',
      codiceTurno: 'N1',
    });
  });

  it('a cavallo di mese: il turno dell’1 dicembre (riga del mese dopo) contro una notte scoperta il 30', () => {
    const esito = classifica(
      dati(TURNO, [riga('A', { '30': cella('N1', 'MA') }), riga('B', {})], {
        giorno: '30',
        righeAdiacenti: { B: { precedente: null, successiva: { '01': conM2 } } },
      }),
    );
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      giorno: '2026-12-01',
    });
  });

  it('l’orario reale del candidato prevale sul pianificato', () => {
    // N1 del 4 con uscita reale alle 05:30: non si sovrappone alle 06:00, ma il riposo è di 30 minuti.
    const esito = classifica(
      dati(TURNO, [
        riga('A', { '05': scopertoM2 }),
        riga('B', { '04': cella('N1', { orarioReale: { inizio: o('22:00'), fine: o('05:30') } }) }),
      ]),
    );
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', riposo: { prima: 30 } });
    // con un'uscita reale più tardi della prevista la sovrapposizione mostra l'orario reale
    const tardi = classifica(
      dati(TURNO, [
        A_M1,
        riga('B', { '04': cella('N1', { orarioReale: { inizio: o('22:00'), fine: o('07:30') } }) }),
      ]),
    );
    expect(tardi.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      inizio: '22:00',
      fine: '07:30',
    });
  });

  it('reperibilità del giorno prima sovrapposta al turno scoperto: «Reperibile», non esclude', () => {
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '04': cella('R2') })]));
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', reperibile: true });
  });

  it('una reperibilità coperta da un collega non è del candidato: nessuna etichetta', () => {
    const coperta: CellaDoc = {
      ...cella('MA'),
      reperibilita: [reperibilitaDiProva('R3', [], { copertaDa: 'X' })],
    };
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '05': coperta })]));
    expect(esito.nonDisponibili[0]?.motivo.codice).toBe('assente');
    const soloCoperta: CellaDoc = { ...coperta, assenza: null };
    const esito2 = classifica(dati(TURNO, [A_M1, riga('B', { '05': soloCoperta })]));
    expect(esito2.disponibili[0]).toMatchObject({ reperibile: false });
  });
});

describe('classificaSostituti: motivi di «Non disponibili»', () => {
  it.each([
    [
      'ha già un turno principale quel giorno (P1 tocca M1 alle 14:00)',
      cella('P1'),
      { codice: 'haGiaTurno', codiceTurno: 'P1', inizio: '14:00', fine: '22:00' },
    ],
    ['assente per ferie', cella('F'), { codice: 'assente', codiceAssenza: 'F' }],
    [
      'assente per malattia su un proprio turno',
      cella('M1', 'MA'),
      { codice: 'assente', codiceAssenza: 'MA' },
    ],
    [
      'assente con il proprio turno coperto da un collega',
      cella('P1', 'F', { copertoDa: 'X' }),
      { codice: 'assente', codiceAssenza: 'F' },
    ],
  ] as const)('turno scoperto: %s', (_d, c, motivo) => {
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '05': c })]));
    expect(esito.disponibili).toEqual([]);
    expect(esito.nonDisponibili).toEqual([{ dipendenteId: 'B', motivo }]);
  });

  it('la sovrapposizione nello stesso giorno prevale su «ha già il turno»', () => {
    const esito = classifica(
      dati(TURNO, [riga('A', { '05': cella('P1', 'MA') }), riga('B', { '05': cella('S1') })]),
    );
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      codiceTurno: 'S1',
    });
  });

  it('il riposo o lo smonto non escludono', () => {
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', { '05': cella('R') }), riga('C', { '05': cella('S') })]),
    );
    expect(ids(esito.disponibili)).toEqual(['B', 'C']);
  });

  it('turno tra gli esclusi del candidato', () => {
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', {})], { turniEsclusi: { B: [codiceTurno('M1')] } }),
    );
    expect(esito.nonDisponibili).toEqual([
      { dipendenteId: 'B', motivo: { codice: 'turnoEscluso', codiceTurno: 'M1' } },
    ]);
  });

  it('fuori servizio quel giorno (assunto il 10)', () => {
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', {}, { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-10') })]),
    );
    expect(esito.nonDisponibili).toEqual([
      { dipendenteId: 'B', motivo: { codice: 'fuoriServizio' } },
    ]);
  });

  it('priorità dei motivi: fuori servizio > assente > escluso > già in servizio > ha già il turno', () => {
    const esito = classifica(
      dati(
        TURNO,
        [
          A_M1,
          riga('B', { '05': cella('F') }, { ...CONTRATTO_PIENO, dataCessazione: d('2026-11-04') }),
          riga('C', { '05': cella('F') }),
          riga('D', { '04': cella('G1') }),
          riga('E', { '05': cella('S1') }),
        ],
        { turniEsclusi: { C: [codiceTurno('M1')], D: [codiceTurno('M1')] } },
      ),
    );
    expect(esito.nonDisponibili.map((n) => [n.dipendenteId, n.motivo.codice])).toEqual([
      ['B', 'fuoriServizio'],
      ['C', 'assente'],
      ['D', 'turnoEscluso'],
      ['E', 'haGiaTurno'],
    ]);
  });

  it.each([
    [
      'reperibilità sovrapposta (R5 16-20 contro R1 14-20)',
      cella('R5'),
      {
        codice: 'giaInServizio',
        tipo: 'reperibilita',
        giorno: '2026-11-05',
        codiceTurno: 'R5',
        inizio: '16:00',
        fine: '20:00',
      },
    ],
    [
      'già 2 reperibilità che non si sovrappongono (R3 e R2)',
      cella('R3', 'R2'),
      { codice: 'massimoReperibilita' },
    ],
    ['assente per ferie', cella('F'), { codice: 'assente', codiceAssenza: 'F' }],
  ] as const)('reperibilità scoperta R1 14:00-20:00: %s', (_d, c, motivo) => {
    const esito = classifica(
      dati(rep('R1'), [riga('A', { '05': cella('MA', 'R1') }), riga('B', { '05': c })]),
    );
    expect(esito.nonDisponibili).toEqual([{ dipendenteId: 'B', motivo }]);
  });

  it('reperibilità scoperta: un turno del giorno dopo sovrapposto esclude, uno che tocca no', () => {
    const esito = classifica(
      dati(rep('R2'), [
        A_R2,
        riga('B', { '06': cella('M1') }), // 07:00 del 6 dentro 20:00-08:00
        riga('C', { '06': conTurno('08:00') }), // inizia alle 08:00: tocca
      ]),
    );
    expect(ids(esito.disponibili)).toEqual(['C']);
    expect(esito.nonDisponibili[0]).toMatchObject({
      dipendenteId: 'B',
      motivo: { codice: 'giaInServizio', giorno: '2026-11-06', codiceTurno: 'M1' },
    });
  });

  it('reperibilità scoperta: la fascia esclusa del candidato', () => {
    const esito = classifica(
      dati(rep('R2'), [A_R2, riga('B', {})], { turniEsclusi: { B: [codiceTurno('R2')] } }),
    );
    expect(esito.nonDisponibili[0]?.motivo).toEqual({ codice: 'turnoEscluso', codiceTurno: 'R2' });
  });

  it('reperibilità scoperta: una reperibilità che il candidato copre per un collega conta come sua', () => {
    const sostituisce: CellaDoc = {
      ...cella(),
      reperibilita: [reperibilitaDiProva('R5', [], { sostituisce: 'X' })],
    };
    const esito = classifica(
      dati(rep('R1'), [riga('A', { '05': cella('MA', 'R1') }), riga('B', { '05': sostituisce })]),
    );
    expect(esito.nonDisponibili[0]?.motivo).toMatchObject({
      codice: 'giaInServizio',
      tipo: 'reperibilita',
    });
  });
});

/** Un turno principale con l'inizio dato e 6 ore di durata (per i casi dei bordi). */
function conTurno(inizio: string): CellaDoc {
  const [ore = '0'] = inizio.split(':');
  const fine = `${String((Number(ore) + 6) % 24).padStart(2, '0')}:00`;
  return {
    ...cella(),
    turno: {
      codice: codiceTurno('T1'),
      inizio: o(inizio),
      fine: o(fine),
      pausaMinuti: 0,
      notturno: false,
    },
  };
}

describe('classificaSostituti: riposo di 11 ore', () => {
  it('chi non avrebbe 11 ore prima resta in elenco, in fondo, marcato con i minuti', () => {
    // P1 del 4 finisce alle 22:00, M1 del 5 inizia alle 07:00: 9 ore.
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', { '04': cella('P1') }), riga('C', {})], {
        riepiloghi: [riepilogo('C', '2026-10', { M1: 5 })],
      }),
    );
    expect(ids(esito.disponibili)).toEqual(['C', 'B']);
    expect(esito.disponibili[1]).toMatchObject({ riposo: { prima: 540, dopo: null } });
  });

  it('chi non avrebbe 11 ore dopo è marcato con i minuti dopo', () => {
    // P1 scoperto il 5 (fine 22:00), M1 del candidato il 6 alle 07:00: 9 ore.
    const esito = classifica(
      dati(TURNO, [riga('A', { '05': cella('P1', 'MA') }), riga('B', { '06': cella('M1') })]),
    );
    expect(esito.disponibili[0]).toMatchObject({ riposo: { prima: null, dopo: 540 } });
  });

  it.each([
    ['11 ore esatte: non marcato', '20:00', null],
    ['un minuto in meno: marcato', '20:01', { prima: 659, dopo: null }],
  ] as const)('%s', (_d, uscita, riposo) => {
    const esito = classifica(
      dati(TURNO, [
        A_M1,
        riga('B', { '04': cella('P1', { orarioReale: { inizio: o('14:00'), fine: o(uscita) } }) }),
      ]),
    );
    expect(esito.disponibili[0]?.riposo).toEqual(riposo);
  });

  it('una chiamata con ora di inizio la sera prima conta come lavoro (D8)', () => {
    const conChiamata = cella('R2', {
      chiamata: { codice: 'R2', chiamata: { durataMinuti: 120, oraInizio: o('23:00') } },
    }); // fine dell'intervento alle 01:00 del 5: 6 ore prima di M1
    const esito = classifica(dati(TURNO, [A_M1, riga('B', { '04': conChiamata })]));
    expect(esito.disponibili[0]).toMatchObject({ reperibile: true, riposo: { prima: 360 } });
  });

  it('per una reperibilità scoperta il riposo non si valuta (una reperibilità senza chiamata non è lavoro)', () => {
    const esito = classifica(
      dati(rep('R3'), [riga('A', { '05': cella('MA', 'R3') }), riga('B', { '04': cella('P1') })]),
    );
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', riposo: null });
  });
});

function riepilogo(
  dipendenteId: string,
  mese: string,
  conteggiPerCodice: Record<string, number>,
): RiepilogoPerClassifica {
  return { dipendenteId, chiaveMese: m(mese), conteggiPerCodice };
}

describe('classificaSostituti: conteggio, saldo e ordine', () => {
  it('conta le volte su mese corrente (dalla griglia) e 12 mesi precedenti (dai riepiloghi)', () => {
    const esito = classifica(
      dati(
        TURNO,
        [
          A_M1,
          // nella griglia di novembre: M1 il 2 e il 3, M1 coperto da un collega il 9 (non conta), sostituzione il 10
          riga('B', {
            '02': cella('M1'),
            '03': cella('M1'),
            '09': cella('M1', 'F', { copertoDa: 'X' }),
            '10': cella('M1', { sostituisce: 'X' }),
          }),
        ],
        {
          riepiloghi: [
            riepilogo('B', '2026-10', { M1: 2, P1: 7 }),
            riepilogo('B', '2026-10', { M1: 2 }), // doppione dello stesso mese: conta una volta
            riepilogo('B', '2025-11', { M1: 1 }), // 12 mesi prima: entra
            riepilogo('B', '2025-10', { M1: 5 }), // 13 mesi prima: fuori
            riepilogo('B', '2026-11', { M1: 9 }), // mese corrente: vale la griglia
            riepilogo('B', '2026-12', { M1: 9 }), // mese dopo: fuori
            riepilogo('C', '2026-10', { M1: 4 }), // altro dipendente
          ],
        },
      ),
    );
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', volte: 3 + 2 + 1 });
  });

  // Review 3.1a, rilievo 5: una sola regola sui doppioni di riepilogo in tutto il dominio (come `bancaOreAnno`).
  it('con due riepiloghi dello stesso dipendente e mese vale l’ultimo', () => {
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', {})], {
        riepiloghi: [riepilogo('B', '2026-10', { M1: 7 }), riepilogo('B', '2026-10', { M1: 2 })],
      }),
    );
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', volte: 2 });
  });

  it('per una reperibilità conta il codice della fascia, solo le reperibilità a carico del candidato', () => {
    const esito = classifica(
      dati(
        rep('R2'),
        [
          A_R2,
          riga('B', {
            '02': cella('R2'),
            '03': cella('MA', 'R2'), // in malattia: non è sua
            '09': { ...cella(), reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'X' })] },
          }),
        ],
        { riepiloghi: [riepilogo('B', '2026-09', { R2: 4, M1: 10 })] },
      ),
    );
    expect(esito.disponibili[0]).toMatchObject({ dipendenteId: 'B', volte: 5 });
  });

  it('ordine: meno volte prima; pari merito per saldo più basso, saldo sconosciuto dopo, poi l’ordine delle righe', () => {
    const vuota = (id: string): RigaConsuntivo => riga(id, {});
    const esito = classifica(
      dati(
        TURNO,
        [
          A_M1,
          vuota('G'),
          vuota('F'),
          vuota('E'),
          vuota('D'),
          vuota('C'),
          vuota('B'),
          riga('H', { '04': cella('P1') }),
        ],
        {
          riepiloghi: [
            riepilogo('B', '2026-10', { M1: 3 }),
            riepilogo('C', '2026-10', { M1: 1 }),
            riepilogo('D', '2026-10', { M1: 1 }),
            riepilogo('E', '2026-10', { M1: 1 }),
            riepilogo('F', '2026-10', { M1: 1 }),
            riepilogo('G', '2026-10', { M1: 1 }),
          ],
          // H ha 0 volte ma non avrebbe 11 ore: in fondo comunque
          saldi: { B: -5000, C: 200, D: -100, E: 200, H: -9000 },
        },
      ),
    );
    // volte 1: D (−100), poi E e C (200, nell'ordine delle righe: E viene prima di C), poi G e F senza saldo
    // (nell'ordine delle righe); volte 3: B; in fondo H.
    expect(ids(esito.disponibili)).toEqual(['D', 'E', 'C', 'G', 'F', 'B', 'H']);
    expect(esito.disponibili.map((v) => v.saldoMinuti)).toEqual([
      -100,
      200,
      200,
      null,
      null,
      -5000,
      -9000,
    ]);
  });

  it('l’etichetta «Reperibile» non cambia l’ordine', () => {
    const esito = classifica(
      dati(TURNO, [A_M1, riga('B', {}), riga('C', { '05': cella('R3') })], {
        riepiloghi: [riepilogo('C', '2026-10', { M1: 1 })],
      }),
    );
    expect(ids(esito.disponibili)).toEqual(['B', 'C']);
    expect(esito.disponibili.map((v) => v.reperibile)).toEqual([false, true]);
  });

  it('l’assente non compare; i non disponibili restano nell’ordine delle righe', () => {
    const esito = classifica(
      dati(TURNO, [riga('Z', { '05': cella('F') }), A_M1, riga('Y', { '05': cella('P1') })]),
    );
    expect(ids(esito.nonDisponibili)).toEqual(['Z', 'Y']);
    expect(esito.disponibili).toEqual([]);
  });
});

describe('classificaSostituti: dati che non indicano un turno o una reperibilità dell’assente', () => {
  it.each([
    ['nessuna riga dell’assente', TURNO, [] as RigaConsuntivo[]],
    ['nessun turno nella cella', TURNO, [riga('A', { '05': cella('MA') })]],
    ['nessuna reperibilità con quel codice', rep('R1'), [A_R2]],
  ] as const)('%s: null', (_d, oggetto, righe) => {
    expect(classificaSostituti(dati(oggetto, righe))).toBeNull();
  });

  it('un giorno che il mese non ha: null', () => {
    expect(classificaSostituti(dati(TURNO, [A_M1], { giorno: '31' }))).toBeNull();
  });
});
