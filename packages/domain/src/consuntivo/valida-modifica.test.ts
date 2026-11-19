// validaModifica (PIANO 3.1a criterio 6, D2, L21, L37, L38): una modifica di consuntivo su un mese in bozza dà
// le righe risultanti e gli avvisi, oppure il blocco con il motivo; su un mese convalidato è sempre un blocco.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import type { CellaDoc, Chiamata, OrarioReale } from '../documenti';
import {
  assenzaDiProva,
  CONTRATTO_PIENO,
  cella,
  d,
  m,
  o,
  reperibilitaDiProva,
  riga,
  turnoDiProva,
} from '../test-utili';
import type { RigaConsuntivo } from './sostituzione';
import {
  validaModifica,
  type ContestoModifica,
  type EsitoModifica,
  type ModificaConsuntivo,
} from './valida-modifica';

const orario = (inizio: string, fine: string): OrarioReale => ({
  inizio: o(inizio),
  fine: o(fine),
});
const R1 = codiceTurno('R1');
const R2 = codiceTurno('R2');

function contesto(altro: Partial<ContestoModifica> = {}): ContestoModifica {
  return {
    chiaveMese: m('2026-11'),
    statoMese: 'bozza',
    turniEsclusi: {},
    righeAdiacenti: {},
    collega: null,
    ...altro,
  };
}

function consentita(esito: EsitoModifica): Extract<EsitoModifica, { esito: 'consentita' }> {
  if (esito.esito !== 'consentita') {
    throw new Error(`bloccata: ${esito.motivo}`);
  }
  return esito;
}

const codiciAvvisi = (
  esito: Extract<EsitoModifica, { esito: 'consentita' }>,
  id: string,
): string[] =>
  esito.avvisi.find((a) => a.dipendenteId === id)?.segnalazioni.map((s) => s.codice) ?? [];

