// Sostituzioni (PIANO 3.1a criterio 5): `applicaSostituzione()` e `rimuoviSostituzione()` modificano insieme le
// due righe, con i riferimenti reciproci che `validaMese()` controlla (ARCHITETTURA §5.9).
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import type { CellaDoc } from '../documenti';
import { soloBlocchi, validaRiga } from '../griglia/valida-riga';
import { validaMese } from '../griglia/valida-mese';
import { cella, m, o, reperibilitaDiProva, riga } from '../test-utili';
import {
  applicaSostituzione,
  rimuoviSostituzione,
  type OggettoSostituzione,
  type RigaConsuntivo,
} from './sostituzione';

const TURNO: OggettoSostituzione = { tipo: 'turno' };
const R2: OggettoSostituzione = { tipo: 'reperibilita', codice: codiceTurno('R2') };

function applicata(esito: ReturnType<typeof applicaSostituzione>): {
  assente: RigaConsuntivo;
  sostituto: RigaConsuntivo;
} {
  if (esito.esito !== 'applicata') {
    throw new Error(`rifiutata: ${esito.motivo}`);
  }
  return esito;
}

function senzaErrori(...righe: RigaConsuntivo[]): void {
  for (const r of righe) {
    expect(soloBlocchi(validaRiga(r, { chiaveMese: m('2026-11') }))).toEqual([]);
  }
  expect(validaMese(righe)).toEqual([]);
}

describe('applicaSostituzione: turno principale', () => {
  it('il sostituto prende il turno con `sostituisce`, l’assente ha `copertoDa`; il riposo del sostituto si sostituisce', () => {
    const assente = riga('A', { '05': cella('M1', 'MA') });
    const sostituto = riga('B', { '05': cella('R', 'R1'), '06': cella('P1') });
    const copiaAssente = structuredClone(assente);
    const copiaSostituto = structuredClone(sostituto);
    const esito = applicata(applicaSostituzione(assente, sostituto, '05', TURNO));
    expect(esito.assente.giorni['05']).toEqual(cella('M1', 'MA', { copertoDa: 'B' }));
    expect(esito.sostituto.giorni['05']).toEqual(cella('M1', 'R1', { sostituisce: 'A' }));
    expect(esito.sostituto.giorni['06']).toEqual(cella('P1'));
    senzaErrori(esito.assente, esito.sostituto);
    // gli input non cambiano
    expect(assente).toEqual(copiaAssente);
    expect(sostituto).toEqual(copiaSostituto);
  });

  it('su una cella vuota del sostituto', () => {
    const esito = applicata(
      applicaSostituzione(riga('A', { '05': cella('N1', 'F') }), riga('B', {}), '05', TURNO),
    );
    expect(esito.sostituto.giorni['05']).toEqual(cella('N1', { sostituisce: 'A' }));
    expect(esito.sostituto.contratto).toEqual(riga('B', {}).contratto);
  });

  it.each([
    [
      'il sostituto è l’assente',
      riga('A', { '05': cella('M1', 'MA') }),
      'A',
      {},
      'stessoDipendente',
    ],
    [
      'il turno dell’assente non è scoperto',
      riga('A', { '05': cella('M1') }),
      'B',
      {},
      'nonScoperto',
    ],
    ['la cella dell’assente è vuota', riga('A', {}), 'B', {}, 'nonScoperto'],
    [
      'il turno è già coperto',
      riga('A', { '05': cella('M1', 'MA', { copertoDa: 'C' }) }),
      'B',
      {},
      'giaCoperto',
    ],
    [
      'il sostituto ha già un turno',
      riga('A', { '05': cella('M1', 'MA') }),
      'B',
      { '05': cella('P1') },
      'haGiaTurno',
    ],
    [
      'il sostituto è in ferie',
      riga('A', { '05': cella('M1', 'MA') }),
      'B',
      { '05': cella('F') },
      'assente',
    ],
    [
      'il sostituto è in malattia sul proprio turno',
      riga('A', { '05': cella('M1', 'MA') }),
      'B',
      { '05': cella('P1', 'MA') },
      'assente',
    ],
  ] as const)('rifiuta: %s', (_d, assente, idSostituto, giorniSostituto, motivo) => {
    const sostituto = idSostituto === 'A' ? assente : riga(idSostituto, giorniSostituto);
    expect(applicaSostituzione(assente, sostituto, '05', TURNO)).toEqual({
      esito: 'rifiutata',
      motivo,
    });
  });
});

