import { Overlay } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Badge } from './badge';
import { Button } from './button';
import { Dialoghi } from './dialog';
import { EmptyState } from './empty-state';
import { Input } from './input';
import { Menu, type VoceMenu } from './menu';
import { Popover } from './popover';
import { Select } from './select';
import { Spinner } from './spinner';
import { Table } from './table';
import { ToastContenitore, ToastService } from './toast';
import { Tooltip } from './tooltip';

function crea<T>(tipo: new () => T) {
  const fixture = TestBed.createComponent(tipo);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  return { fixture, radice };
}

async function stabile(fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Button', () => {
  @Component({
    imports: [Button],
    template: `
      <button appButton variante="primario" [caricamento]="inCorso()" (click)="clic()">
        Salva
      </button>
    `,
  })
  class Prova {
    inCorso = signal(false);
    clic = vi.fn();
  }

  it('con caricamento mostra aria-busy e blocca il clic', () => {
    const { fixture, radice } = crea(Prova);
    const pulsante = radice.querySelector('button');
    pulsante?.click();
    expect(fixture.componentInstance.clic).toHaveBeenCalledTimes(1);
    fixture.componentInstance.inCorso.set(true);
    fixture.detectChanges();
    expect(pulsante?.getAttribute('aria-busy')).toBe('true');
    pulsante?.click();
    expect(fixture.componentInstance.clic).toHaveBeenCalledTimes(1);
  });
});

describe('Input', () => {
  @Component({
    imports: [Input],
    template: `<app-input etichetta="Email" [(valore)]="valore" [errore]="errore()" />`,
  })
  class Prova {
    valore = signal('');
    errore = signal<string | null>(null);
  }

  it('collega etichetta e campo, e scrive il valore nel signal', () => {
    const { fixture, radice } = crea(Prova);
    const campo = radice.querySelector('input');
    const etichetta = radice.querySelector('label');
    expect(etichetta?.getAttribute('for')).toBe(campo?.id);
    expect(etichetta?.textContent).toContain('Email');
    if (campo) {
      campo.value = 'a@b.it';
      campo.dispatchEvent(new Event('input'));
    }
    expect(fixture.componentInstance.valore()).toBe('a@b.it');
  });

  it('l’errore sta in una regione aria-live collegata al campo con aria-describedby', () => {
    const { fixture, radice } = crea(Prova);
    const campo = radice.querySelector('input');
    const regione = radice.querySelector('[aria-live="assertive"]');
    expect(regione).not.toBeNull();
    expect(campo?.getAttribute('aria-invalid')).toBeNull();
    fixture.componentInstance.errore.set('Inserisci l’email.');
    fixture.detectChanges();
    expect(regione?.textContent).toContain('Inserisci l’email.');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(campo?.getAttribute('aria-describedby')).toBe(regione?.id);
  });
});

