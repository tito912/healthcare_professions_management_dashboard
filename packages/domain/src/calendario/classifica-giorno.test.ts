// Classificazione del giorno (D6, L11): feriale, sabato, domenica, festivo nazionale o locale.
import { describe, expect, it } from 'vitest';
import { d, m, o } from '../test-utili';
import {
  categoriaDelTurno,
  classificaGiorno,
  festivitaDelMese,
  giornoDiAttribuzione,
} from './classifica-giorno';
import { festivitaReparto } from './festivita';

const CONFIGURAZIONE = {
  nazionaliEscluse: [],
  locali: [{ id: 'loc-patrono', nome: 'San Giovanni Battista', giorno: 24, mese: 6 }],
};
const FESTIVITA = [
  ...festivitaReparto(2026, CONFIGURAZIONE),
  ...festivitaReparto(2027, CONFIGURAZIONE),
];

describe('classificaGiorno', () => {
  it.each([
    ['2026-11-16', 'feriale', null], // lunedì
    ['2026-11-14', 'sabato', null],
    ['2026-11-15', 'domenica', null],
    ['2026-12-08', 'festivoNazionale', 'immacolata'], // martedì
    ['2026-06-24', 'festivoLocale', 'loc-patrono'], // mercoledì
    ['2026-12-26', 'festivoNazionale', 'santo-stefano'], // sabato festivo: conta il festivo (L11)
    ['2026-11-01', 'festivoNazionale', 'ognissanti'], // domenica festiva
    ['2026-04-05', 'festivoNazionale', 'pasqua'],
    ['2026-04-06', 'festivoNazionale', 'pasquetta'],
    ['2026-10-04', 'festivoNazionale', 'san-francesco'],
    ['2028-02-29', 'feriale', null], // bisestile, martedì
  ])('%s è %s', (data, tipo, idFestivita) => {
    const esito = classificaGiorno(d(data), FESTIVITA);
    expect(esito.tipo).toBe(tipo);
    expect(esito.festivita?.id ?? null).toBe(idFestivita);
  });

  it('una nazionale esclusa dal reparto torna un giorno qualsiasi', () => {
    const senzaImmacolata = festivitaReparto(2026, {
      nazionaliEscluse: ['immacolata'],
      locali: [],
    });
    expect(classificaGiorno(d('2026-12-08'), senzaImmacolata).tipo).toBe('feriale');
  });
});

describe('festivitaDelMese', () => {
  it('ricostruisce le festività dal calendario copiato nel mese, con il tipo dall’id', () => {
    expect(
      festivitaDelMese(m('2026-12'), {
        '08': { id: 'immacolata', nome: 'Immacolata Concezione' },
        '24': { id: 'loc-vigilia', nome: 'Vigilia' },
      }),
    ).toEqual([
      { id: 'immacolata', nome: 'Immacolata Concezione', data: '2026-12-08', tipo: 'nazionale' },
      { id: 'loc-vigilia', nome: 'Vigilia', data: '2026-12-24', tipo: 'locale' },
    ]);
  });

  it('scarta i giorni che il mese non ha', () => {
    expect(festivitaDelMese(m('2026-11'), { '31': { id: 'loc-x', nome: 'X' } })).toEqual([]);
  });
});

describe('giornoDiAttribuzione (D6)', () => {
  it.each([
    // giorno, inizio, fine, attribuzione, giorno attribuito
    ['2026-11-14', '22:00', '07:00', 'inizio', '2026-11-14'],
    ['2026-11-14', '22:00', '07:00', 'fine', '2026-11-15'],
    ['2026-11-14', '07:00', '14:00', 'fine', '2026-11-14'],
    ['2026-11-14', '18:00', '00:00', 'fine', '2026-11-14'], // finisce a mezzanotte: non è notturno (L8)
    ['2026-11-14', '08:00', '08:00', 'fine', '2026-11-15'], // 24 ore
    ['2026-12-31', '22:00', '07:00', 'fine', '2027-01-01'],
    ['2026-11-30', '22:00', '07:00', 'fine', '2026-12-01'],
  ] as const)('%s %s-%s con «%s» → %s', (giorno, inizio, fine, attribuzione, atteso) => {
    expect(
      giornoDiAttribuzione(d(giorno), { inizio: o(inizio), fine: o(fine) }, attribuzione),
    ).toBe(atteso);
  });
});

describe('categoriaDelTurno (L11: festivo > domenica > sabato)', () => {
  const notte = { inizio: o('22:00'), fine: o('07:00') };
  const mattina = { inizio: o('07:00'), fine: o('14:00') };
  it.each([
    ['2026-11-14', notte, 'inizio', 'sabato'],
    ['2026-11-14', notte, 'fine', 'domenica'],
    ['2026-11-13', notte, 'fine', 'sabato'],
    ['2026-11-16', mattina, 'inizio', 'feriale'],
    ['2026-12-26', mattina, 'inizio', 'festivo'], // sabato festivo
    ['2026-12-31', notte, 'inizio', 'feriale'],
    ['2026-12-31', notte, 'fine', 'festivo'], // Capodanno 2027
    ['2026-06-24', mattina, 'inizio', 'festivo'], // festività locale
  ] as const)('%s con «%s» → %s', (giorno, turno, attribuzione, attesa) => {
    expect(categoriaDelTurno(d(giorno), turno, attribuzione, FESTIVITA)).toBe(attesa);
  });
});
