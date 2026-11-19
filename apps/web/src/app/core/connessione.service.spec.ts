import { TestBed } from '@angular/core/testing';
import { Connessione } from './connessione.service';

describe('Connessione', () => {
  afterEach(() => {
    window.dispatchEvent(new Event('online'));
  });

  it('segue gli eventi online e offline del browser', () => {
    TestBed.resetTestingModule();
    const connessione = TestBed.inject(Connessione);
    window.dispatchEvent(new Event('offline'));
    expect(connessione.connesso()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(connessione.connesso()).toBe(true);
  });

  it('smette di ascoltare quando il servizio viene distrutto', () => {
    TestBed.resetTestingModule();
    const connessione = TestBed.inject(Connessione);
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('offline'));
    expect(connessione.connesso()).toBe(true);
  });
});
