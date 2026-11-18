// validaRiga (ARCHITETTURA §5.9): forma delle celle e regole della singola riga, solo con riga e mese.
import { describe, expect, it } from 'vitest';
import type { CellaDoc } from '../documenti';
import {
  CONTRATTO_PIENO,
  cella,
  d,
  m,
  o,
  reperibilitaDiProva,
  riga,
  turnoDiProva,
} from '../test-utili';
import { soloBlocchi, validaRiga } from './valida-riga';

const NOVEMBRE = { chiaveMese: m('2026-11') };
const chiamata = (durataMinuti: number, oraInizio: string | null = null) => ({
  durataMinuti,
  oraInizio: oraInizio === null ? null : o(oraInizio),
});
const conChiamate = (codice: string, chiamate: ReturnType<typeof chiamata>[]): CellaDoc => ({
  ...cella(),
  reperibilita: [reperibilitaDiProva(codice, chiamate)],
});

/** Codici dei problemi trovati in una riga con una sola cella il giorno 10 (o nel giorno indicato). */
function problemi(c: unknown, giorno = '10', chiaveMese = NOVEMBRE.chiaveMese): string[] {
  return validaRiga(
    { dipendenteId: 'a', contratto: CONTRATTO_PIENO, giorni: { [giorno]: c } },
    { chiaveMese },
  ).map((p) => p.codice);
}

describe('validaRiga: righe valide', () => {
  it('una riga piena e corretta non ha problemi', () => {
    expect(
      validaRiga(
        riga('a', {
          '01': cella('M1'),
          '02': cella('N1', 'R1'),
          '03': cella('M1', 'MA', { copertoDa: 'b' }),
          '04': cella('P1', {
            sostituisce: 'c',
            orarioReale: { inizio: o('14:00'), fine: o('22:30') },
          }),
          '05': cella('R', 'R1', 'R2'),
          '06': conChiamate('R2', [chiamata(720, '20:00')]),
          '07': conChiamate('R1', [chiamata(30, '19:59')]),
          '08': cella('G1'),
          '09': cella('S1'),
          '30': cella('F'),
        }),
        NOVEMBRE,
      ),
    ).toEqual([]);
  });

  it('una riga vuota non ha problemi', () => {
    expect(validaRiga(riga('a', {}), NOVEMBRE)).toEqual([]);
  });
});

describe('validaRiga: giorni', () => {
  it.each([
    ['31', '2026-11', ['giornoInesistente']],
    ['00', '2026-11', ['giornoInesistente']],
    ['1', '2026-11', ['giornoInesistente']],
    ['29', '2026-02', ['giornoInesistente']],
    ['29', '2028-02', []],
  ])('giorno %s di %s → %o', (giorno, mese, attesi) => {
    expect(problemi(cella('M1'), giorno, m(mese))).toEqual(attesi);
  });

  it('riporta riga, giorno e livello', () => {
    expect(
      validaRiga(
        { dipendenteId: 'a', contratto: CONTRATTO_PIENO, giorni: { '31': cella('M1') } },
        NOVEMBRE,
      ),
    ).toEqual([
      { livello: 'blocco', codice: 'giornoInesistente', dipendenteId: 'a', chiaveGiorno: '31' },
    ]);
  });
});

describe('validaRiga: forma della cella', () => {
  const buona = cella('M1');
  it.each<[string, unknown]>([
    ['non è un oggetto', 'M1'],
    ['null', null],
    [
      'campo mancante',
      { turno: buona.turno, assenza: null, reperibilita: [], orarioReale: null, sostituisce: null },
    ],
    ['campo in più', { ...buona, nota: 'x' }],
    ['codice di turno minuscolo', { ...buona, turno: { ...turnoDiProva('M1'), codice: 'm1' } }],
    ['ora non valida', { ...buona, turno: { ...turnoDiProva('M1'), fine: '24:00' } }],
    ['pausa oltre 240', { ...buona, turno: { ...turnoDiProva('M1'), pausaMinuti: 300 } }],
    ['pausa non intera', { ...buona, turno: { ...turnoDiProva('M1'), pausaMinuti: 30.5 } }],
    [
      'codice di assenza non valido',
      { ...cella(), assenza: { codice: 'MAL', effetto: 'neutra', malattia: true } },
    ],
    [
      'effetto sconosciuto',
      { ...cella(), assenza: { codice: 'F', effetto: 'ferie', malattia: false } },
    ],
    ['reperibilità non è un elenco', { ...cella(), reperibilita: null }],
    ['chiamata di durata zero', conChiamate('R1', [chiamata(0)])],
    ['sostituisce vuoto', { ...buona, sostituisce: '' }],
  ])('%s → cellaMalformata', (_titolo, c) => {
    expect(problemi(c)).toEqual(['cellaMalformata']);
  });
});

