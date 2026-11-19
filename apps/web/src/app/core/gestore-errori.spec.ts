import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withNavigationErrorHandler } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { Component } from '@angular/core';
import { descriviErrore, GestoreErrori, gestisciErroreNavigazione } from './gestore-errori';

@Component({ template: '<p>Errore</p>' })
class PaginaErrore {}

describe('descriviErrore', () => {
  it('riporta tipo e codice, mai il messaggio', () => {
    const errore = Object.assign(new Error('mario.rossi@esempio.it ha fallito'), {
      code: 'permission-denied',
    });
    expect(descriviErrore(errore)).toBe('Error (permission-denied)');
    expect(descriviErrore(new TypeError('dati personali'))).toBe('TypeError');
    expect(descriviErrore('testo con dati')).toBe('string');
  });
});

describe('GestoreErrori', () => {
  it('registra solo il tipo dell’errore', () => {
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    new GestoreErrori().handleError(new Error('Rossi Mario RSSMRA80A01H501U'));
    expect(console_).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(console_.mock.calls)).not.toContain('Rossi');
    console_.mockRestore();
  });
});

describe('gestisciErroreNavigazione', () => {
  function configura(rotte: Parameters<typeof provideRouter>[0]) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(rotte, withNavigationErrorHandler(gestisciErroreNavigazione))],
    });
  }

  it('una pagina che non si carica porta a /errore', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configura([
      { path: 'errore', component: PaginaErrore },
      { path: 'rotta', loadComponent: () => Promise.reject(new Error('chunk non scaricato')) },
    ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/rotta');
    expect(TestBed.inject(Router).url).toBe('/errore');
  });

  it('se anche /errore fallisce non entra in un ciclo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    configura([
      { path: 'errore', loadComponent: () => Promise.reject(new Error('chunk non scaricato')) },
    ]);
    const harness = await RouterTestingHarness.create();
    await expect(harness.navigateByUrl('/errore')).rejects.toThrow();
  });
});
