import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DialogoDisattiva, type DatiDisattiva } from './dialogo-disattiva';

function monta(dati: DatiDisattiva) {
  const chiudi = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: dati },
      { provide: DialogRef, useValue: { close: chiudi } },
    ],
  });
  const fixture = TestBed.createComponent(DialogoDisattiva);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  return { fixture, radice, chiudi };
}

describe('Dialogo «Disattiva dipendente»', () => {
  it('Invio nel campo data conferma con la data proposta', () => {
    const { radice, chiudi } = monta({ dataIniziale: '2026-11-18', dataAssunzione: '' });
    const modulo = radice.querySelector('form');
    expect(modulo).not.toBeNull();
    modulo?.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(chiudi).toHaveBeenCalledWith('2026-11-18');
  });

  it('il pulsante «Disattiva» appartiene al form e lo invia', () => {
    const { radice } = monta({ dataIniziale: '2026-11-18', dataAssunzione: '' });
    const invio = radice.querySelector<HTMLButtonElement>('button[type=submit]');
    expect(invio?.form).toBe(radice.querySelector('form'));
  });

  it('una data prima dell’assunzione non conferma', () => {
    const { radice, chiudi } = monta({ dataIniziale: '2026-11-18', dataAssunzione: '2026-12-01' });
    radice.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(chiudi).not.toHaveBeenCalled();
  });
});