describe('validaRiga: regole della cella', () => {
  const tre: CellaDoc = {
    ...cella('R1', 'R2'),
    reperibilita: [...cella('R1', 'R2').reperibilita, reperibilitaDiProva('R3')],
  };
  it.each<[string, unknown, string[]]>([
    [
      'notturno incoerente',
      { ...cella(), turno: { ...turnoDiProva('M1'), notturno: true } },
      ['notturnoIncoerente'],
    ],
    [
      'notte non marcata notturna',
      { ...cella(), turno: { ...turnoDiProva('N1'), notturno: false } },
      ['notturnoIncoerente'],
    ],
    ['assenza come riposo con turno', cella('M1', 'R'), ['assenzaComeRiposoSuTurno']],
    ['tre reperibilità', tre, ['troppeReperibilita']],
    [
      'reperibilità ripetuta',
      { ...cella(), reperibilita: [reperibilitaDiProva('R1'), reperibilitaDiProva('R1')] },
      ['reperibilitaRipetuta'],
    ],
    ['due chiamate', conChiamate('R1', [chiamata(10), chiamata(20)]), ['troppeChiamate']],
    [
      'chiamata più lunga della fascia (6 ore)',
      conChiamate('R1', [chiamata(361)]),
      ['durataChiamataNonValida'],
    ],
    ['chiamata lunga quanto la fascia', conChiamate('R1', [chiamata(360)]), []],
    [
      'chiamata prima della fascia',
      conChiamate('R1', [chiamata(30, '13:59')]),
      ['oraChiamataFuoriFascia'],
    ],
    [
      'chiamata alla fine della fascia',
      conChiamate('R1', [chiamata(30, '20:00')]),
      ['oraChiamataFuoriFascia'],
    ],
    ['chiamata all’inizio della fascia', conChiamate('R1', [chiamata(30, '14:00')]), []],
    ['notte: chiamata alle 03:00', conChiamate('R2', [chiamata(30, '03:00')]), []],
    [
      'notte: chiamata alle 12:00',
      conChiamate('R2', [chiamata(30, '12:00')]),
      ['oraChiamataFuoriFascia'],
    ],
    [
      'orario reale sul riposo',
      cella('R', { orarioReale: { inizio: o('07:00'), fine: o('14:00') } }),
      ['orarioRealeSenzaTurnoSvolto'],
    ],
    [
      'orario reale sul turno scoperto',
      cella('M1', 'MA', { orarioReale: { inizio: o('07:00'), fine: o('14:00') } }),
      ['orarioRealeSenzaTurnoSvolto'],
    ],
    ['sostituisce se stesso', cella('M1', { sostituisce: 'a' }), ['riferimentoASeStesso']],
    ['coperto da se stesso', cella('M1', 'MA', { copertoDa: 'a' }), ['riferimentoASeStesso']],
    [
      'reperibilità coperta da se stesso',
      { ...cella(), reperibilita: [reperibilitaDiProva('R1', [], { copertaDa: 'a' })] },
      ['riferimentoASeStesso'],
    ],
    [
      'copertoDa senza turno scoperto',
      cella('M1', { copertoDa: 'b' }),
      ['copertoDaSenzaTurnoScoperto'],
    ],
    ['sostituisce senza turno', cella('MA', { sostituisce: 'b' }), ['sostituisceSenzaTurnoSvolto']],
    [
      'sostituisce su turno scoperto',
      cella('M1', 'MA', { sostituisce: 'b' }),
      ['sostituisceSenzaTurnoSvolto'],
    ],
  ])('%s → %o', (_titolo, c, attesi) => {
    expect(problemi(c)).toEqual(attesi);
  });

  it.each([
    ['2026-03', '28', 660, []], // la notte del 28/03/2026 dura 11 ore reali
    ['2026-03', '28', 661, ['durataChiamataNonValida']],
    ['2026-10', '24', 780, []], // la notte del 24/10/2026 dura 13 ore reali
  ])('R2 del %s-%s: chiamata di %i minuti → %o', (mese, giorno, durata, attesi) => {
    expect(problemi(conChiamate('R2', [chiamata(durata)]), giorno, m(mese))).toEqual(attesi);
  });
});

describe('validaRiga: contratto e giorni di servizio', () => {
  it.each([
    [{ ...CONTRATTO_PIENO, oreSettimanali: 50 }],
    [{ ...CONTRATTO_PIENO, oreSettimanali: 36.2 }],
    [{ ...CONTRATTO_PIENO, dataAssunzione: '2026-02-30' }],
    [{ oreSettimanali: 36, dataAssunzione: d('2026-11-20'), dataCessazione: d('2026-11-10') }],
  ])('contratto non valido: %o', (contratto) => {
    expect(validaRiga({ dipendenteId: 'a', contratto, giorni: {} }, NOVEMBRE)).toEqual([
      { livello: 'blocco', codice: 'contrattoNonValido', dipendenteId: 'a', chiaveGiorno: null },
    ]);
  });

  it('contenuto fuori servizio: avviso (assunto il 16, cessato il 13)', () => {
    const assunto = { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-16') };
    expect(
      validaRiga(
        riga('a', { '15': cella('M1'), '16': cella('M1'), '20': cella() }, assunto),
        NOVEMBRE,
      ),
    ).toEqual([
      { livello: 'avviso', codice: 'fuoriServizio', dipendenteId: 'a', chiaveGiorno: '15' },
    ]);
    const cessato = { ...CONTRATTO_PIENO, dataCessazione: d('2026-11-13') };
    expect(
      validaRiga(
        riga('a', { '13': cella('M1'), '14': cella('R'), '15': cella() }, cessato),
        NOVEMBRE,
      ),
    ).toEqual([
      { livello: 'avviso', codice: 'fuoriServizio', dipendenteId: 'a', chiaveGiorno: '14' },
    ]);
  });
});

describe('soloBlocchi', () => {
  it('tiene i blocchi e scarta gli avvisi', () => {
    const assunto = { ...CONTRATTO_PIENO, dataAssunzione: d('2026-11-16') };
    const trovati = validaRiga(
      riga('a', { '15': cella('M1'), '20': cella('M1', 'R') }, assunto),
      NOVEMBRE,
    );
    expect(trovati.map((p) => p.codice)).toEqual(['fuoriServizio', 'assenzaComeRiposoSuTurno']);
    expect(soloBlocchi(trovati).map((p) => p.codice)).toEqual(['assenzaComeRiposoSuTurno']);
  });
});
