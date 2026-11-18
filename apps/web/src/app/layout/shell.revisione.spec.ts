// Test della revisione 1.2 (docs/review/1.2.md, rilievo 1): dimostra un difetto, non va «aggiustato» qui.
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { MINUTI_INATTIVITA, SECONDI_PREAVVISO_INATTIVITA } from '../core/inattivita.service';
import { Sessione } from '../core/sessione.service';
import { ElencoReparti } from '../dati/elenco-reparti';
import { elencoFinto, repartoDiProva, sessioneFinta } from '../test/finti';
import { Shell } from './shell';

@Component({ template: 'pagina' })
class Pagina {}

const MINUTO = 60 * 1000;

describe('Shell: uscita per inattività (revisione 1.2)', () => {
  afterEach(() => vi.useRealTimers());

  it('alla scadenza l’avviso «Sessione in scadenza» si chiude: non resta sopra la pagina di accesso', async () => {
    const sessione = sessioneFinta('COORDINATORE');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'accesso', component: Pagina },
          { path: '', component: Shell, children: [{ path: 'home', component: Pagina }] },
        ]),
        { provide: Sessione, useValue: sessione },
        { provide: ElencoReparti, useValue: elencoFinto([repartoDiProva('r1', 'Radiologia')]) },
      ],
    });
    // Come il servizio vero: `esci()` porta alla schermata di accesso.
    sessione.esci.mockImplementation(async () => {
      await TestBed.inject(Router).navigateByUrl('/accesso');
    });
    const harness = await RouterTestingHarness.create();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    await harness.navigateByUrl('/home');

    vi.advanceTimersByTime(MINUTI_INATTIVITA * MINUTO - SECONDI_PREAVVISO_INATTIVITA * 1000);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();

    vi.advanceTimersByTime(SECONDI_PREAVVISO_INATTIVITA * 1000);
    await harness.fixture.whenStable();
    expect(sessione.esci).toHaveBeenCalledWith('inattivita');
    expect(TestBed.inject(Router).url).toBe('/accesso');
    // Difetto: il dialogo CDK chiude solo con popstate, non con la navigazione del router.
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
