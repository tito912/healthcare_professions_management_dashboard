import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { sessioneFinta } from '../test/finti';
import {
  Inattivita,
  MINUTI_INATTIVITA,
  SECONDI_PREAVVISO_INATTIVITA,
} from './inattivita.service';
import { Sessione } from './sessione.service';

const SECONDO = 1000;
const MINUTO = 60 * SECONDO;
const ATTESA_PREAVVISO = MINUTI_INATTIVITA * MINUTO - SECONDI_PREAVVISO_INATTIVITA * SECONDO;

describe('Inattivita (uscita automatica)', () => {
  let servizio: Inattivita;
  let sessione: ReturnType<typeof sessioneFinta>;

  beforeEach(() => {
    vi.useFakeTimers();
    sessione = sessioneFinta('COORDINATORE');
    TestBed.configureTestingModule({ providers: [{ provide: Sessione, useValue: sessione }] });
    servizio = TestBed.inject(Inattivita);
  });

  afterEach(() => {
    servizio.ferma();
    vi.useRealTimers();
  });

  it('le durate sono quelle del piano: 30 minuti e 60 secondi di preavviso', () => {
    expect(MINUTI_INATTIVITA).toBe(30);
    expect(SECONDI_PREAVVISO_INATTIVITA).toBe(60);
  });

  it('non avvisa prima di 29 minuti', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO - 1);
    expect(servizio.preavvisoAttivo()).toBe(false);
    expect(sessione.esci).not.toHaveBeenCalled();
  });

  it('avvisa dopo 29 minuti con 60 secondi rimasti', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO);
    expect(servizio.preavvisoAttivo()).toBe(true);
    expect(servizio.secondiRimasti()).toBe(SECONDI_PREAVVISO_INATTIVITA);
    expect(sessione.esci).not.toHaveBeenCalled();
  });

  it('il conto alla rovescia scende di un secondo alla volta', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO + 15 * SECONDO);
    expect(servizio.secondiRimasti()).toBe(45);
  });

  it('esce dopo 30 minuti di inattività, con il motivo «inattivita»', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO + SECONDI_PREAVVISO_INATTIVITA * SECONDO - 1);
    expect(sessione.esci).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sessione.esci).toHaveBeenCalledTimes(1);
    expect(sessione.esci).toHaveBeenCalledWith('inattivita');
    expect(servizio.preavvisoAttivo()).toBe(false);
  });

  it('l’attività prima dell’avviso fa ripartire il conteggio', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO - 10 * SECONDO);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    vi.advanceTimersByTime(ATTESA_PREAVVISO - 10 * SECONDO);
    expect(servizio.preavvisoAttivo()).toBe(false);
    vi.advanceTimersByTime(10 * SECONDO);
    expect(servizio.preavvisoAttivo()).toBe(true);
  });

  it.each(['pointerdown', 'pointermove', 'wheel'])('%s conta come attività', (evento) => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO - SECONDO);
    document.dispatchEvent(new Event(evento, { bubbles: true }));
    vi.advanceTimersByTime(2 * SECONDO);
    expect(servizio.preavvisoAttivo()).toBe(false);
  });

  it('durante l’avviso un movimento del mouse non prolunga la sessione', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO + 10 * SECONDO);
    document.dispatchEvent(new Event('pointermove', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(servizio.preavvisoAttivo()).toBe(true);
    expect(servizio.secondiRimasti()).toBe(50);
  });

  it('«Resta connesso» chiude l’avviso e riparte da zero', () => {
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO + 30 * SECONDO);
    servizio.restaConnesso();
    expect(servizio.preavvisoAttivo()).toBe(false);
    vi.advanceTimersByTime(ATTESA_PREAVVISO - 1);
    expect(servizio.preavvisoAttivo()).toBe(false);
    expect(sessione.esci).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(servizio.preavvisoAttivo()).toBe(true);
  });

  it('ferma() cancella i timer: nessuna uscita', () => {
    servizio.avvia();
    servizio.ferma();
    vi.advanceTimersByTime(2 * MINUTI_INATTIVITA * MINUTO);
    expect(sessione.esci).not.toHaveBeenCalled();
    expect(servizio.preavvisoAttivo()).toBe(false);
  });

  it('avvia() è idempotente: un solo conteggio', () => {
    servizio.avvia();
    servizio.avvia();
    vi.advanceTimersByTime(ATTESA_PREAVVISO + SECONDI_PREAVVISO_INATTIVITA * SECONDO);
    expect(sessione.esci).toHaveBeenCalledTimes(1);
  });

  it('le modifiche non salvate si azzerano all’uscita', () => {
    servizio.avvia();
    servizio.modificheNonSalvate.set(3);
    vi.advanceTimersByTime(ATTESA_PREAVVISO + SECONDI_PREAVVISO_INATTIVITA * SECONDO);
    expect(servizio.modificheNonSalvate()).toBe(0);
  });
});
