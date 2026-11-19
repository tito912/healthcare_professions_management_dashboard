import { describe, expect, it } from 'vitest';
import { d, m } from '../test-utili';
import {
  annoDelBimestre,
  bimestreDaInviare,
  bimestreDi,
  dataInvioAutomatico,
  eIdBimestre,
  etichettaBimestre,
  idBimestre,
  idBimestreDa,
  mesiDelBimestre,
  numeroDelBimestre,
  spostaBimestre,
} from './bimestri';

describe('bimestri solari (D7)', () => {
  it('bimestreDi: gennaio e febbraio sono B1, novembre e dicembre B6', () => {
    expect(bimestreDi(m('2026-01'))).toBe('2026-B1');
    expect(bimestreDi(m('2026-02'))).toBe('2026-B1');
    expect(bimestreDi(m('2026-03'))).toBe('2026-B2');
    expect(bimestreDi(m('2026-10'))).toBe('2026-B5');
    expect(bimestreDi(m('2026-11'))).toBe('2026-B6');
    expect(bimestreDi(m('2026-12'))).toBe('2026-B6');
  });

  it('mesiDelBimestre è il contrario di bimestreDi', () => {
    for (let numero = 1; numero <= 6; numero += 1) {
      const id = idBimestreDa(2026, numero);
      const [primo, secondo] = mesiDelBimestre(id);
      expect(bimestreDi(primo)).toBe(id);
      expect(bimestreDi(secondo)).toBe(id);
    }
    expect(mesiDelBimestre(idBimestre('2026-B6'))).toEqual(['2026-11', '2026-12']);
    expect(mesiDelBimestre(idBimestre('2027-B1'))).toEqual(['2027-01', '2027-02']);
  });

  it('riconosce solo gli ID del formato AAAA-Bn con n da 1 a 6', () => {
    expect(eIdBimestre('2026-B1')).toBe(true);
    expect(eIdBimestre('2026-B6')).toBe(true);
    expect(eIdBimestre('2026-B0')).toBe(false);
    expect(eIdBimestre('2026-B7')).toBe(false);
    expect(eIdBimestre('2026-b3')).toBe(false);
    expect(eIdBimestre('26-B3')).toBe(false);
    expect(() => idBimestre('2026-B7')).toThrow();
    expect(() => idBimestreDa(2026, 7)).toThrow();
    expect(annoDelBimestre(idBimestre('2026-B4'))).toBe(2026);
    expect(numeroDelBimestre(idBimestre('2026-B4'))).toBe(4);
  });

  it('spostaBimestre attraversa l’anno in entrambe le direzioni', () => {
    expect(spostaBimestre(idBimestre('2026-B6'), 1)).toBe('2027-B1');
    expect(spostaBimestre(idBimestre('2026-B1'), -1)).toBe('2025-B6');
    expect(spostaBimestre(idBimestre('2026-B3'), 0)).toBe('2026-B3');
    expect(spostaBimestre(idBimestre('2026-B3'), -3)).toBe('2025-B6');
  });

  it('etichettaBimestre: sigle dei mesi e anno', () => {
    expect(etichettaBimestre(idBimestre('2026-B6'))).toBe('nov–dic 2026');
    expect(etichettaBimestre(idBimestre('2026-B1'))).toBe('gen–feb 2026');
    expect(etichettaBimestre(idBimestre('2026-B5'))).toBe('set–ott 2026');
  });

  it('l’invio automatico è il 6 del mese dopo la chiusura (D7)', () => {
    expect(dataInvioAutomatico(idBimestre('2026-B1'))).toBe('2026-03-06');
    expect(dataInvioAutomatico(idBimestre('2026-B5'))).toBe('2026-11-06');
    expect(dataInvioAutomatico(idBimestre('2026-B6'))).toBe('2027-01-06');
  });

  it('bimestreDaInviare: il 6 del mese è il bimestre appena chiuso, prima è quello precedente', () => {
    expect(bimestreDaInviare(d('2027-01-06'))).toBe('2026-B6');
    expect(bimestreDaInviare(d('2027-01-05'))).toBe('2026-B5');
    expect(bimestreDaInviare(d('2027-02-28'))).toBe('2026-B6');
    expect(bimestreDaInviare(d('2027-03-05'))).toBe('2026-B6');
    expect(bimestreDaInviare(d('2027-03-06'))).toBe('2027-B1');
    expect(bimestreDaInviare(d('2026-11-06'))).toBe('2026-B5');
    expect(bimestreDaInviare(d('2026-11-19'))).toBe('2026-B5');
    expect(bimestreDaInviare(d('2026-01-06'))).toBe('2025-B6');
    expect(bimestreDaInviare(d('2026-01-02'))).toBe('2025-B5');
  });
});
