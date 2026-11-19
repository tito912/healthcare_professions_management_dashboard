// Chiamata in reperibilità (L21, L38): durata da 1 minuto alla durata reale della fascia, ora di inizio dentro la fascia.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { avvisiRiposo, giorniDaRighe } from '../regole/riposo';
import { cella, d, m, o, reperibilitaDiProva } from '../test-utili';
import { impostaChiamata } from './chiamata';

const R1 = codiceTurno('R1'); // 14:00-20:00, 6 ore
const R2 = codiceTurno('R2'); // 20:00-08:00, 12 ore

function applicata(esito: ReturnType<typeof impostaChiamata>) {
  if (esito.esito !== 'applicata') {
    throw new Error(`attesa applicata, ottenuto ${esito.motivo}`);
  }
  return esito.cella;
}

describe('impostaChiamata', () => {
  it('registra la chiamata, con o senza ora di inizio', () => {
    const senzaOra = impostaChiamata(cella('R1'), d('2026-11-05'), R1, {
      durataMinuti: 45,
      oraInizio: null,
    });
    expect(applicata(senzaOra)).toEqual(
      cella('R1', {
        chiamata: { codice: 'R1', chiamata: { durataMinuti: 45, oraInizio: null } },
      }),
    );
    const conOra = impostaChiamata(cella('R1'), d('2026-11-05'), R1, {
      durataMinuti: 45,
      oraInizio: o('15:30'),
    });
    expect(applicata(conOra).reperibilita[0]?.chiamate).toEqual([
      { durataMinuti: 45, oraInizio: '15:30' },
    ]);
  });

  it('una seconda chiamata sostituisce la prima (una sola, L21)', () => {
    const prima = cella('R1', {
      chiamata: { codice: 'R1', chiamata: { durataMinuti: 45, oraInizio: null } },
    });
    const cellaNuova = applicata(
      impostaChiamata(prima, d('2026-11-05'), R1, { durataMinuti: 10, oraInizio: null }),
    );
    expect(cellaNuova.reperibilita[0]?.chiamate).toEqual([{ durataMinuti: 10, oraInizio: null }]);
  });

  it('chiamata null toglie la chiamata', () => {
    const prima = cella('R1', {
      chiamata: { codice: 'R1', chiamata: { durataMinuti: 45, oraInizio: null } },
    });
    expect(applicata(impostaChiamata(prima, d('2026-11-05'), R1, null))).toEqual(cella('R1'));
  });

  it.each([
    ['durata 0', 0],
    ['durata negativa', -5],
    ['durata non intera', 10.5],
    ['durata oltre la fascia (361 su 360)', 361],
  ])('rifiuta: %s', (_nome, durata) => {
    expect(
      impostaChiamata(cella('R1'), d('2026-11-05'), R1, { durataMinuti: durata, oraInizio: null }),
    ).toEqual({ esito: 'rifiutata', motivo: 'durataNonValida' });
  });

  it('la durata massima è quella della fascia: 360 minuti in R1', () => {
    expect(
      impostaChiamata(cella('R1'), d('2026-11-05'), R1, { durataMinuti: 360, oraInizio: null })
        .esito,
    ).toBe('applicata');
  });

  it('nella notte del cambio d’ora la fascia dura un’ora in meno (R2 del 28/03/2026: 660 minuti)', () => {
    const giorno = d('2026-03-28');
    expect(
      impostaChiamata(cella('R2'), giorno, R2, { durataMinuti: 661, oraInizio: null }).esito,
    ).toBe('rifiutata');
    expect(
      impostaChiamata(cella('R2'), giorno, R2, { durataMinuti: 660, oraInizio: null }).esito,
    ).toBe('applicata');
  });

  it.each([
    ['prima dell’inizio', '13:59'],
    ['alla fine esatta', '20:00'],
    ['dopo la fine', '23:00'],
  ])('rifiuta un’ora di inizio %s della fascia R1 14:00-20:00', (_nome, ora) => {
    expect(
      impostaChiamata(cella('R1'), d('2026-11-05'), R1, { durataMinuti: 30, oraInizio: o(ora) }),
    ).toEqual({ esito: 'rifiutata', motivo: 'oraFuoriFascia' });
  });

  it('accetta l’inizio della fascia e l’ultimo minuto; una fascia notturna vale anche dopo mezzanotte', () => {
    for (const ora of ['14:00', '19:59']) {
      expect(
        impostaChiamata(cella('R1'), d('2026-11-05'), R1, { durataMinuti: 30, oraInizio: o(ora) })
          .esito,
      ).toBe('applicata');
    }
    for (const ora of ['20:00', '23:59', '00:00', '03:30', '07:59']) {
      expect(
        impostaChiamata(cella('R2'), d('2026-11-05'), R2, { durataMinuti: 30, oraInizio: o(ora) })
          .esito,
      ).toBe('applicata');
    }
    expect(
      impostaChiamata(cella('R2'), d('2026-11-05'), R2, { durataMinuti: 30, oraInizio: o('08:00') })
        .esito,
    ).toBe('rifiutata');
  });

  it('rifiuta se la reperibilità non c’è o è coperta da un collega', () => {
    expect(
      impostaChiamata(cella('M1'), d('2026-11-05'), R1, { durataMinuti: 30, oraInizio: null }),
    ).toEqual({ esito: 'rifiutata', motivo: 'reperibilitaAssente' });
    const coperta = {
      ...cella(),
      reperibilita: [reperibilitaDiProva('R1', [], { copertaDa: 'B' })],
    };
    expect(
      impostaChiamata(coperta, d('2026-11-05'), R1, { durataMinuti: 30, oraInizio: null }),
    ).toEqual({ esito: 'rifiutata', motivo: 'reperibilitaCoperta' });
  });

  it('non modifica la cella ricevuta', () => {
    const originale = cella('R1');
    const copia = JSON.stringify(originale);
    impostaChiamata(originale, d('2026-11-05'), R1, { durataMinuti: 30, oraInizio: null });
    expect(JSON.stringify(originale)).toBe(copia);
  });

  it('con l’ora di inizio l’avviso di riposo si ricalcola dalla fine dell’intervento (D8)', () => {
    const avvisi = (c: ReturnType<typeof cella>) =>
      avvisiRiposo(
        giorniDaRighe([{ chiaveMese: m('2026-11'), giorni: { '05': c, '06': cella('M1') } }]),
      );
    // Senza l'ora la chiamata non interrompe il riposo; senza chiamata nessun avviso.
    const senzaOra = applicata(
      impostaChiamata(cella('R2'), d('2026-11-05'), R2, { durataMinuti: 180, oraInizio: null }),
    );
    expect(avvisi(senzaOra)).toEqual([]);
    expect(avvisi(cella('R2'))).toEqual([]);
    // Chiamata alle 23:00 per 3 ore: finisce alle 02:00 del 6/11; M1 alle 07:00 = 5 ore di riposo.
    const conOra = applicata(
      impostaChiamata(cella('R2'), d('2026-11-05'), R2, {
        durataMinuti: 180,
        oraInizio: o('23:00'),
      }),
    );
    expect(avvisi(conOra)).toMatchObject([
      { codice: 'riposoInsufficiente', minutiRiposo: 300, origine: 'chiamata' },
    ]);
  });
});
