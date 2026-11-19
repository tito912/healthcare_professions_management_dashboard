// Riepilogo mensile di un dipendente (PIANO 2.3 criterio 2): i valori sono calcolati a mano nei commenti.
import { describe, expect, it } from 'vitest';
import { calendarioMese } from '../calendario/calendario-mese';
import type { CalendarioMese } from '../documenti';
import { CONTRATTO_PIENO, cella, m, o, reperibilitaDiProva, riga } from '../test-utili';
import { VERSIONE_CALCOLO } from '../impostazioni';
import { calcolaRiepilogo, type DatiRiepilogo } from './calcola-riepilogo';

const TUTTE_LE_NAZIONALI = { nazionaliEscluse: [], locali: [] };
const SENZA_FESTIVITA: CalendarioMese = { festivita: {}, attribuzioneNotte: 'inizio' };

function dati(
  mese: string,
  giorni: Parameters<typeof riga>[1],
  altro: Partial<DatiRiepilogo> = {},
): DatiRiepilogo {
  return {
    riga: riga('A', giorni),
    chiaveMese: m(mese),
    statoMese: 'bozza',
    calendario: SENZA_FESTIVITA,
    righeAdiacenti: { precedente: null, successiva: null },
    ...altro,
  };
}

describe('calcolaRiepilogo', () => {
  it('novembre 2026: conteggi per codice, notti, sabati, domeniche, reperibilità e ore', () => {
    const r = calcolaRiepilogo(
      dati('2026-11', {
        '01': cella('M1'), // domenica (e Ognissanti, ma il calendario di prova non ha festività)
        '02': cella('M1'), // lunedì
        '03': cella('P1', 'R1'), // martedì, reperibilità 14-20 sovrapposta al turno: avviso
        '04': cella('N1'), // notte, mercoledì
        '07': cella('M1'), // sabato
        '08': cella('N1'), // domenica, notte: conta per il giorno d'inizio (D6)
        '10': cella('R'), // riposo
        '11': cella('M1', 'MA'), // turno scoperto per malattia
        '12': cella('F'),
        '13': cella('R2'), // solo reperibilità 20-08: 12 ore
      }),
    );
    expect(r.turniSvolti).toBe(6); // 01, 02, 03, 04, 07, 08
    expect(r.notti).toBe(2);
    expect(r.sabati).toBe(1);
    expect(r.domenicheEFestivi).toBe(2); // 01 e 08
    expect(r.conteggiPerCodice).toEqual({ M1: 3, P1: 1, N1: 2, R1: 1, R2: 1 });
    expect(r.reperibilitaSvolte).toBe(2);
    expect(r.minutiReperibilita).toBe(360 + 720);
    expect(r.chiamate).toBe(0);
    expect(r.minutiChiamate).toBe(0);
    // M1 390 × 3 + P1 450 + N1 540 × 2 = 2700
    expect(r.minutiPianificati).toBe(2700);
    expect(r.assenzePerCodice).toEqual({ R: 1, MA: 1, F: 1 });
    expect(r.valida).toBe(true);
    expect(r.erroriValidazione).toEqual([]);
    expect(r.festivitaIds).toEqual([]);
    expect(r.festivitaLavorate).toEqual([]);
    expect(r).toMatchObject({
      dipendenteId: 'A',
      chiaveMese: '2026-11',
      anno: 2026,
      statoMese: 'bozza',
      versioneCalcolo: VERSIONE_CALCOLO,
    });
  });

  it('i turni scoperti e quelli coperti da un collega non contano; la sostituzione fatta sì', () => {
    const r = calcolaRiepilogo(
      dati('2026-11', {
        '02': cella('M1', 'MA'), // scoperto
        '03': cella('M1', 'MA', { copertoDa: 'B' }), // coperto da B
        '04': cella('P1', { sostituisce: 'B' }), // sostituzione svolta
      }),
    );
    expect(r.turniSvolti).toBe(1);
    expect(r.conteggiPerCodice).toEqual({ P1: 1 });
    expect(r.assenzePerCodice).toEqual({ MA: 2 });
  });

  it('chiamate: contano nelle reperibilità svolte, non in quelle coperte da un collega o in assenza neutra', () => {
    const conChiamata = (codice: string, minuti: number) =>
      cella(codice, { chiamata: { codice, chiamata: { durataMinuti: minuti, oraInizio: null } } });
    const r = calcolaRiepilogo(
      dati('2026-11', {
        '05': conChiamata('R1', 45),
        '06': conChiamata('R2', 30),
        '07': cella('F', 'R1', {
          chiamata: { codice: 'R1', chiamata: { durataMinuti: 60, oraInizio: null } },
        }),
        '09': {
          ...cella(),
          reperibilita: [
            reperibilitaDiProva('R1', [{ durataMinuti: 20, oraInizio: null }], { copertaDa: 'B' }),
          ],
        },
      }),
    );
    expect(r.chiamate).toBe(2);
    expect(r.minutiChiamate).toBe(75);
    expect(r.reperibilitaSvolte).toBe(2);
  });

  it('festività: il turno svolto nel giorno festivo conta per sabati, domeniche e festivi una sola volta (L11)', () => {
    // Dicembre 2026: 8 martedì (Immacolata), 25 venerdì (Natale), 26 sabato (Santo Stefano).
    const calendario = calendarioMese(m('2026-12'), TUTTE_LE_NAZIONALI, 'inizio');
    const r = calcolaRiepilogo(
      dati(
        '2026-12',
        {
          '08': cella('M1'),
          '25': cella('P1'),
          '26': cella('M1'), // sabato festivo: conta tra i festivi, non tra i sabati
          '19': cella('M1'), // sabato normale
          '24': cella('N1'), // notte che inizia il 24 e finisce a Natale
        },
        { calendario },
      ),
    );
    expect(r.sabati).toBe(1);
    expect(r.domenicheEFestivi).toBe(3);
    expect(r.festivitaIds).toEqual(['immacolata', 'natale', 'santo-stefano']);
    expect(r.festivitaLavorate).toEqual([
      { idFestivita: 'immacolata', giorno: '08', codice: 'M1' },
      { idFestivita: 'natale', giorno: '25', codice: 'P1' },
      { idFestivita: 'santo-stefano', giorno: '26', codice: 'M1' },
    ]);
  });

  it('con attribuzione della notte alla fine, la notte del 24 conta per Natale', () => {
    const calendario = calendarioMese(m('2026-12'), TUTTE_LE_NAZIONALI, 'fine');
    const r = calcolaRiepilogo(dati('2026-12', { '24': cella('N1') }, { calendario }));
    expect(r.domenicheEFestivi).toBe(1);
    expect(r.festivitaLavorate).toEqual([{ idFestivita: 'natale', giorno: '24', codice: 'N1' }]);
  });

  it('una festività locale entra con il suo id', () => {
    const calendario = calendarioMese(
      m('2026-06'),
      {
        nazionaliEscluse: [],
        locali: [{ id: 'loc-patrono', nome: 'Patrono', giorno: 24, mese: 6 }],
      },
      'inizio',
    );
    const r = calcolaRiepilogo(dati('2026-06', { '24': cella('M1') }, { calendario }));
    expect(r.festivitaIds).toEqual(['loc-patrono']);
    expect(r.domenicheEFestivi).toBe(1);
  });

  it('la reperibilità nella festività non conta come festività lavorata', () => {
    const calendario = calendarioMese(m('2026-12'), TUTTE_LE_NAZIONALI, 'inizio');
    const r = calcolaRiepilogo(dati('2026-12', { '25': cella('R1') }, { calendario }));
    expect(r.festivitaLavorate).toEqual([]);
    expect(r.reperibilitaSvolte).toBe(1);
  });

  it('numeroAvvisi: riposo, reperibilità oltre 7, sovrapposizione e scoperto; non i turni esclusi', () => {
    // 03: P1 14-22 con R1 14-20 sovrapposta (1); 04: N1 22-07 dopo P1: 0 ore di riposo non c'è (P1 finisce 22:00,
    // N1 inizia 22:00 del giorno dopo): il riposo tra il 3 e il 4 è 24 ore; 05: M1 07:00 dopo N1 che finisce alle
    // 07:00 del 5: sovrapposto, riposo 0 (1); 06: M1 scoperto (1).
    const r = calcolaRiepilogo(
      dati('2026-11', {
        '03': cella('P1', 'R1'),
        '04': cella('N1'),
        '05': cella('M1'),
        '06': cella('M1', 'MA'),
      }),
    );
    expect(r.numeroAvvisi).toBe(3);
  });

  it('il riposo a cavallo di mese conta con le righe adiacenti', () => {
    const successiva = { '01': cella('M1') };
    const r = calcolaRiepilogo(
      dati('2026-10', { '31': cella('N1') }, { righeAdiacenti: { precedente: null, successiva } }),
    );
    // N1 del 31/10 finisce alle 07:00 del 1/11, M1 inizia alle 07:00: riposo 0.
    expect(r.numeroAvvisi).toBe(1);
  });

  it('riga non valida: valida false, codici senza testi e conteggi solo dalle celle valide', () => {
    const r = calcolaRiepilogo({
      ...dati('2026-11', {}),
      riga: {
        dipendenteId: 'A',
        contratto: CONTRATTO_PIENO,
        giorni: {
          '02': cella('M1'),
          '03': { turno: 'sbagliato' },
          '31': cella('M1'), // novembre ha 30 giorni
        },
      },
    });
    expect(r.valida).toBe(false);
    expect(r.erroriValidazione).toEqual(['cellaMalformata', 'giornoInesistente']);
    expect(r.turniSvolti).toBe(1);
    expect(r.numeroAvvisi).toBe(2);
  });

  it('giorni che non sono una mappa: riga non valida, nessun conteggio e nessuna eccezione', () => {
    const r = calcolaRiepilogo({
      ...dati('2026-11', {}),
      riga: { dipendenteId: 'A', contratto: CONTRATTO_PIENO, giorni: null },
    });
    expect(r.valida).toBe(false);
    expect(r.erroriValidazione).toEqual(['giorniNonValidi']);
    expect(r.turniSvolti).toBe(0);
  });

  it('contratto non valido: valida false e ore dovute a zero', () => {
    const r = calcolaRiepilogo({
      ...dati('2026-11', { '02': cella('M1') }),
      riga: { dipendenteId: 'A', contratto: { oreSettimanali: 99 }, giorni: { '02': cella('M1') } },
    });
    expect(r.valida).toBe(false);
    expect(r.erroriValidazione).toEqual(['contrattoNonValido']);
    expect(r.minutiDovuti).toBe(0);
  });

  it('le ore dovute usano il contratto della riga (36 ore: 21 feriali × 432 minuti)', () => {
    expect(calcolaRiepilogo(dati('2026-11', {})).minutiDovuti).toBe(21 * 432);
    const mezzoTempo = riga('A', {}, { ...CONTRATTO_PIENO, oreSettimanali: 18 });
    expect(calcolaRiepilogo({ ...dati('2026-11', {}), riga: mezzoTempo }).minutiDovuti).toBe(
      21 * 216,
    );
  });

  it('ore lavorate, saldo e variazioni (step 3.1a, D4, L37)', () => {
    // Novembre 2026, 36 h: 21 feriali × 432 = 9072 dovute; malattia del 4 (feriale, neutra): 20 × 432 = 8640.
    // Lavorate: M1 del 2 (390), M1 del 3 con uscita alle 14:30 (420), P1 di sabato 7 sostituendo B (450),
    // M1 del 4 scoperto (0), reperibilità con chiamata il 5 (0). 390 + 420 + 450 = 1260.
    const r = calcolaRiepilogo(
      dati('2026-11', {
        '02': cella('M1'),
        '03': cella('M1', { orarioReale: { inizio: o('07:00'), fine: o('14:30') } }),
        '04': cella('M1', 'MA'),
        '05': cella('R1', {
          chiamata: { codice: 'R1', chiamata: { durataMinuti: 60, oraInizio: null } },
        }),
        '07': cella('P1', { sostituisce: 'B' }),
      }),
    );
    expect(r.minutiPianificati).toBe(390 + 390 + 450);
    expect(r.minutiLavorati).toBe(1260);
    expect(r.minutiDovuti).toBe(8640);
    expect(r.saldoMinuti).toBe(1260 - 8640);
    expect(r.variazioni).toBe(1);
    expect(r.minutiVariazioni).toBe(30);
  });

  it('contratto non valido: ore dovute a zero, saldo uguale alle lavorate', () => {
    const r = calcolaRiepilogo({
      ...dati('2026-11', { '02': cella('M1') }),
      riga: { dipendenteId: 'A', contratto: { oreSettimanali: 0 }, giorni: { '02': cella('M1') } },
    });
    expect(r.minutiDovuti).toBe(0);
    expect(r.minutiLavorati).toBe(390);
    expect(r.saldoMinuti).toBe(390);
  });

  it('è una funzione pura: lo stesso input dà lo stesso risultato e non modifica l’input', () => {
    const input = dati('2026-11', { '02': cella('M1'), '03': cella('R1') });
    const copia = JSON.stringify(input);
    expect(calcolaRiepilogo(input)).toEqual(calcolaRiepilogo(input));
    expect(JSON.stringify(input)).toBe(copia);
  });

  it('il mese convalidato si riporta nello stato', () => {
    expect(calcolaRiepilogo(dati('2026-11', {}, { statoMese: 'convalidato' })).statoMese).toBe(
      'convalidato',
    );
  });
});
