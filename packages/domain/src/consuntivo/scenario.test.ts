// Scenario completo del consuntivo (PIANO 3.1a criterio 8): ottobre 2026 in bozza, malattia di 3 giorni, un
// sostituto, due variazioni di orario, una notte attraverso il cambio d'ora, poi la convalida.
// Saldi calcolati a mano qui sotto; lo step 3.1b rifà lo stesso scenario sull'emulatore.
//
// Calendario: l'1 ottobre 2026 è giovedì. Sabati 3, 10, 17, 24, 31; domeniche 4 (anche San Francesco, festivo
// dal 2026), 11, 18, 25. Feriali: 31 − 9 = 22. Contratto di 36 ore: 432 minuti dovuti per feriale.
// Il 25 ottobre alle 03:00 le lancette tornano alle 02:00: la notte del 24 dura un'ora in più.
//
// Rossi (A): M1 07:00-14:00 con 30 minuti di pausa (390 minuti) in tutti i 22 feriali.
//   - Malattia (MA, neutra) martedì 13, mercoledì 14, giovedì 15: tre turni scoperti.
//   - Lunedì 5 esce alle 14:30: 07:00-14:30 = 450 − 30 = 420 (variazione +30).
//   Lavorate: 19 turni × 390 + 30 = 7440. Dovute: (22 − 3 feriali di malattia) × 432 = 8208.
//   Saldo: 7440 − 8208 = −768 (−12,8 ore). Controllo: 19 × (390 − 432) + 30 = −798 + 30 = −768.
// Bianchi (B): P1 14:00-22:00 con 30 minuti di pausa (450) in 20 feriali (non il 13 e il 14, riposo).
//   - Mercoledì 14 sostituisce Rossi su M1 (390): il riposo si sostituisce col turno.
//   - Sabato 24 notte N1 22:00-07:00 (0 pausa); esce alle 07:30 del 25: 22:00 CEST - 07:30 CET = 10 h 30 = 630
//     (variazione +30: il previsto 22:00-07:00 in quella notte dura 600). Domenica 25 smonto (S).
//   Lavorate: 20 × 450 + 390 + 630 = 10020. Dovute: 22 × 432 = 9504 (riposo del 13 e turno del 14 sono feriali).
//   Saldo: 10020 − 9504 = +516 (+8,6 ore). Controllo: 20 × 18 − 432 (riposo del 13) − 42 (M1 del 14) + 630 = 516.
// Verdi (C): nessun turno, M1 tra gli esclusi.
import { describe, expect, it } from 'vitest';
import { saldoMese, bancaOreAnno, riportoDa } from '../banca-ore/saldo';
import { festivitaDelMese } from '../calendario/classifica-giorno';
import { convalidaConsentita } from '../calendario/finestra-modifica';
import { codiceTurno } from '../codici';
import type { CalendarioMese, CellaDoc } from '../documenti';
import { soloBlocchi, validaRiga } from '../griglia/valida-riga';
import { validaMese } from '../griglia/valida-mese';
import { calcolaRiepilogo } from '../riepiloghi/calcola-riepilogo';
import { classificaSostituti } from '../sostituti/classifica';
import { assenzaDiProva, cella, d, m, o, riga, turnoDiProva } from '../test-utili';
import type { ChiaveGiorno } from '../tipi';
import type { RigaConsuntivo } from './sostituzione';
import { validaModifica, type ContestoModifica, type EsitoModifica } from './valida-modifica';
import { variazioneOrario, variazioniMese } from './variazione';

const OTTOBRE = m('2026-10');
const CALENDARIO: CalendarioMese = {
  festivita: { '04': { id: 'san-francesco', nome: 'San Francesco d’Assisi' } },
  attribuzioneNotte: 'inizio',
};
const FESTIVITA = festivitaDelMese(OTTOBRE, CALENDARIO.festivita);
const FERIALI: readonly ChiaveGiorno[] = [
  '01',
  '02',
  '05',
  '06',
  '07',
  '08',
  '09',
  '12',
  '13',
  '14',
  '15',
  '16',
  '19',
  '20',
  '21',
  '22',
  '23',
  '26',
  '27',
  '28',
  '29',
  '30',
];
const TURNI_ESCLUSI = { C: [codiceTurno('M1')] };

function giorni(voci: [ChiaveGiorno, CellaDoc][]): Partial<Record<ChiaveGiorno, CellaDoc>> {
  return Object.fromEntries(voci);
}

const rossi = riga('A', giorni(FERIALI.map((g) => [g, cella('M1')])));
const bianchi = riga(
  'B',
  giorni([
    ...FERIALI.map((g): [ChiaveGiorno, CellaDoc] => [
      g,
      g === '13' || g === '14' ? cella('R') : cella('P1'),
    ]),
    ['24', cella('N1')],
    ['25', cella('S')],
  ]),
);
const verdi = riga('C', {});

