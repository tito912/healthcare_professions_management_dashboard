import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Preferenze } from './preferenze.service';

describe('Preferenze', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('legge e scrive per utente in turni.preferenze.<uid>', () => {
    const preferenze = TestBed.inject(Preferenze);
    expect(preferenze.leggi('u1')).toEqual({ ultimoRepartoId: null, menuEsteso: true });
    preferenze.imposta('u1', { ultimoRepartoId: 'r7' });
    preferenze.imposta('u1', { menuEsteso: false });
    expect(preferenze.leggi('u1')).toEqual({ ultimoRepartoId: 'r7', menuEsteso: false });
    expect(preferenze.leggi('u2').ultimoRepartoId).toBeNull();
    expect(localStorage.getItem('turni.preferenze.u1')).not.toBeNull();
  });

  it('se il browser rifiuta l’archivio usa il comportamento predefinito', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloccato');
    });
    const preferenze = TestBed.inject(Preferenze);
    expect(preferenze.leggi('u1')).toEqual({ ultimoRepartoId: null, menuEsteso: true });
    expect(() => preferenze.imposta('u1', { menuEsteso: false })).not.toThrow();
  });

  it('ignora un contenuto non valido', () => {
    localStorage.setItem('turni.preferenze.u1', '{non json');
    expect(TestBed.inject(Preferenze).leggi('u1').menuEsteso).toBe(true);
    localStorage.setItem(
      'turni.preferenze.u1',
      JSON.stringify({ ultimoRepartoId: 5, menuEsteso: 'sì' }),
    );
    expect(TestBed.inject(Preferenze).leggi('u1')).toEqual({
      ultimoRepartoId: null,
      menuEsteso: true,
    });
  });
});
