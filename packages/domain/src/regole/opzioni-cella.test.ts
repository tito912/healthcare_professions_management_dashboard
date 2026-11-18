// Opzioni ammesse per una cella (U7, PIANO 2.1 criterio 4).
import { describe, expect, it } from 'vitest';
import { codiceTurno } from '../codici';
import { ASSENZE, CONFIGURAZIONE, TURNI, cella } from '../test-utili';
import { opzioniCella } from './opzioni-cella';

const codici = (elenco: readonly { codice: string }[]): string[] => elenco.map((x) => x.codice);

describe('opzioniCella', () => {
  it('senza esclusioni: turni, assenze e fasce attivi, in ordine', () => {
    const opzioni = opzioniCella(CONFIGURAZIONE, [], null);
    expect(codici(opzioni.turni)).toEqual(['M1', 'P1', 'N1', 'G1', 'S1']); // X1 disattivato
    expect(codici(opzioni.assenze)).toEqual(['R', 'MA', 'F', 'S']); // PX disattivata
    expect(codici(opzioni.reperibilita)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5']); // R9 disattivata
    expect(opzioni.reperibilitaAlCompleto).toBe(false);
  });

  it('toglie i turni e le fasce esclusi per il dipendente', () => {
    const opzioni = opzioniCella(CONFIGURAZIONE, [codiceTurno('N1'), codiceTurno('R2')], cella());
    expect(codici(opzioni.turni)).toEqual(['M1', 'P1', 'G1', 'S1']);
    expect(codici(opzioni.reperibilita)).toEqual(['R1', 'R3', 'R4', 'R5']);
  });

  it('non offre una fascia già presente nella cella', () => {
    expect(codici(opzioniCella(CONFIGURAZIONE, [], cella('M1', 'R1')).reperibilita)).toEqual([
      'R2',
      'R3',
      'R4',
      'R5',
    ]);
  });

  it('con 2 reperibilità non offre la terza', () => {
    const opzioni = opzioniCella(CONFIGURAZIONE, [], cella('R1', 'R3'));
    expect(opzioni.reperibilita).toEqual([]);
    expect(opzioni.reperibilitaAlCompleto).toBe(true);
    expect(codici(opzioni.turni)).toHaveLength(5);
  });

  it('ordina per `ordine`, qualunque sia l’ordine della configurazione', () => {
    const opzioni = opzioniCella(
      { turni: [...TURNI].reverse(), assenze: [...ASSENZE].reverse() },
      [],
      null,
    );
    expect(codici(opzioni.turni)).toEqual(['M1', 'P1', 'N1', 'G1', 'S1']);
    expect(codici(opzioni.assenze)).toEqual(['R', 'MA', 'F', 'S']);
  });
});
