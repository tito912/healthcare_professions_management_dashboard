// Ore dovute (D4): ore settimanali ÷ 5 per ogni lunedì-venerdì non festivo di servizio; assenze neutre neutre.
import { describe, expect, it } from 'vitest';
import { festivitaReparto } from '../calendario/festivita';
import { assenzaDiProva, cella, d, m } from '../test-utili';
import type { ContrattoRiga } from '../documenti';
import { minutiDovutiGiornalieri, oreDovuteGiorno, oreDovuteMese } from './ore-dovute';

const FESTIVITA = [
  ...festivitaReparto(2026, { nazionaliEscluse: [], locali: [] }),
  ...festivitaReparto(2028, { nazionaliEscluse: [], locali: [] }),
];
const pieno = (oreSettimanali = 36): ContrattoRiga => ({
  oreSettimanali,
  dataAssunzione: null,
  dataCessazione: null,
});

describe('minutiDovutiGiornalieri', () => {
  it.each([
    [36, 432], // 7,2 ore
    [37.5, 450],
    [36.5, 438],
    [30, 360],
    [1, 12],
    [48, 576],
  ])('%s ore settimanali → %i minuti al giorno', (ore, minuti) => {
    expect(minutiDovutiGiornalieri(ore)).toBe(minuti);
  });
});

describe('oreDovuteGiorno', () => {
  it.each([
    ['2026-11-16', null, 432], // lunedì
    ['2026-11-14', null, 0], // sabato
    ['2026-11-15', null, 0], // domenica
    ['2026-12-08', null, 0], // festivo di martedì
    ['2026-11-16', 'MA', 0], // malattia: neutra
    ['2026-11-16', 'F', 0], // ferie: neutra
    ['2026-11-16', 'R', 432], // riposo: come riposo, si devono comunque
    ['2026-11-16', 'S', 432], // smonto: come riposo
  ])('%s con assenza %s → %i', (data, codiceAssenza, atteso) => {
    const assenza = codiceAssenza === null ? null : assenzaDiProva(codiceAssenza);
    expect(oreDovuteGiorno(d(data), pieno(), FESTIVITA, assenza)).toBe(atteso);
  });

  it('fuori servizio non si deve nulla', () => {
    const assunto = { ...pieno(), dataAssunzione: d('2026-11-17') };
    expect(oreDovuteGiorno(d('2026-11-16'), assunto, FESTIVITA, null)).toBe(0);
    expect(oreDovuteGiorno(d('2026-11-17'), assunto, FESTIVITA, null)).toBe(432);
  });
});

describe('oreDovuteMese', () => {
  it.each([
    // mese, ore settimanali, minuti attesi (feriali non festivi × ore ÷ 5)
    ['2026-11', 36, 21 * 432], // Ognissanti cade di domenica: 21 feriali
    ['2026-12', 36, 21 * 432], // 23 feriali meno 8 e 25 dicembre (il 26 è sabato)
    ['2026-02', 36, 20 * 432],
    ['2028-02', 36, 21 * 432], // bisestile: il 29 è martedì
    ['2026-02', 30, 20 * 360],
    ['2026-04', 36, 21 * 432], // Pasquetta di lunedì; 25 aprile di sabato
  ])('%s con %s ore → %i minuti', (mese, ore, atteso) => {
    expect(oreDovuteMese(m(mese), pieno(ore), FESTIVITA, {})).toBe(atteso);
  });

  it('assunto a metà mese (lunedì 16 novembre 2026): 11 feriali', () => {
    const contratto = { ...pieno(), dataAssunzione: d('2026-11-16') };
    expect(oreDovuteMese(m('2026-11'), contratto, FESTIVITA, {})).toBe(11 * 432);
  });

  it('cessato a metà mese (venerdì 13 novembre 2026): 10 feriali', () => {
    const contratto = { ...pieno(), dataCessazione: d('2026-11-13') };
    expect(oreDovuteMese(m('2026-11'), contratto, FESTIVITA, {})).toBe(10 * 432);
  });

  it('le assenze neutre nei feriali tolgono le ore del giorno; nei sabati e come riposo non cambiano nulla', () => {
    const giorni = {
      '16': cella('F'),
      '17': cella('M1', 'MA'), // turno scoperto per malattia: neutra
      '14': cella('F'), // sabato
      '18': cella('R'),
      '19': cella('M1'),
    };
    expect(oreDovuteMese(m('2026-11'), pieno(), FESTIVITA, giorni)).toBe(19 * 432);
  });
});