describe('validaModifica: mese convalidato (D2)', () => {
  const modifiche: [string, ModificaConsuntivo][] = [
    ['orario reale', { tipo: 'orarioReale', giorno: '05', orario: orario('07:00', '14:30') }],
    ['assenza', { tipo: 'assenza', giorni: ['05'], assenza: assenzaDiProva('MA') }],
    [
      'sostituzione',
      { tipo: 'sostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
    ],
    [
      'rimozione della sostituzione',
      { tipo: 'rimuoviSostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
    ],
    [
      'chiamata',
      {
        tipo: 'chiamate',
        giorno: '05',
        codice: R1,
        chiamate: [{ durataMinuti: 30, oraInizio: null }],
      },
    ],
  ];
  it.each(modifiche)('%s: sempre bloccata', (_d, modifica) => {
    const esito = validaModifica(
      riga('A', { '05': cella('M1', 'R1') }),
      modifica,
      contesto({ statoMese: 'convalidato', collega: riga('B', {}) }),
    );
    expect(esito).toEqual({
      esito: 'bloccata',
      motivo: 'meseConvalidato',
      giorno: null,
      codici: [],
    });
  });
});

describe('validaModifica: orari reali', () => {
  it('M1 con uscita alle 14:30: la riga risultante ha l’orario reale, nessun avviso', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '05': cella('M1') }),
        { tipo: 'orarioReale', giorno: '05', orario: orario('07:00', '14:30') },
        contesto(),
      ),
    );
    expect(esito.righe).toEqual([
      riga('A', { '05': cella('M1', { orarioReale: orario('07:00', '14:30') }) }),
    ]);
    expect(esito.avvisi).toEqual([{ dipendenteId: 'A', segnalazioni: [] }]);
  });

  it('null toglie l’orario reale; un orario uguale al previsto non si conserva', () => {
    const conReale = riga('A', { '05': cella('M1', { orarioReale: orario('07:00', '14:30') }) });
    const tolto = consentita(
      validaModifica(conReale, { tipo: 'orarioReale', giorno: '05', orario: null }, contesto()),
    );
    expect(tolto.righe[0]?.giorni['05']).toEqual(cella('M1'));
    const uguale = consentita(
      validaModifica(
        conReale,
        { tipo: 'orarioReale', giorno: '05', orario: orario('07:00', '14:00') },
        contesto(),
      ),
    );
    expect(uguale.righe[0]?.giorni['05']).toEqual(cella('M1'));
  });

  it('sul turno di una sostituzione è consentito', () => {
    const esito = consentita(
      validaModifica(
        riga('B', { '05': cella('M1', { sostituisce: 'A' }) }),
        { tipo: 'orarioReale', giorno: '05', orario: orario('06:45', '14:00') },
        contesto(),
      ),
    );
    expect(esito.righe[0]?.giorni['05']?.orarioReale).toEqual(orario('06:45', '14:00'));
  });

  it('un’uscita più tarda che lascia meno di 11 ore: consentita con l’avviso di riposo', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '04': cella('P1'), '05': cella('M1') }),
        { tipo: 'orarioReale', giorno: '04', orario: orario('14:00', '22:30') },
        contesto(),
      ),
    );
    expect(esito.avvisi[0]?.segnalazioni).toEqual([
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: d('2026-11-05'),
        giornoPrecedente: d('2026-11-04'),
        minutiRiposo: 510,
        origine: 'turno',
      },
    ]);
  });

  it('gli avvisi usano le righe adiacenti dello stesso dipendente', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '01': cella('M1') }),
        { tipo: 'orarioReale', giorno: '01', orario: orario('07:00', '14:00') },
        contesto({
          righeAdiacenti: { A: { precedente: { '31': cella('P1') }, successiva: null } },
        }),
      ),
    );
    expect(codiciAvvisi(esito, 'A')).toEqual(['riposoInsufficiente']);
  });

  it.each([
    ['turno scoperto', cella('M1', 'MA'), '05', 'turnoNonSvolto'],
    ['cella senza turno', cella('R1'), '05', 'turnoNonSvolto'],
    ['cella vuota', null, '05', 'turnoNonSvolto'],
    ['giorno che il mese non ha', null, '31', 'giornoInesistente'],
  ] as const)('bloccata: %s', (_d, c, giorno, motivo) => {
    const giorni: Partial<Record<'05', CellaDoc>> = c === null ? {} : { '05': c };
    expect(
      validaModifica(
        riga('A', giorni),
        { tipo: 'orarioReale', giorno, orario: orario('07:00', '14:30') },
        contesto(),
      ),
    ).toEqual({ esito: 'bloccata', motivo, giorno, codici: [] });
  });

  it('bloccata se la cella risultante non è valida per validaRiga (notturno incoerente già salvato)', () => {
    const malformata: CellaDoc = {
      ...cella('M1'),
      turno: { ...turnoDiProva('M1'), notturno: true },
    };
    expect(
      validaModifica(
        riga('A', { '05': malformata }),
        { tipo: 'orarioReale', giorno: '05', orario: orario('07:00', '14:30') },
        contesto(),
      ),
    ).toEqual({
      esito: 'bloccata',
      motivo: 'rigaNonValida',
      giorno: '05',
      codici: ['notturnoIncoerente'],
    });
  });
});

