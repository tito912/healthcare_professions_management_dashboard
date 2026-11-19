// Differenze di consuntivo tra due versioni di una riga (PIANO 3.1b criterio 3): sono ciò che il trigger scrive nel
// registro attività. Solo orari reali, assenze, sostituzioni e chiamate; mai il piano (turni e fasce), mai nomi.
import { describe, expect, it } from 'vitest';
import type { CellaDoc } from '../documenti';
import { cella, m, o, reperibilitaDiProva } from '../test-utili';
import type { ChiaveGiorno } from '../tipi';
import { modificheConsuntivo, type DifferenzaConsuntivo } from './modifiche';

const NOVEMBRE = m('2026-11');
const giorni = (voci: Partial<Record<ChiaveGiorno, CellaDoc>>): Record<string, unknown> => ({
  ...voci,
});
const orario = (inizio: string, fine: string) => ({
  orarioReale: { inizio: o(inizio), fine: o(fine) },
});

function confronta(prima: unknown, dopo: unknown): readonly DifferenzaConsuntivo[] {
  return modificheConsuntivo(NOVEMBRE, prima, dopo);
}

describe('modificheConsuntivo', () => {
  it('nessuna differenza: nessuna voce', () => {
    const g = giorni({ '05': cella('M1', orario('07:00', '14:30')), '06': cella('P1') });
    expect(confronta(g, g)).toEqual([]);
    expect(confronta({}, {})).toEqual([]);
  });

  it('orario reale registrato, cambiato e tolto', () => {
    const base = giorni({ '05': cella('M1') });
    const registrato = giorni({ '05': cella('M1', orario('07:00', '14:30')) });
    const cambiato = giorni({ '05': cella('M1', orario('06:45', '14:30')) });
    expect(confronta(base, registrato)).toEqual([
      { giorno: '05', campo: 'orarioReale', prima: null, dopo: '07:00-14:30' },
    ]);
    expect(confronta(registrato, cambiato)).toEqual([
      { giorno: '05', campo: 'orarioReale', prima: '07:00-14:30', dopo: '06:45-14:30' },
    ]);
    expect(confronta(cambiato, base)).toEqual([
      { giorno: '05', campo: 'orarioReale', prima: '06:45-14:30', dopo: null },
    ]);
  });

  it('assenza su tre giorni (malattia sul turno): una voce per giorno, in ordine di giorno', () => {
    const prima = giorni({ '13': cella('M1'), '14': cella('M1'), '15': cella('M1') });
    const dopo = giorni({
      '13': cella('M1', 'MA'),
      '14': cella('M1', 'MA'),
      '15': cella('M1', 'MA'),
    });
    expect(confronta(prima, dopo)).toEqual([
      { giorno: '13', campo: 'assenza', prima: null, dopo: 'MA' },
      { giorno: '14', campo: 'assenza', prima: null, dopo: 'MA' },
      { giorno: '15', campo: 'assenza', prima: null, dopo: 'MA' },
    ]);
  });

  it('assenza cambiata e tolta', () => {
    expect(confronta(giorni({ '02': cella('F') }), giorni({ '02': cella('MA') }))).toEqual([
      { giorno: '02', campo: 'assenza', prima: 'F', dopo: 'MA' },
    ]);
    expect(confronta(giorni({ '02': cella('F') }), giorni({}))).toEqual([
      { giorno: '02', campo: 'assenza', prima: 'F', dopo: null },
    ]);
  });

  it('sostituzione: copertoDa sull’assente e sostituisce sul collega, solo ID', () => {
    const assente = confronta(
      giorni({ '14': cella('M1', 'MA') }),
      giorni({ '14': cella('M1', 'MA', { copertoDa: 'dipB' }) }),
    );
    expect(assente).toEqual([{ giorno: '14', campo: 'copertoDa', prima: null, dopo: 'dipB' }]);
    const sostituto = confronta(
      giorni({ '14': cella('R') }),
      giorni({ '14': cella('M1', { sostituisce: 'dipA' }) }),
    );
    // Il riposo che il turno sostituito lascia (R) è piano: non si annota.
    expect(sostituto).toEqual([{ giorno: '14', campo: 'sostituisce', prima: null, dopo: 'dipA' }]);
  });

  it('riposo e smonto sono piano: assegnarli, cambiarli o toglierli non dà voci; da e verso una neutra sì', () => {
    expect(confronta(giorni({}), giorni({ '02': cella('R'), '03': cella('S') }))).toEqual([]);
    expect(confronta(giorni({ '02': cella('R') }), giorni({ '02': cella('S') }))).toEqual([]);
    expect(confronta(giorni({ '02': cella('R') }), giorni({ '02': cella('F') }))).toEqual([
      { giorno: '02', campo: 'assenza', prima: 'R', dopo: 'F' },
    ]);
    expect(confronta(giorni({ '02': cella('MA') }), giorni({ '02': cella('R') }))).toEqual([
      { giorno: '02', campo: 'assenza', prima: 'MA', dopo: 'R' },
    ]);
  });

  it('chiamata di una reperibilità, con e senza ora di inizio; tolta', () => {
    const senza = giorni({ '08': cella('R2') });
    const con = giorni({
      '08': {
        ...cella(),
        reperibilita: [reperibilitaDiProva('R2', [{ durataMinuti: 45, oraInizio: o('23:10') }])],
      },
    });
    const soloDurata = giorni({
      '08': {
        ...cella(),
        reperibilita: [reperibilitaDiProva('R2', [{ durataMinuti: 30, oraInizio: null }])],
      },
    });
    expect(confronta(senza, con)).toEqual([
      { giorno: '08', campo: 'chiamate', prima: null, dopo: 'R2:45@23:10' },
    ]);
    expect(confronta(con, soloDurata)).toEqual([
      { giorno: '08', campo: 'chiamate', prima: 'R2:45@23:10', dopo: 'R2:30' },
    ]);
    expect(confronta(soloDurata, senza)).toEqual([
      { giorno: '08', campo: 'chiamate', prima: 'R2:30', dopo: null },
    ]);
  });

  it('sostituzione di una reperibilità: fascia coperta e fascia del sostituto', () => {
    const coperta = giorni({
      '09': {
        ...cella('MA'),
        reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'dipB' })],
      },
    });
    const prima = giorni({ '09': { ...cella('MA'), reperibilita: [reperibilitaDiProva('R2')] } });
    expect(confronta(prima, coperta)).toEqual([
      { giorno: '09', campo: 'reperibilitaCopertaDa', prima: null, dopo: 'R2:dipB' },
    ]);
    const sostituto = giorni({
      '09': { ...cella(), reperibilita: [reperibilitaDiProva('R2', [], { sostituisce: 'dipA' })] },
    });
    expect(confronta(giorni({}), sostituto)).toEqual([
      { giorno: '09', campo: 'reperibilitaSostituisce', prima: null, dopo: 'R2:dipA' },
    ]);
  });

  it('il piano non è consuntivo: turni e fasce aggiunti, tolti o cambiati non danno voci', () => {
    const prima = giorni({ '02': cella('M1'), '03': cella('P1', 'R1') });
    const dopo = giorni({ '02': cella('N1'), '04': cella('M1', 'R3'), '03': cella() });
    expect(confronta(prima, dopo)).toEqual([]);
  });

  it('riga appena creata: si confronta con una riga vuota, quindi solo il consuntivo già presente', () => {
    const nuova = giorni({ '05': cella('M1', 'MA'), '06': cella('P1') });
    expect(confronta(undefined, nuova)).toEqual([
      { giorno: '05', campo: 'assenza', prima: null, dopo: 'MA' },
    ]);
    expect(confronta(null, giorni({}))).toEqual([]);
  });

  it('più campi nello stesso giorno: ordine fisso dei campi; più giorni: ordine di giorno', () => {
    const prima = giorni({ '03': cella('M1'), '10': cella('M1') });
    const dopo = giorni({
      '03': cella('M1', 'MA', { copertoDa: 'dipB' }),
      '10': cella('M1', orario('07:00', '15:00')),
    });
    expect(confronta(prima, dopo).map((v) => `${v.giorno}:${v.campo}`)).toEqual([
      '03:assenza',
      '03:copertoDa',
      '10:orarioReale',
    ]);
  });

  it('ignora le celle non valide e le chiavi che il mese non ha, senza lanciare', () => {
    const prima = giorni({ '02': cella('M1') });
    const dopo: Record<string, unknown> = {
      '02': cella('M1', orario('07:00', '14:30')),
      '03': { turno: 'sbagliato' },
      '32': cella('M1', 'MA'),
    };
    expect(confronta(prima, dopo)).toEqual([
      { giorno: '02', campo: 'orarioReale', prima: null, dopo: '07:00-14:30' },
    ]);
    expect(confronta(prima, 'non una mappa')).toEqual([]);
    expect(confronta(prima, [1, 2])).toEqual([]);
  });

  it('nessun valore contiene testi liberi: solo codici, orari e ID', () => {
    const voci = confronta(
      giorni({ '05': cella('M1') }),
      giorni({ '05': cella('M1', 'MA', { copertoDa: 'dipB', ...orario('07:00', '14:30') }) }),
    );
    for (const voce of voci) {
      expect(`${voce.prima ?? ''}${voce.dopo ?? ''}`).toMatch(/^[A-Za-z0-9:@+,\-]*$/);
    }
  });
});
