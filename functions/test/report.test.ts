// File Excel del report (PIANO 4.1 criterio 6): il test apre il file generato con exceljs e verifica celle, totali e
// legenda colorata; più i testi dell'email e i nomi dei file.
import { chiaveMese as m, idBimestre, PALETTE_TURNI, type ConteggiReport } from '@turni/domain';
import type { Worksheet } from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { VoceLegenda } from '../src/report/calcolo';
import {
  generaExcelIndividuale,
  generaExcelReparto,
  testoDurataChiamate,
} from '../src/report/excel';
import { apriFoglio, valoriRiga } from './xlsx';
import { componiEmail } from '../src/report/messaggi';
import { nomeFileIndividuale, nomeFileReparto, slug } from '../src/report/nomi';

const ID = idBimestre('2026-B6');

const ROSSI: ConteggiReport = {
  turniSvolti: 6,
  notti: 2,
  sabati: 1,
  domenicheEFestivi: 4,
  reperibilitaSvolte: 1,
  chiamate: 1,
  minutiChiamate: 90,
};
const BIANCHI: ConteggiReport = {
  turniSvolti: 4,
  notti: 0,
  sabati: 2,
  domenicheEFestivi: 1,
  reperibilitaSvolte: 0,
  chiamate: 0,
  minutiChiamate: 0,
};
const TOTALI: ConteggiReport = {
  turniSvolti: 10,
  notti: 2,
  sabati: 3,
  domenicheEFestivi: 5,
  reperibilitaSvolte: 1,
  chiamate: 1,
  minutiChiamate: 90,
};

const LEGENDA: VoceLegenda[] = [
  {
    codice: 'M1',
    nome: 'Mattina',
    tipo: 'turno',
    colore: 'arancio',
    inizio: '07:00',
    fine: '14:00',
  },
  {
    codice: 'N1',
    nome: 'Notte',
    tipo: 'turno',
    colore: 'blu-notte',
    inizio: '22:00',
    fine: '07:00',
  },
  {
    codice: 'R1',
    nome: 'Reperibilità pomeriggio',
    tipo: 'reperibilita',
    colore: null,
    inizio: '14:00',
    fine: '20:00',
  },
];

const apri = apriFoglio;
const riga = valoriRiga;

const coloreSfondo = (foglio: Worksheet, indirizzo: string): string | undefined => {
  const riempimento = foglio.getCell(indirizzo).fill;
  return riempimento.type === 'pattern' ? riempimento.fgColor?.argb : undefined;
};

describe('file Excel del reparto', () => {
  it('titolo, mesi inclusi, intestazioni, una riga per dipendente, totali e legenda con i colori', async () => {
    const foglio = await apri(
      await generaExcelReparto({
        nomeReparto: 'Radiologia',
        idBimestre: ID,
        mesiInclusi: [m('2026-11'), m('2026-12')],
        righe: [
          { nome: 'Bianchi Laura', conteggi: BIANCHI },
          { nome: 'Rossi Mario', conteggi: ROSSI },
        ],
        totali: TOTALI,
        legenda: LEGENDA,
      }),
    );
    expect(foglio.getCell('A1').value).toBe('Radiologia · Report nov–dic 2026');
    expect(foglio.getCell('A2').value).toBe(
      'Mesi inclusi (solo i convalidati): Novembre 2026, Dicembre 2026',
    );
    expect(riga(foglio, 4)).toEqual([
      'Dipendente',
      'Turni svolti',
      'di cui notti',
      'di cui sabati',
      'di cui domeniche e festivi',
      'Reperibilità svolte',
      'Chiamate',
      'Durata chiamate',
    ]);
    expect(riga(foglio, 5)).toEqual(['Bianchi Laura', 4, 0, 2, 1, 0, 0, '—']);
    expect(riga(foglio, 6)).toEqual(['Rossi Mario', 6, 2, 1, 4, 1, 1, '1 h 30']);
    expect(riga(foglio, 7)).toEqual(['Totale', 10, 2, 3, 5, 1, 1, '1 h 30']);
    // I totali sono la somma delle righe.
    const somma = (colonna: number): number =>
      [5, 6].reduce((s, r) => s + Number(foglio.getRow(r).getCell(colonna).value), 0);
    for (let colonna = 2; colonna <= 7; colonna += 1) {
      expect(foglio.getRow(7).getCell(colonna).value).toBe(somma(colonna));
    }

    // Legenda: dalla riga 9 («Legenda dei codici»), intestazioni alla 10, voci dalla 11.
    expect(foglio.getCell('A9').value).toBe('Legenda dei codici');
    expect(riga(foglio, 10)).toEqual(['Codice', 'Nome', 'Dalle', 'Alle', 'Tipo']);
    expect(riga(foglio, 11)).toEqual(['M1', 'Mattina', '07:00', '14:00', 'Turno']);
    expect(riga(foglio, 12)).toEqual(['N1', 'Notte', '22:00', '07:00', 'Turno']);
    expect(riga(foglio, 13)).toEqual([
      'R1',
      'Reperibilità pomeriggio',
      '14:00',
      '20:00',
      'Reperibilità',
    ]);
    const arancio = PALETTE_TURNI.find((c) => c.id === 'arancio');
    const bluNotte = PALETTE_TURNI.find((c) => c.id === 'blu-notte');
    expect(coloreSfondo(foglio, 'A11')).toBe(`FF${arancio?.sfondo.slice(1)}`);
    expect(coloreSfondo(foglio, 'A12')).toBe(`FF${bluNotte?.sfondo.slice(1)}`);
    expect(coloreSfondo(foglio, 'A13')).toBeUndefined();
  });

  it('senza dipendenti il file ha comunque intestazioni e totali', async () => {
    const foglio = await apri(
      await generaExcelReparto({
        nomeReparto: 'Radiologia',
        idBimestre: ID,
        mesiInclusi: [m('2026-11')],
        righe: [],
        totali: { ...TOTALI, turniSvolti: 0 },
        legenda: [],
      }),
    );
    expect(riga(foglio, 5)[0]).toBe('Totale');
  });
});

