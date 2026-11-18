import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import type { Ruolo } from '@turni/domain';
import { Sessione } from '../core/sessione.service';
import { ElencoReparti } from '../dati/elenco-reparti';
import { coordinatoreDiProva, elencoFinto, repartoDiProva, sessioneFinta } from '../test/finti';
import { AvvisoLarghezza } from './avviso-larghezza';
import { BarraSuperiore } from './barra-superiore';
import { Navigazione } from './navigazione';

const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

async function montaMenu(ruolo: Ruolo, url: string, esteso = true) {
  const sessione = sessioneFinta(ruolo);
  const elenco = elencoFinto([
    repartoDiProva('r1', 'Radiologia'),
    repartoDiProva('r2', 'Cardiologia'),
  ]);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: Sessione, useValue: sessione },
      { provide: ElencoReparti, useValue: elenco },
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(Navigazione);
  fixture.componentRef.setInput('esteso', esteso);
  fixture.detectChanges();
  return { fixture, radice: fixture.nativeElement as HTMLElement };
}

describe('Navigazione laterale (UX §3)', () => {
  beforeEach(() => localStorage.clear());

  it('ADMIN: Home, gruppo del reparto, Report di tutti i reparti, Registro, Utenti', async () => {
    const { radice } = await montaMenu('ADMIN', '/reparti/r1/mesi/2026-11');
    const voci = Array.from(radice.querySelectorAll('a')).map(testoDi);
    expect(voci).toEqual([
      'Home',
      'Pianificazione',
      'Banca ore',
      'Report',
      'Dipendenti',
      'Configurazione',
      'Report di tutti i reparti',
      'Registro attività',
      'Utenti',
    ]);
    expect(testoDi(radice)).toContain('Radiologia');
  });

  it('COORDINATORE: nessuna voce «Utenti» né «Report di tutti i reparti»', async () => {
    const { radice } = await montaMenu('COORDINATORE', '/reparti/r1/mesi/2026-11');
    const voci = Array.from(radice.querySelectorAll('a')).map(testoDi);
    expect(voci).not.toContain('Utenti');
    expect(voci).not.toContain('Report di tutti i reparti');
    expect(voci).toContain('Registro attività');
  });

  it('fuori da un reparto e con più reparti non c’è il gruppo del reparto', async () => {
    const { radice } = await montaMenu('COORDINATORE', '/home');
    expect(Array.from(radice.querySelectorAll('a')).map(testoDi)).toEqual([
      'Home',
      'Registro attività',
    ]);
  });

  it('ridotto: sola icona, ma ogni voce ha l’aria-label', async () => {
    const { radice } = await montaMenu('ADMIN', '/home', false);
    const link = Array.from(radice.querySelectorAll('a'));
    expect(link.every((a) => a.textContent?.trim() === '')).toBe(true);
    expect(link.map((a) => a.getAttribute('aria-label'))).toContain('Utenti');
  });

  it('segna la pagina corrente con aria-current', async () => {
    const { fixture, radice } = await montaMenu('ADMIN', '/home');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(radice.querySelector('a[aria-current="page"]')?.textContent).toContain('Home');
  });
});

