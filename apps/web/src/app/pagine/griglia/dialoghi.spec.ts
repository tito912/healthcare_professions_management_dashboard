import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { chiaveMese } from '@turni/domain';
import { vi } from 'vitest';
import { DialogoAggiungiMese, type DatiAggiungiMese } from './dialogo-aggiungi-mese';
import { DialogoUscita } from './dialogo-uscita';

const testoDi = (e: Element): string => (e.textContent ?? '').replace(/\s+/g, ' ').trim();

function monta<T>(tipo: new () => T, dati: unknown) {
  const chiudi = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: dati },
      { provide: DialogRef, useValue: { close: chiudi } },
    ],
  });
  const fixture = TestBed.createComponent(tipo);
  fixture.detectChanges();
  return { radice: fixture.nativeElement as HTMLElement, chiudi, fixture };
}

describe('Dialogo di uscita (UX §9.7)', () => {
  it('dice quante modifiche non sono salvate e offre tre scelte, con «Annulla» al primo posto', () => {
    const { radice, chiudi } = monta(DialogoUscita, 3);
    expect(testoDi(radice)).toContain('Hai 3 modifiche non salvate.');
    const scelte = Array.from(radice.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() !== '',
    );
    expect(scelte.map(testoDi)).toEqual(['Annulla', 'Esci senza salvare', 'Salva bozza ed esci']);
    (scelte[2] as HTMLElement).click();
    expect(chiudi).toHaveBeenCalledWith('salva');
    (scelte[1] as HTMLElement).click();
    expect(chiudi).toHaveBeenCalledWith('esci');
  });
});

describe('Dialogo «Aggiungi mese» (UX §7.6, D8)', () => {
  const dati: DatiAggiungiMese = {
    meseIniziale: chiaveMese('2026-12'),
    creati: [chiaveMese('2026-10'), chiaveMese('2026-11')],
    creabile: (chiave) => chiave <= '2027-01',
  };

  it('i mesi già creati sono marcati, quelli oltre la finestra disabilitati con il motivo', () => {
    const { radice } = monta(DialogoAggiungiMese, dati);
    const mesi = Array.from(radice.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(mesi).toHaveLength(12);
    expect(testoDi(mesi[9] as Element)).toBe('OttobreCreato');
    expect(mesi[9]?.disabled).toBe(true);
    expect(mesi[11]?.disabled).toBe(false);
    expect(mesi[11]?.getAttribute('aria-checked')).toBe('true');
  });

  it('con le frecce si cambia anno: i mesi oltre la finestra dicono perché non si possono creare', () => {
    const { radice, fixture } = monta(DialogoAggiungiMese, dati);
    (radice.querySelector('[aria-label="Anno successivo"]') as HTMLElement).click();
    fixture.detectChanges();
    const mesi = Array.from(radice.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    expect(testoDi(mesi[0] as Element)).toBe('Gennaio');
    expect(mesi[0]?.disabled).toBe(false);
    expect(testoDi(mesi[1] as Element)).toBe('FebbraioOltre la finestra di modifica');
    expect(mesi[1]?.disabled).toBe(true);
  });

  it('«Crea» restituisce il mese scelto', () => {
    const { radice, chiudi, fixture } = monta(DialogoAggiungiMese, dati);
    const crea = Array.from(radice.querySelectorAll('button')).find((b) =>
      testoDi(b).startsWith('Crea'),
    );
    expect(testoDi(crea as Element)).toBe('Crea Dicembre 2026');
    crea?.click();
    fixture.detectChanges();
    expect(chiudi).toHaveBeenCalledWith('2026-12');
  });
});
