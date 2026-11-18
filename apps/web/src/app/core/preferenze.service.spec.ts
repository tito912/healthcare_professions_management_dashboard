import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Preferenze } from './preferenze.service';

const PREDEFINITE_ATTESE = {
  ultimoRepartoId: null,
  menuEsteso: true,
  menuEstesoGriglia: false,
  vistaGriglia: 'mese',
} as const;

describe('Preferenze', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('legge e scrive per utente in turni.preferenze.<uid>', () => {
    const preferenze = TestBed.inject(Preferenze);
    expect(preferenze.leggi('u1')).toEqual({ ...PREDEFINITE_ATTESE });
    preferenze.imposta('u1', { ultimoRepartoId: 'r7' });
    preferenze.imposta('u1', { menuEsteso: false });
    expect(preferenze.leggi('u1')).toEqual({
      ...PREDEFINITE_ATTESE,
      ultimoRepartoId: 'r7',
      menuEsteso: false,
    });
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
    expect(preferenze.leggi('u1')).toEqual({ ...PREDEFINITE_ATTESE });
    expect(() => preferenze.imposta('u1', { menuEsteso: false })).not.toThrow();
  });

  it('ignora un contenuto non valido', () => {
    localStorage.setItem('turni.preferenze.u1', '{non json');
    expect(TestBed.inject(Preferenze).leggi('u1').menuEsteso).toBe(true);
    localStorage.setItem(
      'turni.preferenze.u1',
      JSON.stringify({ ultimoRepartoId: 5, menuEsteso: 'sì' }),
    );
    expect(TestBed.inject(Preferenze).leggi('u1')).toEqual(PREDEFINITE_ATTESE);
  });

  it('ricorda la vista della griglia e il menu sulla griglia; una vista sconosciuta torna «mese»', () => {
    const preferenze = TestBed.inject(Preferenze);
    preferenze.imposta('u1', { vistaGriglia: 'settimana', menuEstesoGriglia: true });
    expect(preferenze.leggi('u1')).toMatchObject({
      vistaGriglia: 'settimana',
      menuEstesoGriglia: true,
    });
    localStorage.setItem('turni.preferenze.u1', JSON.stringify({ vistaGriglia: 'giorno' }));
    expect(preferenze.leggi('u1').vistaGriglia).toBe('mese');
  });
});