describe('Barra superiore', () => {
  beforeEach(() => localStorage.clear());

  async function monta(ruolo: Ruolo, url: string) {
    const sessione = sessioneFinta(ruolo);
    const elenco = elencoFinto(
      [repartoDiProva('r1', 'Radiologia', 'c1'), repartoDiProva('r2', 'Ortopedia', 'c2')],
      [coordinatoreDiProva('c1', 'Maria', 'Rossi'), coordinatoreDiProva('c2', 'Paolo', 'Neri')],
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: Sessione, useValue: sessione },
        { provide: ElencoReparti, useValue: elenco },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(BarraSuperiore);
    fixture.componentRef.setInput('menuEsteso', true);
    fixture.detectChanges();
    return { fixture, radice: fixture.nativeElement as HTMLElement, sessione, router };
  }

  it('mostra nome, ruolo ed «Esci»', async () => {
    const { radice, sessione } = await monta('COORDINATORE', '/home');
    expect(testoDi(radice)).toContain('Maria Rossi');
    expect(testoDi(radice)).toContain('Coordinatore');
    Array.from(radice.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Esci'))
      ?.click();
    expect(sessione.esci).toHaveBeenCalled();
  });

  it('per l’ADMIN il ruolo è «ADMIN»', async () => {
    const { radice } = await monta('ADMIN', '/home');
    expect(testoDi(radice)).toContain('ADMIN');
  });

  it('fuori da un reparto il percorso è il titolo della pagina, senza selettore', async () => {
    const { radice } = await monta('COORDINATORE', '/home');
    const percorso = radice.querySelector('nav[aria-label="Percorso"]');
    expect(testoDi(percorso as Element)).toBe('Home');
    expect(radice.querySelector('[aria-label="Cambia reparto"], app-menu')).toBeNull();
  });

  it('dentro un reparto il percorso è «Reparto › sezione › mese» con il selettore del reparto', async () => {
    const { radice } = await monta('COORDINATORE', '/reparti/r1/mesi/2026-11');
    const percorso = radice.querySelector('nav[aria-label="Percorso"]');
    expect(testoDi(percorso as Element).replace(/\s*›\s*/g, ' › ')).toBe(
      'Radiologia › Pianificazione › Novembre 2026',
    );
    expect(radice.querySelector('app-menu button')?.textContent).toContain('Radiologia');
  });

  it('cambiare reparto porta alla stessa sezione dell’altro reparto', async () => {
    const { radice, router, fixture } = await monta('COORDINATORE', '/reparti/r1/mesi/2026-11');
    const naviga = vi.spyOn(router, 'navigateByUrl');
    radice.querySelector<HTMLButtonElement>('app-menu button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const voce = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((v) =>
      v.textContent?.includes('Ortopedia'),
    );
    voce?.click();
    expect(naviga).toHaveBeenCalledWith('/reparti/r2/mesi/2026-11');
  });

  it('per l’ADMIN il selettore raggruppa i reparti per coordinatore', async () => {
    const { radice, fixture } = await monta('ADMIN', '/reparti/r1/banca-ore');
    radice.querySelector<HTMLButtonElement>('app-menu button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const gruppi = Array.from(document.querySelectorAll('[role="group"]')).map(testoDi);
    expect(gruppi).toEqual(['Maria Rossi Radiologia', 'Paolo Neri Ortopedia']);
  });
});

describe('AvvisoLarghezza', () => {
  afterEach(() => Reflect.deleteProperty(window, 'matchMedia'));

  function conLarghezza(stretta: boolean) {
    const ascoltatori: ((e: { matches: boolean }) => void)[] = [];
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: stretta,
        addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.push(f),
        removeEventListener: () => undefined,
      }),
    });
    return ascoltatori;
  }

  it('sotto 1280 px mostra la fascia con il testo di UX §3, non un layout per telefono', () => {
    conLarghezza(true);
    const fixture = TestBed.createComponent(AvvisoLarghezza);
    fixture.detectChanges();
    expect(testoDi(fixture.nativeElement)).toBe(
      'Finestra troppo stretta: l’applicazione è pensata per una larghezza di almeno 1280 px. Allarga la finestra o riduci lo zoom.',
    );
  });

  it('a 1280 px o più non compare, e segue il ridimensionamento', () => {
    const ascoltatori = conLarghezza(false);
    const fixture = TestBed.createComponent(AvvisoLarghezza);
    fixture.detectChanges();
    expect(testoDi(fixture.nativeElement)).toBe('');
    ascoltatori.forEach((f) => f({ matches: true }));
    fixture.detectChanges();
    expect(testoDi(fixture.nativeElement)).toContain('Finestra troppo stretta');
  });
});