describe('validaModifica: assenza su più giorni', () => {
  it('malattia di 3 giorni sui turni previsti: tre turni scoperti (avvisi)', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '04': cella('M1'), '05': cella('M1'), '06': cella('P1', 'R1') }),
        { tipo: 'assenza', giorni: ['04', '05', '06'], assenza: assenzaDiProva('MA') },
        contesto(),
      ),
    );
    expect(esito.righe[0]?.giorni).toEqual({
      '04': cella('M1', 'MA'),
      '05': cella('M1', 'MA'),
      '06': cella('P1', 'MA', 'R1'),
    });
    expect(codiciAvvisi(esito, 'A')).toEqual([
      'turnoScoperto',
      'turnoScoperto',
      'turnoScoperto',
      'reperibilitaScoperta',
    ]);
  });

  it('ferie su giorni vuoti, con turno e con riposo; i giorni ripetuti contano una volta', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '03': cella('M1'), '04': cella('R') }),
        { tipo: 'assenza', giorni: ['02', '03', '04', '03'], assenza: assenzaDiProva('F') },
        contesto(),
      ),
    );
    expect(esito.righe[0]?.giorni).toEqual({
      '02': cella('F'),
      '03': cella('M1', 'F'),
      '04': cella('F'),
    });
  });

  it('un’assenza come riposo sostituisce i turni', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '03': cella('M1') }),
        { tipo: 'assenza', giorni: ['03'], assenza: assenzaDiProva('R') },
        contesto(),
      ),
    );
    expect(esito.righe[0]?.giorni['03']).toEqual(cella('R'));
  });

  it.each([
    [
      'un giorno ha dati di consuntivo (orario reale): tutta l’assenza è bloccata',
      { '04': cella('M1'), '05': cella('M1', { orarioReale: orario('07:00', '15:00') }) },
      ['04', '05'],
      CONTRATTO_PIENO,
      'consuntivo',
      '05',
    ],
    [
      'un giorno è fuori servizio',
      {},
      ['09', '10'],
      { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-10') },
      'fuoriServizio',
      '09',
    ],
    ['nessun giorno', {}, [], CONTRATTO_PIENO, 'nessunGiorno', null],
    ['un giorno che il mese non ha', {}, ['30', '31'], CONTRATTO_PIENO, 'giornoInesistente', '31'],
  ] as const)('bloccata: %s', (_d, giorni, giorniAssenza, contratto, motivo, giorno) => {
    expect(
      validaModifica(
        riga('A', giorni, contratto),
        { tipo: 'assenza', giorni: giorniAssenza, assenza: assenzaDiProva('MA') },
        contesto(),
      ),
    ).toEqual({ esito: 'bloccata', motivo, giorno, codici: [] });
  });
});

