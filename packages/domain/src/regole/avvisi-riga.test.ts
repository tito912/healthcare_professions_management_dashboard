// Tutte le segnalazioni di una riga, per il pannello Avvisi (UX §9.6) e per il conteggio del riepilogo.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { CHIAVI_GIORNO } from '../tipi';
import type { CellaDoc } from '../documenti';
import { CONTRATTO_PIENO, cella, d, m } from '../test-utili';
import { avvisiRiga, contaAvvisi } from './avvisi-riga';
import type { Segnalazione } from './livelli';

const senzaAdiacenti = { precedente: null, successiva: null };

describe('avvisiRiga', () => {
  it('raccoglie riposo (anche coi mesi adiacenti), sovrapposizione, turno escluso, scoperti', () => {
    const segnalazioni = avvisiRiga(
      {
        dipendenteId: 'a',
        contratto: CONTRATTO_PIENO,
        giorni: {
          '01': cella('M1'),
          '04': cella('P1'),
          '05': cella('M1'),
          '10': cella('M1', 'R3'),
          '12': cella('S1'),
          '16': cella('M1', 'MA'),
          '18': cella('MA', 'R1'),
          '30': cella('N1'),
        },
      },
      {
        chiaveMese: m('2026-11'),
        turniEsclusi: [codiceTurno('S1')],
        righeAdiacenti: {
          precedente: { '29': cella('P1'), '30': cella('M1'), '31': cella('P1') },
          successiva: { '01': cella('P1') },
        },
      },
    );
    expect(segnalazioni).toEqual<Segnalazione[]>([
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: d('2026-11-01'),
        giornoPrecedente: d('2026-10-31'),
        minutiRiposo: 540,
        origine: 'turno',
      },
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: d('2026-11-05'),
        giornoPrecedente: d('2026-11-04'),
        minutiRiposo: 540,
        origine: 'turno',
      },
      {
        livello: 'avviso',
        codice: 'reperibilitaSovrapposta',
        giorno: d('2026-11-10'),
        codiceReperibilita: codiceTurno('R3'),
        codiceTurno: codiceTurno('M1'),
        giornoTurno: d('2026-11-10'),
      },
      {
        livello: 'avviso',
        codice: 'turnoEsclusoAssegnato',
        giorno: d('2026-11-12'),
        codiceTurno: codiceTurno('S1'),
      },
      {
        livello: 'avviso',
        codice: 'turnoScoperto',
        giorno: d('2026-11-16'),
        codiceTurno: codiceTurno('M1'),
        codiceAssenza: cella('MA').assenza?.codice ?? null,
      },
      {
        livello: 'avviso',
        codice: 'reperibilitaScoperta',
        giorno: d('2026-11-18'),
        codiceReperibilita: codiceTurno('R1'),
        codiceAssenza: cella('MA').assenza?.codice ?? null,
      },
      {
        livello: 'avviso',
        codice: 'riposoInsufficiente',
        giorno: d('2026-12-01'),
        giornoPrecedente: d('2026-11-30'),
        minutiRiposo: 420,
        origine: 'turno',
      },
    ]);
    expect(contaAvvisi(segnalazioni)).toBe(7);
  });

  it('esclude il riposo che riguarda solo i mesi adiacenti', () => {
    expect(
      avvisiRiga(
        { dipendenteId: 'a', contratto: CONTRATTO_PIENO, giorni: {} },
        {
          chiaveMese: m('2026-11'),
          turniEsclusi: [],
          righeAdiacenti: {
            precedente: { '30': cella('P1'), '31': cella('M1') },
            successiva: { '01': cella('P1'), '02': cella('M1') },
          },
        },
      ),
    ).toEqual([]);
  });

  it('reperibilità oltre 7 unità nel mese', () => {
    const giorni: Partial<Record<string, CellaDoc>> = {};
    for (const chiave of CHIAVI_GIORNO.slice(0, 8)) {
      giorni[chiave] = cella('R2');
    }
    expect(
      avvisiRiga(
        { dipendenteId: 'a', contratto: CONTRATTO_PIENO, giorni },
        { chiaveMese: m('2026-11'), turniEsclusi: [], righeAdiacenti: senzaAdiacenti },
      ),
    ).toEqual([
      {
        livello: 'avviso',
        codice: 'reperibilitaOltreLimite',
        giorno: null,
        minutiReperibilita: 8 * 720,
        unita: 8,
        limiteUnita: 7,
      },
    ]);
  });

  it('riporta i problemi di validaRiga (blocco e fuori servizio) e ignora le celle malformate nelle altre regole', () => {
    const segnalazioni = avvisiRiga(
      {
        dipendenteId: 'a',
        contratto: { ...CONTRATTO_PIENO, dataCessazione: d('2026-11-25') },
        giorni: {
          '03': { turno: 'M1' },
          '04': cella('P1'),
          '26': cella('M1'),
          '31': cella('M1'),
        },
      },
      { chiaveMese: m('2026-11'), turniEsclusi: [], righeAdiacenti: senzaAdiacenti },
    );
    expect(segnalazioni).toEqual([
      { livello: 'blocco', codice: 'cellaMalformata', giorno: d('2026-11-03'), chiaveGiorno: '03' },
      { livello: 'avviso', codice: 'fuoriServizio', giorno: d('2026-11-26'), chiaveGiorno: '26' },
      { livello: 'blocco', codice: 'giornoInesistente', giorno: null, chiaveGiorno: '31' },
    ]);
    expect(contaAvvisi(segnalazioni)).toBe(3);
  });

  it('contaAvvisi non conta le note', () => {
    expect(
      contaAvvisi([
        {
          livello: 'nota',
          codice: 'cellaSaltata',
          giorno: d('2026-11-03'),
          dipendenteId: 'a',
          motivo: 'turnoEscluso',
          codiceInserito: 'N1',
        },
      ]),
    ).toBe(0);
  });
});