describe('Input password', () => {
  @Component({ imports: [Input], template: `<app-input etichetta="Password" tipo="password" />` })
  class Prova {}

  it('il pulsante «Mostra password» alterna il tipo del campo ed è raggiungibile da tastiera', () => {
    const { fixture, radice } = crea(Prova);
    const campo = radice.querySelector('input');
    const pulsante = radice.querySelector('button');
    expect(campo?.type).toBe('password');
    expect(pulsante?.getAttribute('aria-label')).toBe('Mostra password');
    pulsante?.click();
    fixture.detectChanges();
    expect(campo?.type).toBe('text');
    expect(pulsante?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Select', () => {
  @Component({
    imports: [Select],
    template: `<app-select
      etichetta="Reparto"
      segnaposto="Scegli"
      [opzioni]="opzioni"
      [(valore)]="valore"
    />`,
  })
  class Prova {
    opzioni = [
      { valore: 'a', etichetta: 'Radiologia' },
      { valore: 'b', etichetta: 'Cardiologia' },
    ];
    valore = signal('');
  }

  it('ha un’etichetta e aggiorna il valore', () => {
    const { fixture, radice } = crea(Prova);
    const select = radice.querySelector('select');
    expect(radice.querySelector('label')?.getAttribute('for')).toBe(select?.id);
    expect(select?.options.length).toBe(3);
    if (select) {
      select.value = 'b';
      select.dispatchEvent(new Event('change'));
    }
    expect(fixture.componentInstance.valore()).toBe('b');
  });
});

describe('Badge, EmptyState, Table', () => {
  @Component({
    imports: [Badge, EmptyState, Table],
    template: `
      <app-badge variante="successo">attivo</app-badge>
      <app-empty-state titolo="Nessun coordinatore" testo="Creane uno"
        ><button>Nuovo</button></app-empty-state
      >
      <app-table etichetta="Coordinatori"
        ><tbody>
          <tr>
            <td>x</td>
          </tr>
        </tbody></app-table
      >
    `,
  })
  class Prova {}

  it('mostrano testo e struttura semantica', () => {
    const { radice } = crea(Prova);
    expect(radice.querySelector('app-badge')?.textContent).toContain('attivo');
    expect(radice.querySelector('app-empty-state p')?.textContent).toContain('Nessun coordinatore');
    expect(radice.querySelector('app-empty-state button')?.textContent).toContain('Nuovo');
    expect(radice.querySelector('table caption')?.textContent).toContain('Coordinatori');
  });
});

describe('Spinner', () => {
  afterEach(() => vi.useRealTimers());

  @Component({ imports: [Spinner], template: `<app-spinner />` })
  class Prova {}

  it('compare solo dopo 300 ms (UX §6)', () => {
    vi.useFakeTimers();
    const { fixture, radice } = crea(Prova);
    expect(radice.querySelector('svg')).toBeNull();
    vi.advanceTimersByTime(299);
    fixture.detectChanges();
    expect(radice.querySelector('svg')).toBeNull();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect(radice.querySelector('svg')).not.toBeNull();
    expect(radice.querySelector('[role="status"]')?.textContent).toContain('Caricamento');
  });
});

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('le notifiche normali spariscono dopo 5 secondi, gli errori restano finché non si chiudono', () => {
    vi.useFakeTimers();
    const toast = TestBed.inject(ToastService);
    const normale = toast.successo('Fatto');
    const errore = toast.errore('Non riuscito');
    expect(toast.messaggi().map((m) => m.id)).toEqual([normale, errore]);
    vi.advanceTimersByTime(4999);
    expect(toast.messaggi().length).toBe(2);
    vi.advanceTimersByTime(1);
    expect(toast.messaggi().map((m) => m.id)).toEqual([errore]);
    vi.advanceTimersByTime(60_000);
    expect(toast.messaggi().length).toBe(1);
    toast.chiudi(errore);
    expect(toast.messaggi().length).toBe(0);
  });

  it('il contenitore annuncia le normali con aria-live polite e gli errori con assertive', () => {
    const fixture = TestBed.createComponent(ToastContenitore);
    const toast = TestBed.inject(ToastService);
    toast.info('Info');
    toast.errore('Errore');
    fixture.detectChanges();
    const radice: HTMLElement = fixture.nativeElement;
    expect(radice.querySelector('[aria-live="polite"]')?.textContent).toContain('Info');
    expect(radice.querySelector('[aria-live="polite"]')?.textContent).not.toContain('Errore');
    expect(radice.querySelector('[aria-live="assertive"]')?.textContent).toContain('Errore');
  });
});

describe('Dialog', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((n) => (n.innerHTML = ''));
  });

  it('conferma: «Annulla» ha il focus, il dialogo ha titolo collegato e si chiude con Esc', async () => {
    const dialoghi = TestBed.inject(Dialoghi);
    const esito = dialoghi.conferma({
      titolo: 'Disattiva coordinatore',
      messaggio: 'Maria non potrà più accedere.',
      etichettaConferma: 'Disattiva',
      pericolo: true,
    });
    await new Promise((r) => setTimeout(r, 0));
    const dialogo = document.querySelector('[role="dialog"]');
    expect(dialogo).not.toBeNull();
    expect(dialogo?.getAttribute('aria-modal')).toBe('true');
    const titolo = document.getElementById(dialogo?.getAttribute('aria-labelledby') ?? '');
    expect(titolo?.textContent).toContain('Disattiva coordinatore');
    expect(document.activeElement?.textContent).toContain('Annulla');
    dialogo?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    expect(await esito).toBe(false);
  });

  it('conferma: il pulsante di conferma risolve a true', async () => {
    const dialoghi = TestBed.inject(Dialoghi);
    const esito = dialoghi.conferma({ titolo: 'T', messaggio: 'M', etichettaConferma: 'Sì' });
    await new Promise((r) => setTimeout(r, 0));
    const pulsanti = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    );
    pulsanti.find((p) => p.textContent?.includes('Sì'))?.click();
    expect(await esito).toBe(true);
  });
});

