// Test della revisione 1.2 (docs/review/1.2.md, rilievi 2 e 3): dimostrano difetti, non vanno «aggiustati» qui.
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { elencoFinto, sessioneFinta } from '../../test/finti';
import { Accesso } from './accesso';

function monta() {
  const sessione = sessioneFinta(null);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Sessione, useValue: sessione },
      { provide: ElencoReparti, useValue: elencoFinto([]) },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    ],
  });
  const fixture = TestBed.createComponent(Accesso);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  const campo = (etichetta: string): HTMLInputElement | null => {
    const controllo = Array.from(radice.querySelectorAll('label')).find((l) =>
      l.textContent?.includes(etichetta),
    )?.control;
    return controllo instanceof HTMLInputElement ? controllo : null;
  };
  return { fixture, radice, sessione, campo };
}

describe('Accesso: focus da tastiera (revisione 1.2)', () => {
  it('dopo credenziali errate il focus va sul campo email (nel browser vero si perde sul body)', async () => {
    const { fixture, radice, sessione, campo } = monta();
    // Come Firebase Auth: la risposta arriva dopo un giro di rete, mentre i campi sono bloccati.
    sessione.accedi.mockImplementation(
      () =>
        new Promise((risolvi) =>
          setTimeout(() => risolvi({ ok: false, motivo: 'credenziali' }), 20),
        ),
    );
    for (const [etichetta, valore] of [
      ['Email', 'qualcuno@esempio.it'],
      ['Password', 'sbagliata'],
    ] as const) {
      const input = campo(etichetta);
      if (input) {
        input.value = valore;
        input.dispatchEvent(new Event('input'));
      }
    }
    fixture.detectChanges();
    // Chi usa la tastiera preme Invio dal campo password.
    campo('Password')?.focus();
    radice.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    await new Promise((risolvi) => setTimeout(risolvi, 60));
    await fixture.whenStable();
    expect(radice.textContent).toContain('Email o password non corrette.');
    expect(document.activeElement).toBe(campo('Email'));
  });

  it('«Password dimenticata?» porta il focus sul campo email del recupero', async () => {
    const { fixture, radice, campo } = monta();
    const pulsante = Array.from(radice.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Password dimenticata?'),
    );
    pulsante?.focus();
    pulsante?.click();
    await fixture.whenStable();
    await new Promise((risolvi) => setTimeout(risolvi, 20));
    await fixture.whenStable();
    expect(radice.textContent).toContain('Invia il link');
    expect(document.activeElement).toBe(campo('Email'));
  });
});
