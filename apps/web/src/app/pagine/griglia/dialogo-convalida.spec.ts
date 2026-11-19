// Dialogo di convalida (D1, D2, U5, UX §9.8): riepilogo degli avvisi e conferma esplicita in due passi.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DialogoConvalida, type DatiConvalida } from './dialogo-convalida';
import type { VoceAvviso } from './stato/griglia.store';

const testoDi = (e: Element): string => (e.textContent ?? '').replace(/\s+/g, ' ').trim();

function voce(
  codice: string,
  livello: VoceAvviso['livello'],
  testo: string,
  giorno: '04' | '05' | null = '05',
): VoceAvviso {
  return {
    chiave: `${codice}-${testo}`,
    codice,
    livello,
    testo,
    dettaglio: 'Neri G. · 5 nov',
    cella: giorno === null ? null : { dipendenteId: 'd3', giorno },
    azione: null,
  };
}

function monta(dati: DatiConvalida) {
  const chiudi = vi.fn();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: dati },
      { provide: DialogRef, useValue: { close: chiudi } },
    ],
  });
  const fixture = TestBed.createComponent(DialogoConvalida);
  fixture.detectChanges();
  const radice = fixture.nativeElement as HTMLElement;
  const pulsanti = (): HTMLButtonElement[] =>
    Array.from(radice.querySelectorAll<HTMLButtonElement>('button'));
  const pulsante = (testo: string): HTMLButtonElement => {
    const trovato = pulsanti().find((b) => testoDi(b) === testo);
    if (trovato === undefined) {
      throw new Error(`Pulsante «${testo}» non trovato`);
    }
    return trovato;
  };
  return { radice, chiudi, fixture, pulsante };
}

describe('Dialogo di convalida', () => {
  it('senza avvisi dice «Nessun avviso aperto» e si prosegue', () => {
    const { radice, pulsante } = monta({
      mese: 'novembre 2026',
      voci: [voce('cellaSaltata', 'nota', 'Cella saltata')],
    });
    expect(testoDi(radice)).toContain('Convalida di novembre 2026');
    expect(testoDi(radice)).toContain('Passo 1 di 2');
    expect(testoDi(radice)).toContain('Nessun avviso aperto');
    expect(pulsante('Continua').disabled).toBe(false);
  });

  it('con gli avvisi li raggruppa per tipo con i conteggi e porta alla cella', () => {
    const { radice, chiudi, fixture } = monta({
      mese: 'novembre 2026',
      voci: [
        voce('riposoInsufficiente', 'avviso', 'Riposo di 9 ore tra il 4 e il 5'),
        voce('riposoInsufficiente', 'avviso', 'Riposo di 6 ore tra il 9 e il 10'),
        voce('reperibilitaOltreLimite', 'avviso', 'Reperibilità: 7,5 su 7 nel mese', null),
      ],
    });
    expect(testoDi(radice)).toContain('Ci sono 3 avvisi aperti');
    const titoli = Array.from(radice.querySelectorAll('h3')).map(testoDi);
    expect(titoli).toEqual([
      'Riposi sotto le 11 ore (2)',
      'Reperibilità oltre 7 unità nel mese (1)',
    ]);
    const vai = Array.from(radice.querySelectorAll<HTMLButtonElement>('li button'));
    expect(vai).toHaveLength(2); // l'avviso del mese non ha una cella
    vai[0]?.click();
    expect(chiudi).toHaveBeenCalledWith({
      tipo: 'vai',
      cella: { dipendenteId: 'd3', giorno: '05' },
    });
    fixture.detectChanges();
  });

  it('con dati non validi la convalida non è possibile e il dialogo non propone di proseguire', () => {
    const { radice, pulsante } = monta({
      mese: 'novembre 2026',
      voci: [voce('cellaMalformata', 'blocco', 'Cella con dati non validi')],
    });
    expect(testoDi(radice)).toContain('correggile prima di convalidare');
    expect(testoDi(radice)).toContain('Dati non validi (1)');
    expect(pulsante('Continua').disabled).toBe(true);
  });

  it('la conferma spiega la sola lettura totale e chiede «Ho capito»', () => {
    const { radice, chiudi, fixture, pulsante } = monta({ mese: 'novembre 2026', voci: [] });
    pulsante('Continua').click();
    fixture.detectChanges();
    const testo = testoDi(radice);
    expect(testo).toContain('Passo 2 di 2');
    expect(testo).toContain('il mese di novembre 2026 sarà in sola lettura totale');
    expect(testo).toContain(
      'non potrai più modificare turni, reperibilità, orari reali, malattie, sostituzioni e chiamate',
    );
    expect(testo).toContain('richiesta all’amministratore del database');
    const convalida = pulsante('Convalida mese');
    expect(convalida.disabled).toBe(true);
    convalida.click();
    expect(chiudi).not.toHaveBeenCalled();
    const casella = radice.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    casella.checked = true;
    casella.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    expect(convalida.disabled).toBe(false);
    convalida.click();
    expect(chiudi).toHaveBeenCalledWith({ tipo: 'convalida' });
  });

  it('«Indietro» torna al riepilogo e «Annulla» chiude senza convalidare', () => {
    const { radice, chiudi, fixture, pulsante } = monta({ mese: 'novembre 2026', voci: [] });
    pulsante('Continua').click();
    fixture.detectChanges();
    pulsante('Indietro').click();
    fixture.detectChanges();
    expect(testoDi(radice)).toContain('Passo 1 di 2');
    pulsante('Annulla').click();
    expect(chiudi).toHaveBeenCalledWith(undefined);
  });
});
