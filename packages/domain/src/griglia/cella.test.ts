// Regole di applicazione (UX §9.3), uguali per inserimento veloce, pennello, incolla e menu.
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import type { CellaDoc } from '../documenti';
import { assenzaDiProva, cella, o, reperibilitaDiProva, turnoDiProva } from '../test-utili';
import {
  applicaAssegnazione,
  cellaVuota,
  eCellaVuota,
  haConsuntivo,
  impostaCella,
  testoCella,
  type Assegnazione,
  type ContestoAssegnazione,
} from './cella';

const libero: ContestoAssegnazione = { turniEsclusi: [], inServizio: true };
const turno = (codice: string): Assegnazione => ({ tipo: 'turno', turno: turnoDiProva(codice) });
const assenza = (codice: string): Assegnazione => ({
  tipo: 'assenza',
  assenza: assenzaDiProva(codice),
});
const reperibilita = (codice: string): Assegnazione => ({
  tipo: 'reperibilita',
  reperibilita: reperibilitaDiProva(codice),
});
const gomma: Assegnazione = { tipo: 'gomma' };

describe('applicaAssegnazione', () => {
  it.each<[string, CellaDoc | null, Assegnazione, CellaDoc]>([
    ['turno su cella vuota', null, turno('M1'), cella('M1')],
    [
      'turno su turno: lo sostituisce, le reperibilità restano',
      cella('P1', 'R1'),
      turno('M1'),
      cella('M1', 'R1'),
    ],
    [
      'turno su turno scoperto: sostituisce turno e assenza',
      cella('M1', 'MA'),
      turno('M1'),
      cella('M1'),
    ],
    ['turno su riposo', cella('R'), turno('M1'), cella('M1')],
    [
      'assenza come riposo su turno: sostituisce il turno',
      cella('M1', 'R1'),
      assenza('R'),
      cella('R', 'R1'),
    ],
    ['smonto su turno', cella('N1'), assenza('S'), cella('S')],
    ['assenza neutra su turno: turno scoperto', cella('M1'), assenza('MA'), cella('M1', 'MA')],
    ['assenza neutra su cella vuota', cella(), assenza('MA'), cella('MA')],
    [
      'assenza neutra su turno scoperto: cambia l’assenza',
      cella('M1', 'MA'),
      assenza('F'),
      cella('M1', 'F'),
    ],
    [
      'assenza come riposo su turno scoperto: resta il riposo',
      cella('M1', 'MA'),
      assenza('R'),
      cella('R'),
    ],
    ['assenza su assenza', cella('F'), assenza('R'), cella('R')],
    ['reperibilità: si aggiunge', cella('M1'), reperibilita('R1'), cella('M1', 'R1')],
    ['seconda reperibilità', cella('R1'), reperibilita('R2'), cella('R1', 'R2')],
    ['gomma: svuota tutto', cella('M1', 'MA', 'R1'), gomma, cella()],
    [
      'elimina il turno scoperto',
      cella('M1', 'MA', 'R1'),
      { tipo: 'eliminaTurnoScoperto' },
      cella('MA', 'R1'),
    ],
    [
      'elimina il turno scoperto senza turno scoperto: nulla',
      cella('M1'),
      { tipo: 'eliminaTurnoScoperto' },
      cella('M1'),
    ],
    [
      'rimuovi una reperibilità',
      cella('M1', 'R1', 'R2'),
      { tipo: 'rimuoviReperibilita', codice: codiceTurno('R1') },
      cella('M1', 'R2'),
    ],
  ])('%s', (_titolo, prima, assegnazione, dopo) => {
    expect(applicaAssegnazione(prima, assegnazione, libero)).toEqual({
      esito: 'applicata',
      cella: dopo,
    });
  });

  it.each<[string, CellaDoc, Assegnazione, string]>([
    ['reperibilità già presente', cella('R1'), reperibilita('R1'), 'reperibilitaGiaPresente'],
    ['terza reperibilità', cella('R1', 'R2'), reperibilita('R3'), 'massimoReperibilita'],
    [
      'ripetuta con due già presenti: vince il motivo più preciso',
      cella('R1', 'R2'),
      reperibilita('R1'),
      'reperibilitaGiaPresente',
    ],
  ])('%s → %s', (_titolo, prima, assegnazione, motivo) => {
    expect(applicaAssegnazione(prima, assegnazione, libero)).toEqual({
      esito: 'rifiutata',
      motivo,
    });
  });

  it('turni e fasce esclusi per il dipendente sono rifiutati', () => {
    const contesto = { turniEsclusi: [codiceTurno('N1'), codiceTurno('R2')], inServizio: true };
    expect(applicaAssegnazione(null, turno('N1'), contesto)).toEqual({
      esito: 'rifiutata',
      motivo: 'turnoEscluso',
    });
    expect(applicaAssegnazione(null, reperibilita('R2'), contesto)).toEqual({
      esito: 'rifiutata',
      motivo: 'turnoEscluso',
    });
    expect(applicaAssegnazione(null, assenza('MA'), contesto).esito).toBe('applicata');
  });

  it('fuori servizio si può solo svuotare', () => {
    const contesto = { turniEsclusi: [], inServizio: false };
    for (const assegnazione of [turno('M1'), assenza('F'), reperibilita('R1')]) {
      expect(applicaAssegnazione(null, assegnazione, contesto)).toEqual({
        esito: 'rifiutata',
        motivo: 'fuoriServizio',
      });
    }
    expect(applicaAssegnazione(cella('M1'), gomma, contesto)).toEqual({
      esito: 'applicata',
      cella: cella(),
    });
  });

  const conConsuntivo: [string, CellaDoc][] = [
    ['orario reale', cella('M1', { orarioReale: { inizio: o('07:00'), fine: o('14:30') } })],
    ['sostituzione', cella('M1', { sostituisce: 'b' })],
    ['copertura', cella('M1', 'MA', { copertoDa: 'b' })],
    [
      'chiamata',
      cella('R1', { chiamata: { codice: 'R1', chiamata: { durataMinuti: 30, oraInizio: null } } }),
    ],
    [
      'reperibilità coperta',
      { ...cella(), reperibilita: [reperibilitaDiProva('R1', [], { copertaDa: 'b' })] },
    ],
    [
      'reperibilità in sostituzione',
      { ...cella(), reperibilita: [reperibilitaDiProva('R1', [], { sostituisce: 'b' })] },
    ],
  ];

  it.each(conConsuntivo)('cella con %s: nessuna modifica dalla griglia', (_titolo, prima) => {
    expect(haConsuntivo(prima)).toBe(true);
    for (const assegnazione of [turno('P1'), assenza('MA'), reperibilita('R5'), gomma]) {
      expect(applicaAssegnazione(prima, assegnazione, libero)).toEqual({
        esito: 'rifiutata',
        motivo: 'consuntivo',
      });
    }
  });

  it('non modifica la cella ricevuta', () => {
    const prima = cella('M1', 'R1');
    const copia = structuredClone(prima);
    applicaAssegnazione(prima, assenza('R'), libero);
    applicaAssegnazione(prima, reperibilita('R2'), libero);
    expect(prima).toEqual(copia);
  });
});

describe('aiuti sulla cella', () => {
  it('cella vuota', () => {
    expect(eCellaVuota(cellaVuota())).toBe(true);
    expect(eCellaVuota(cella('R1'))).toBe(false);
    expect(eCellaVuota(cella('R'))).toBe(false);
    expect(haConsuntivo(cella('M1', 'MA', 'R1'))).toBe(false);
  });

  it.each([
    [cella(), ''],
    [cella('M1'), 'M1'],
    [cella('M1', 'MA', 'R1', 'R2'), 'M1 MA R1 R2'],
    [cella('R', 'R2'), 'R R2'],
  ])('testoCella → «%s»', (c, testo) => {
    expect(testoCella(c)).toBe(testo);
  });

  it('impostaCella toglie dalla mappa le celle vuote e non modifica la mappa ricevuta', () => {
    const giorni = { '05': cella('M1') };
    expect(impostaCella(giorni, '05', cellaVuota())).toEqual({});
    expect(impostaCella(giorni, '06', cella('P1'))).toEqual({
      '05': cella('M1'),
      '06': cella('P1'),
    });
    expect(giorni).toEqual({ '05': cella('M1') });
  });
});