function contesto(altro: Partial<ContestoModifica> = {}): ContestoModifica {
  return {
    chiaveMese: OTTOBRE,
    statoMese: 'bozza',
    turniEsclusi: TURNI_ESCLUSI,
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

function riga_(esito: EsitoModifica, indice: number): RigaConsuntivo {
  const r = consentita(esito).righe[indice];
  if (r === undefined) {
    throw new Error(`nessuna riga ${indice}`);
  }
  return r;
}
const prima = (esito: EsitoModifica): RigaConsuntivo => riga_(esito, 0);
const seconda = (esito: EsitoModifica): RigaConsuntivo => riga_(esito, 1);
const unica = prima;

describe('scenario completo di ottobre 2026', () => {
  // 1. Malattia di Rossi dal 13 al 15: i tre turni restano scoperti.
  const malattia = consentita(
    validaModifica(
      rossi,
      { tipo: 'assenza', giorni: ['13', '14', '15'], assenza: assenzaDiProva('MA') },
      contesto(),
    ),
  );
  const rossiMalato = prima(malattia);

  // 2. Classifica per il turno scoperto del 14.
  const classifica = classificaSostituti({
    chiaveMese: OTTOBRE,
    giorno: '14',
    assenteId: 'A',
    oggetto: { tipo: 'turno' },
    righe: [rossiMalato, bianchi, verdi],
    righeAdiacenti: {},
    turniEsclusi: TURNI_ESCLUSI,
    riepiloghi: [
      { dipendenteId: 'B', chiaveMese: m('2026-09'), conteggiPerCodice: { P1: 20, M1: 1 } },
    ],
    saldi: { B: 120 },
  });

  // 3. Bianchi sostituisce Rossi il 14.
  const sostituzione = consentita(
    validaModifica(
      rossiMalato,
      { tipo: 'sostituzione', giorno: '14', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
      contesto({ collega: bianchi }),
    ),
  );
  const rossiCoperto = prima(sostituzione);
  const bianchiSostituto = seconda(sostituzione);

  // 4. Le due variazioni di orario.
  const rossiFinale = unica(
    validaModifica(
      rossiCoperto,
      { tipo: 'orarioReale', giorno: '05', orario: { inizio: o('07:00'), fine: o('14:30') } },
      contesto(),
    ),
  );
  const variazioneBianchi = validaModifica(
    bianchiSostituto,
    { tipo: 'orarioReale', giorno: '24', orario: { inizio: o('22:00'), fine: o('07:30') } },
    contesto(),
  );
  const bianchiFinale = unica(variazioneBianchi);

  it('la malattia lascia tre turni scoperti', () => {
    expect(malattia.avvisi[0]?.segnalazioni.map((s) => [s.codice, s.giorno])).toEqual([
      ['turnoScoperto', '2026-10-13'],
      ['turnoScoperto', '2026-10-14'],
      ['turnoScoperto', '2026-10-15'],
    ]);
  });

  it('la classifica propone Bianchi (1 volta M1 a settembre) e scarta Verdi (M1 escluso)', () => {
    expect(classifica).toEqual({
      disponibili: [
        { dipendenteId: 'B', volte: 1, saldoMinuti: 120, reperibile: false, riposo: null },
      ],
      nonDisponibili: [
        { dipendenteId: 'C', motivo: { codice: 'turnoEscluso', codiceTurno: 'M1' } },
      ],
    });
  });

  it('dopo la sostituzione il 14 è coperto; restano scoperti il 13 e il 15', () => {
    expect(rossiCoperto.giorni['14']).toEqual(cella('M1', 'MA', { copertoDa: 'B' }));
    expect(bianchiSostituto.giorni['14']).toEqual(cella('M1', { sostituisce: 'A' }));
    expect(
      sostituzione.avvisi.find((a) => a.dipendenteId === 'A')?.segnalazioni.map((s) => s.giorno),
    ).toEqual(['2026-10-13', '2026-10-15']);
    expect(sostituzione.avvisi.find((a) => a.dipendenteId === 'B')?.segnalazioni).toEqual([]);
  });

  it('la variazione della notte del cambio d’ora vale +30 minuti reali, senza avvisi', () => {
    expect(
      variazioneOrario(d('2026-10-24'), turnoDiProva('N1'), {
        inizio: o('22:00'),
        fine: o('07:30'),
      }),
    ).toBe(30);
    expect(consentita(variazioneBianchi).avvisi).toEqual([{ dipendenteId: 'B', segnalazioni: [] }]);
  });

  it('le righe finali sono valide e coerenti tra loro', () => {
    for (const r of [rossiFinale, bianchiFinale, verdi]) {
      expect(soloBlocchi(validaRiga(r, { chiaveMese: OTTOBRE }))).toEqual([]);
    }
    expect(validaMese([rossiFinale, bianchiFinale, verdi])).toEqual([]);
  });

  it('saldi del mese calcolati a mano: Rossi −768, Bianchi +516', () => {
    expect(saldoMese(OTTOBRE, rossiFinale.contratto, FESTIVITA, rossiFinale.giorni)).toEqual({
      minutiLavorati: 7440,
      minutiDovuti: 8208,
      saldoMinuti: -768,
    });
    expect(saldoMese(OTTOBRE, bianchiFinale.contratto, FESTIVITA, bianchiFinale.giorni)).toEqual({
      minutiLavorati: 10020,
      minutiDovuti: 9504,
      saldoMinuti: 516,
    });
    expect(variazioniMese(OTTOBRE, rossiFinale.giorni)).toEqual({
      variazioni: 1,
      minutiVariazioni: 30,
    });
    expect(variazioniMese(OTTOBRE, bianchiFinale.giorni)).toEqual({
      variazioni: 1,
      minutiVariazioni: 30,
    });
  });

  const riepilogo = (
    r: RigaConsuntivo,
    statoMese: 'bozza' | 'convalidato',
  ): ReturnType<typeof calcolaRiepilogo> =>
    calcolaRiepilogo({
      riga: r,
      chiaveMese: OTTOBRE,
      statoMese,
      calendario: CALENDARIO,
      righeAdiacenti: { precedente: null, successiva: null },
    });

  it('il riepilogo in bozza riporta le stesse ore e le stesse variazioni', () => {
    expect(riepilogo(rossiFinale, 'bozza')).toMatchObject({
      minutiPianificati: 19 * 390, // il pianificato non contiene l'orario reale
      minutiLavorati: 7440,
      minutiDovuti: 8208,
      saldoMinuti: -768,
      variazioni: 1,
      minutiVariazioni: 30,
      turniSvolti: 19,
      assenzePerCodice: { MA: 3 },
      numeroAvvisi: 2, // turni scoperti del 13 e del 15
    });
    expect(riepilogo(bianchiFinale, 'bozza')).toMatchObject({
      minutiPianificati: 20 * 450 + 390 + 600, // N1 pianificato nella notte lunga: 600
      minutiLavorati: 10020,
      minutiDovuti: 9504,
      saldoMinuti: 516,
      variazioni: 1,
      minutiVariazioni: 30,
      turniSvolti: 22,
      conteggiPerCodice: { P1: 20, M1: 1, N1: 1 },
      sabati: 1,
      notti: 1,
      numeroAvvisi: 0,
    });
  });

  it('convalida: consentita dal primo novembre; dopo, ogni modifica è bloccata e i saldi diventano definitivi', () => {
    expect(convalidaConsentita(OTTOBRE, d('2026-10-31'))).toBe(false);
    expect(convalidaConsentita(OTTOBRE, d('2026-11-01'))).toBe(true);

    const convalidato = contesto({ statoMese: 'convalidato', collega: bianchiFinale });
    expect(
      validaModifica(
        rossiFinale,
        { tipo: 'orarioReale', giorno: '06', orario: { inizio: o('07:00'), fine: o('15:00') } },
        convalidato,
      ),
    ).toMatchObject({ esito: 'bloccata', motivo: 'meseConvalidato' });
    expect(
      validaModifica(
        rossiFinale,
        { tipo: 'rimuoviSostituzione', giorno: '14', oggetto: { tipo: 'turno' }, sostitutoId: 'B' },
        convalidato,
      ),
    ).toMatchObject({ esito: 'bloccata', motivo: 'meseConvalidato' });

    const rossiBozza = riepilogo(rossiFinale, 'bozza');
    const rossiDefinitivo = riepilogo(rossiFinale, 'convalidato');
    expect(rossiDefinitivo).toEqual({ ...rossiBozza, statoMese: 'convalidato' });

    // Banca ore 2026 di Rossi con un riporto di +600 dal 2025 (10 ore) e il solo ottobre: 600 − 768 = −168.
    const riporto = { minuti: 600, provvisorio: false };
    const bancaBozza = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto,
      riepiloghi: [rossiBozza],
    });
    expect(bancaBozza).toMatchObject({
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: 600,
      provvisorio: true,
    });
    const bancaDefinitiva = bancaOreAnno({
      dipendenteId: 'A',
      anno: 2026,
      riporto,
      riepiloghi: [rossiDefinitivo],
    });
    expect(bancaDefinitiva).toMatchObject({
      riportoMinuti: 600,
      mesi: {
        '10': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true },
      },
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: -168,
      provvisorio: false,
    });
    // A fine anno il saldo diventa il riporto del 2027.
    expect(riportoDa(bancaDefinitiva)).toEqual({ minuti: -168, provvisorio: false });

    // Bianchi, senza anno precedente (riporto zero, L13): +516.
    const bancaBianchi = bancaOreAnno({
      dipendenteId: 'B',
      anno: 2026,
      riporto: riportoDa(null),
      riepiloghi: [riepilogo(bianchiFinale, 'convalidato')],
    });
    expect(bancaBianchi).toMatchObject({
      saldoAnnoMinuti: 516,
      saldoDefinitivoMinuti: 516,
      provvisorio: false,
    });
  });
});