describe('file Excel individuale', () => {
  it('una riga per mese incluso, il totale del bimestre e la legenda', async () => {
    const foglio = await apri(
      await generaExcelIndividuale({
        nomeReparto: 'Radiologia',
        nomeDipendente: 'Rossi Mario',
        idBimestre: ID,
        mesi: [
          {
            chiave: m('2026-11'),
            conteggi: { ...ROSSI, turniSvolti: 4, minutiChiamate: 0, chiamate: 0 },
          },
          { chiave: m('2026-12'), conteggi: { ...ROSSI, turniSvolti: 2, notti: 0 } },
        ],
        totale: ROSSI,
        legenda: LEGENDA,
      }),
    );
    expect(foglio.getCell('A1').value).toBe('Radiologia · Report nov–dic 2026');
    expect(foglio.getCell('A2').value).toBe('Rossi Mario');
    expect(riga(foglio, 5)[0]).toBe('Mese');
    expect(riga(foglio, 6)[0]).toBe('Novembre 2026');
    expect(riga(foglio, 6)[1]).toBe(4);
    expect(riga(foglio, 7)[0]).toBe('Dicembre 2026');
    expect(riga(foglio, 8)).toEqual(['Totale bimestre', 6, 2, 1, 4, 1, 1, '1 h 30']);
    expect(riga(foglio, 12)[0]).toBe('M1');
  });
});

describe('testi e nomi del report', () => {
  it('la durata delle chiamate: un trattino se zero, altrimenti ore e minuti', () => {
    expect(testoDurataChiamate(0)).toBe('—');
    expect(testoDurataChiamate(45)).toBe('45 min');
    expect(testoDurataChiamate(150)).toBe('2 h 30');
  });

  it('slug senza accenti né simboli, con un valore di riserva', () => {
    expect(slug('Pronto Soccorso')).toBe('pronto-soccorso');
    expect(slug('Cardiologia 2°')).toBe('cardiologia-2');
    expect(slug('Ortopedia — Città')).toBe('ortopedia-citta');
    expect(slug('???')).toBe('reparto');
    expect(nomeFileReparto(ID, 'Pronto Soccorso')).toBe('report-2026-B6-pronto-soccorso.xlsx');
    expect(nomeFileIndividuale(ID)).toBe('report-2026-B6.xlsx');
  });

  it('l’email è in italiano, con oggetto, testo e HTML escapato; avverte quando il bimestre è parziale', () => {
    const completa = componiEmail({
      nomeReparto: 'Pronto <Soccorso>',
      nomeDipendente: 'Laura',
      idBimestre: ID,
      mesiInclusi: [m('2026-11'), m('2026-12')],
      parziale: false,
    });
    expect(completa.oggetto).toBe('Report turni nov–dic 2026 · Pronto <Soccorso>');
    expect(completa.testo).toContain('Buongiorno Laura,');
    expect(completa.testo).toContain('Mesi compresi: Novembre 2026, Dicembre 2026.');
    expect(completa.html).toContain('Pronto &lt;Soccorso&gt;');
    expect(completa.html).not.toContain('<Soccorso>');
    const parziale = componiEmail({
      nomeReparto: 'Radiologia',
      nomeDipendente: 'Laura',
      idBimestre: ID,
      mesiInclusi: [m('2026-11')],
      parziale: true,
    });
    expect(parziale.testo).toContain('solo i mesi già convalidati: Novembre 2026.');
  });
});