describe('applicaSostituzione: reperibilità', () => {
  it('la fascia si aggiunge al sostituto con `sostituisce`, senza chiamate; l’assente ha `copertaDa`', () => {
    const chiamata = { durataMinuti: 30, oraInizio: o('21:00') };
    const assente = riga('A', {
      '05': { ...cella('MA'), reperibilita: [reperibilitaDiProva('R2', [chiamata])] },
    });
    const esito = applicata(
      applicaSostituzione(assente, riga('B', { '05': cella('M1') }), '05', R2),
    );
    expect(esito.assente.giorni['05']?.reperibilita).toEqual([
      reperibilitaDiProva('R2', [chiamata], { copertaDa: 'B' }),
    ]);
    expect(esito.sostituto.giorni['05']).toEqual({
      ...cella('M1'),
      reperibilita: [reperibilitaDiProva('R2', [], { sostituisce: 'A' })],
    });
  });

  it('la seconda reperibilità dell’assente resta com’era', () => {
    const esito = applicata(
      applicaSostituzione(riga('A', { '05': cella('MA', 'R3', 'R2') }), riga('B', {}), '05', R2),
    );
    expect(esito.assente.giorni['05']?.reperibilita).toEqual([
      reperibilitaDiProva('R3'),
      reperibilitaDiProva('R2', [], { copertaDa: 'B' }),
    ]);
    senzaErrori(esito.assente, esito.sostituto);
  });

  const coperta: CellaDoc = {
    ...cella('MA'),
    reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'C' })],
  };
  it.each([
    ['l’assente non ha quella fascia', cella('MA', 'R1'), {}, 'nonScoperto'],
    [
      'la fascia dell’assente non è scoperta (nessuna assenza neutra)',
      cella('R2'),
      {},
      'nonScoperto',
    ],
    ['con un riposo la fascia resta dell’assente', cella('R', 'R2'), {}, 'nonScoperto'],
    ['la fascia è già coperta', coperta, {}, 'giaCoperto'],
    [
      'il sostituto ha già 2 reperibilità',
      cella('MA', 'R2'),
      { '05': cella('R3', 'R1') },
      'massimoReperibilita',
    ],
    [
      'il sostituto ha già la stessa fascia',
      cella('MA', 'R2'),
      { '05': cella('R2') },
      'reperibilitaGiaPresente',
    ],
    ['il sostituto è in ferie', cella('MA', 'R2'), { '05': cella('F') }, 'assente'],
  ] as const)('rifiuta: %s', (_d, cellaAssente, giorniSostituto, motivo) => {
    expect(
      applicaSostituzione(riga('A', { '05': cellaAssente }), riga('B', giorniSostituto), '05', R2),
    ).toEqual({ esito: 'rifiutata', motivo });
  });
});

describe('rimuoviSostituzione', () => {
  it('turno: l’assente torna scoperto, il sostituto perde turno e orario reale (le reperibilità restano)', () => {
    const assente = riga('A', { '05': cella('M1', 'MA', { copertoDa: 'B' }) });
    const sostituto = riga('B', {
      '05': cella('M1', 'R1', {
        sostituisce: 'A',
        orarioReale: { inizio: o('07:00'), fine: o('15:00') },
      }),
    });
    const esito = applicata(rimuoviSostituzione(assente, sostituto, '05', TURNO));
    expect(esito.assente.giorni['05']).toEqual(cella('M1', 'MA'));
    expect(esito.sostituto.giorni['05']).toEqual(cella('R1'));
  });

  it('turno: la cella del sostituto rimasta vuota sparisce dalla mappa', () => {
    const fatta = applicata(
      applicaSostituzione(riga('A', { '05': cella('M1', 'MA') }), riga('B', {}), '05', TURNO),
    );
    const esito = applicata(rimuoviSostituzione(fatta.assente, fatta.sostituto, '05', TURNO));
    expect(esito.assente).toEqual(riga('A', { '05': cella('M1', 'MA') }));
    expect(esito.sostituto.giorni).toEqual({});
  });

  it('reperibilità: andata e ritorno', () => {
    const assente = riga('A', { '05': cella('MA', 'R2') });
    const sostituto = riga('B', { '05': cella('M1') });
    const fatta = applicata(applicaSostituzione(assente, sostituto, '05', R2));
    const esito = applicata(rimuoviSostituzione(fatta.assente, fatta.sostituto, '05', R2));
    expect(esito.assente).toEqual(assente);
    expect(esito.sostituto).toEqual(sostituto);
  });

  it.each([
    [
      'turno coperto da un altro',
      TURNO,
      cella('M1', 'MA', { copertoDa: 'C' }),
      cella('M1', { sostituisce: 'A' }),
    ],
    [
      'il sostituto non ha `sostituisce`',
      TURNO,
      cella('M1', 'MA', { copertoDa: 'B' }),
      cella('M1'),
    ],
    ['nessuna sostituzione', TURNO, cella('M1', 'MA'), cella()],
    [
      'reperibilità coperta da un altro',
      R2,
      { ...cella('MA'), reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'C' })] },
      { ...cella(), reperibilita: [reperibilitaDiProva('R2', [], { sostituisce: 'A' })] },
    ],
    [
      'il sostituto non ha la fascia',
      R2,
      { ...cella('MA'), reperibilita: [reperibilitaDiProva('R2', [], { copertaDa: 'B' })] },
      cella(),
    ],
  ] as const)('rifiuta se le due righe non corrispondono: %s', (_d, oggetto, cellaA, cellaB) => {
    expect(
      rimuoviSostituzione(riga('A', { '05': cellaA }), riga('B', { '05': cellaB }), '05', oggetto),
    ).toEqual({ esito: 'rifiutata', motivo: 'sostituzioneAssente' });
  });
});