describe('validaModifica: sostituzione', () => {
  const assente = riga('A', { '05': cella('M1', 'MA') });

  it('modifica insieme le due righe e restituisce gli avvisi di entrambe', () => {
    const esito = consentita(
      validaModifica(
        assente,
        { tipo: 'sostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        contesto({ collega: riga('B', { '04': cella('P1') }) }),
      ),
    );
    expect(esito.righe).toEqual([
      riga('A', { '05': cella('M1', 'MA', { copertoDa: 'B' }) }),
      riga('B', { '04': cella('P1'), '05': cella('M1', { sostituisce: 'A' }) }),
    ]);
    // A non ha più il turno scoperto; B ha 9 ore di riposo tra P1 del 4 e M1 del 5 (avviso, non blocco)
    expect(codiciAvvisi(esito, 'A')).toEqual([]);
    expect(codiciAvvisi(esito, 'B')).toEqual(['riposoInsufficiente']);
  });

  it('reperibilità scoperta coperta da un collega', () => {
    const esito = consentita(
      validaModifica(
        riga('A', { '05': cella('MA', 'R2') }),
        {
          tipo: 'sostituzione',
          giorno: '05',
          oggetto: { tipo: 'reperibilita', codice: R2 },
          sostitutoId: 'B',
        },
        contesto({ collega: riga('B', { '05': cella('M1') }) }),
      ),
    );
    expect(esito.righe[1]?.giorni['05']?.reperibilita).toEqual([
      reperibilitaDiProva('R2', [], { sostituisce: 'A' }),
    ]);
    expect(codiciAvvisi(esito, 'A')).toEqual([]);
  });

  it.each([
    ['manca la riga del collega', null, {}, 'rigaCollegaMancante', '05'],
    ['la riga del collega è di un altro', riga('C', {}), {}, 'rigaCollegaMancante', '05'],
    [
      'il collega ha il turno tra gli esclusi',
      riga('B', {}),
      { B: [codiceTurno('M1')] },
      'turnoEscluso',
      '05',
    ],
    [
      'il collega è già in servizio (G1 del giorno prima)',
      riga('B', { '04': cella('G1') }),
      {},
      'giaInServizio',
      '05',
    ],
    ['il collega ha già un turno', riga('B', { '05': cella('P1') }), {}, 'haGiaTurno', '05'],
    ['il collega è assente', riga('B', { '05': cella('F') }), {}, 'assente', '05'],
    [
      'il collega è fuori servizio',
      riga('B', {}, { ...CONTRATTO_PIENO, dataCessazione: d('2026-11-04') }),
      {},
      'fuoriServizio',
      '05',
    ],
  ] as const)('bloccata: %s', (_d, collega, turniEsclusi, motivo, giorno) => {
    expect(
      validaModifica(
        assente,
        { tipo: 'sostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        contesto({ collega, turniEsclusi }),
      ),
    ).toEqual({ esito: 'bloccata', motivo, giorno, codici: [] });
  });

  it.each([
    ['il turno non è scoperto', riga('A', { '05': cella('M1') }), 'nonScoperto'],
    [
      'il turno è già coperto',
      riga('A', { '05': cella('M1', 'MA', { copertoDa: 'C' }) }),
      'giaCoperto',
    ],
  ] as const)('bloccata: %s', (_d, rigaAssente, motivo) => {
    expect(
      validaModifica(
        rigaAssente,
        { tipo: 'sostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        contesto({ collega: riga('B', {}) }),
      ),
    ).toEqual({ esito: 'bloccata', motivo, giorno: '05', codici: [] });
  });

  it('il sostituto non può essere l’assente', () => {
    expect(
      validaModifica(
        assente,
        { tipo: 'sostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'A' },
        contesto({ collega: assente }),
      ),
    ).toEqual({ esito: 'bloccata', motivo: 'stessoDipendente', giorno: '05', codici: [] });
  });

  it('rimozione: le due righe tornano come prima', () => {
    const coperta = riga('A', { '05': cella('M1', 'MA', { copertoDa: 'B' }) });
    const esito = consentita(
      validaModifica(
        coperta,
        { tipo: 'rimuoviSostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        contesto({ collega: riga('B', { '05': cella('M1', { sostituisce: 'A' }) }) }),
      ),
    );
    expect(esito.righe).toEqual([riga('A', { '05': cella('M1', 'MA') }), riga('B', {})]);
    expect(codiciAvvisi(esito, 'A')).toEqual(['turnoScoperto']);
  });

  it('rimozione di una sostituzione che non c’è: bloccata', () => {
    expect(
      validaModifica(
        assente,
        { tipo: 'rimuoviSostituzione', giorno: '05', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        contesto({ collega: riga('B', {}) }),
      ),
    ).toEqual({ esito: 'bloccata', motivo: 'sostituzioneAssente', giorno: '05', codici: [] });
  });
});

describe('validaModifica: chiamate (L21, L38)', () => {
  const conR1 = riga('A', { '05': cella('M1', 'R1') }); // R1 14:00-20:00, 360 minuti
  const chiamate = (
    rigaBase: RigaConsuntivo,
    elenco: Chiamata[],
    codice = R1,
    giorno: '05' | '24' = '05',
    altro: Partial<ContestoModifica> = {},
  ): EsitoModifica =>
    validaModifica(
      rigaBase,
      { tipo: 'chiamate', giorno, codice, chiamate: elenco },
      contesto(altro),
    );

  it('una chiamata con durata e ora dentro la fascia: consentita', () => {
    const esito = consentita(chiamate(conR1, [{ durataMinuti: 60, oraInizio: o('15:00') }]));
    expect(esito.righe[0]?.giorni['05']?.reperibilita[0]?.chiamate).toEqual([
      { durataMinuti: 60, oraInizio: '15:00' },
    ]);
  });

  it('un elenco vuoto toglie la chiamata', () => {
    const conChiamata = riga('A', {
      '05': cella('R1', {
        chiamata: { codice: 'R1', chiamata: { durataMinuti: 30, oraInizio: null } },
      }),
    });
    const esito = consentita(chiamate(conChiamata, []));
    expect(esito.righe[0]?.giorni['05']).toEqual(cella('R1'));
  });

  it.each([
    [
      'seconda chiamata nella stessa reperibilità (L21)',
      [
        { durataMinuti: 30, oraInizio: null },
        { durataMinuti: 20, oraInizio: null },
      ],
      'troppeChiamate',
    ],
    ['durata 0 (L38)', [{ durataMinuti: 0, oraInizio: null }], 'durataNonValida'],
    [
      'durata oltre quella della reperibilità: 361 su 360 (L38)',
      [{ durataMinuti: 361, oraInizio: null }],
      'durataNonValida',
    ],
    ['durata non intera', [{ durataMinuti: 30.5, oraInizio: null }], 'durataNonValida'],
    [
      'ora di inizio fuori dalla fascia (L38)',
      [{ durataMinuti: 30, oraInizio: o('21:00') }],
      'oraFuoriFascia',
    ],
    [
      'ora di inizio alla fine della fascia (esclusa)',
      [{ durataMinuti: 30, oraInizio: o('20:00') }],
      'oraFuoriFascia',
    ],
  ] as const)('bloccata: %s', (_d, elenco, motivo) => {
    expect(chiamate(conR1, [...elenco])).toEqual({
      esito: 'bloccata',
      motivo,
      giorno: '05',
      codici: [],
    });
  });

  it('durata massima nella notte del cambio d’ora: R2 20:00-08:00 del 24/10/2026 dura 780 minuti reali', () => {
    const ottobre = { chiaveMese: m('2026-10') };
    const conR2 = riga('A', { '24': cella('R2') });
    expect(chiamate(conR2, [{ durataMinuti: 780, oraInizio: null }], R2, '24', ottobre).esito).toBe(
      'consentita',
    );
    expect(
      chiamate(conR2, [{ durataMinuti: 781, oraInizio: null }], R2, '24', ottobre),
    ).toMatchObject({
      motivo: 'durataNonValida',
    });
  });

  it.each([
    [
      'la cella non ha quella reperibilità',
      riga('A', { '05': cella('M1') }),
      'reperibilitaAssente',
    ],
    [
      'la reperibilità è coperta da un collega',
      riga('A', {
        '05': { ...cella('MA'), reperibilita: [reperibilitaDiProva('R1', [], { copertaDa: 'B' })] },
      }),
      'reperibilitaCoperta',
    ],
    [
      'la reperibilità è scoperta (malattia)',
      riga('A', { '05': cella('MA', 'R1') }),
      'reperibilitaScoperta',
    ],
  ] as const)('bloccata: %s', (_d, rigaBase, motivo) => {
    expect(chiamate(rigaBase, [{ durataMinuti: 30, oraInizio: null }])).toEqual({
      esito: 'bloccata',
      motivo,
      giorno: '05',
      codici: [],
    });
  });

  it('con l’ora di inizio le 11 ore ripartono dalla fine dell’intervento (D8): avviso di riposo', () => {
    const rigaBase = riga('A', { '04': cella('R2'), '05': cella('M1') });
    const esito = consentita(
      validaModifica(
        rigaBase,
        {
          tipo: 'chiamate',
          giorno: '04',
          codice: R2,
          chiamate: [{ durataMinuti: 120, oraInizio: o('23:00') }],
        },
        contesto(),
      ),
    );
    expect(esito.avvisi[0]?.segnalazioni).toContainEqual({
      livello: 'avviso',
      codice: 'riposoInsufficiente',
      giorno: d('2026-11-05'),
      giornoPrecedente: d('2026-11-04'),
      minutiRiposo: 360,
      origine: 'chiamata',
    });
  });
});