describe('Menu', () => {
  @Component({
    imports: [Menu],
    template: `<app-menu etichetta="Altre azioni" [voci]="voci" (scelta)="scelta.set($event)" />`,
  })
  class Prova {
    voci: VoceMenu[] = [
      { id: 'disattiva', etichetta: 'Disattiva…' },
      { id: 'riattiva', etichetta: 'Riattiva', gruppo: 'Stato' },
    ];
    scelta = signal('');
  }

  it('si apre dal pulsante con aria-label, ha voci con ruolo menuitem e la scelta chiude il menu', async () => {
    const { fixture, radice } = crea(Prova);
    const pulsante = radice.querySelector('button');
    expect(pulsante?.getAttribute('aria-label')).toBe('Altre azioni');
    pulsante?.click();
    await stabile(fixture);
    const voci = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(voci.map((v) => v.textContent?.trim())).toEqual(['Disattiva…', 'Riattiva']);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    const gruppo = document.querySelector('[role="group"][aria-labelledby]');
    expect(gruppo?.textContent).toContain('Stato');
    expect(gruppo?.getAttribute('aria-labelledby')).not.toBeNull();
    voci[1]?.click();
    await stabile(fixture);
    expect(fixture.componentInstance.scelta()).toBe('riattiva');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

describe('Popover', () => {
  @Component({
    imports: [Popover],
    template: `
      <app-popover etichetta="Dettagli">
        <span popoverPulsante>Info</span>
        <p>Contenuto</p>
      </app-popover>
    `,
  })
  class Prova {}

  it('si apre al clic, dichiara aria-expanded e si chiude con Esc riportando il focus al pulsante', async () => {
    const { fixture, radice } = crea(Prova);
    const pulsante = radice.querySelector('button');
    expect(pulsante?.getAttribute('aria-expanded')).toBe('false');
    pulsante?.click();
    await stabile(fixture);
    expect(pulsante?.getAttribute('aria-expanded')).toBe('true');
    const pannello = document.querySelector('[role="dialog"][aria-label="Dettagli"]');
    expect(pannello?.textContent).toContain('Contenuto');
    pannello?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
    );
    await stabile(fixture);
    expect(pulsante?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('[role="dialog"][aria-label="Dettagli"]')).toBeNull();
  });
});

describe('Tooltip', () => {
  afterEach(() => vi.useRealTimers());

  @Component({
    imports: [Tooltip],
    template: `<button appTooltip="Salva la bozza">S</button>`,
  })
  class Prova {}

  it('compare subito con il focus da tastiera, collegato con aria-describedby, e sparisce con Esc', () => {
    const { fixture, radice } = crea(Prova);
    TestBed.inject(Overlay);
    const pulsante = radice.querySelector('button');
    pulsante?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toContain('Salva la bozza');
    expect(pulsante?.getAttribute('aria-describedby')).toBe(tooltip?.id);
    pulsante?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(pulsante?.getAttribute('aria-describedby')).toBeNull();
  });

  it('al passaggio del mouse compare dopo il ritardo', () => {
    vi.useFakeTimers();
    const { fixture, radice } = crea(Prova);
    const pulsante = radice.querySelector('button');
    pulsante?.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    vi.advanceTimersByTime(400);
    fixture.detectChanges();
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    pulsante?.dispatchEvent(new MouseEvent('mouseleave'));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});
