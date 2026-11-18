import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { elencoFinto, repartoDiProva, sessioneFinta } from '../../test/finti';
import { Accesso, testoErroreAccesso } from './accesso';

function monta(opzioni: { ritorno?: string; ruolo?: 'ADMIN' | 'COORDINATORE' } = {}) {
  const sessione = sessioneFinta(null);
  const elenco = elencoFinto([repartoDiProva('r1', 'Radiologia')]);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Sessione, useValue: sessione },
      { provide: ElencoReparti, useValue: elenco },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(opzioni.ritorno ? { ritorno: opzioni.ritorno } : {}),
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Accesso);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  const naviga = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

  async function scrivi(etichetta: string, valore: string): Promise<void> {
    const campo = Array.from(radice.querySelectorAll('label')).find((l) =>
      l.textContent?.includes(etichetta),
    )?.control;
    if (campo instanceof HTMLInputElement) {
      campo.value = valore;
      campo.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();
  }
  async function invia(): Promise<void> {
    radice.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
  }
  return { fixture, radice, sessione, naviga, scrivi, invia };
}

describe('Accesso', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ha email e password con etichetta, «Entra» e «Password dimenticata?»', () => {
    const { radice } = monta();
    const etichette = Array.from(radice.querySelectorAll('label')).map((l) =>
      l.textContent?.trim(),
    );
    expect(etichette).toContain('Email');
    expect(etichette).toContain('Password');
    expect(radice.textContent).toContain('Entra');
    expect(radice.textContent).toContain('Password dimenticata?');
    expect(radice.querySelector('h1')?.textContent).toContain('Accedi');
  });

  it('campi vuoti: errori per campo e focus sul primo campo errato', async () => {
    const { radice, invia, sessione } = monta();
    await invia();
    expect(radice.textContent).toContain('Inserisci l’email.');
    expect(sessione.accedi).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radice.querySelector('input[type="email"]'));
  });

  it('credenziali errate: messaggio generico in una regione aria-live, password svuotata', async () => {
    const { radice, invia, scrivi, sessione } = monta();
    sessione.accedi.mockResolvedValue({ ok: false, motivo: 'credenziali' });
    await scrivi('Email', 'qualcuno@esempio.it');
    await scrivi('Password', 'sbagliata');
    await invia();
    const regioni = Array.from(radice.querySelectorAll('[aria-live="assertive"]'));
    expect(regioni.some((r) => r.textContent?.includes('Email o password non corrette.'))).toBe(
      true,
    );
    expect(radice.textContent).not.toContain('Account disattivato');
    const password = radice.querySelector<HTMLInputElement>(
      'input[autocomplete="current-password"]',
    );
    expect(password?.value).toBe('');
  });

  it('il messaggio è lo stesso per qualsiasi email: non rivela se esiste', async () => {
    const primo = monta();
    primo.sessione.accedi.mockResolvedValue({ ok: false, motivo: 'credenziali' });
    await primo.scrivi('Email', 'esiste@esempio.it');
    await primo.scrivi('Password', 'x');
    await primo.invia();
    const testoPrimo = primo.radice.querySelector('form')?.textContent;
    TestBed.resetTestingModule();
    const secondo = monta();
    secondo.sessione.accedi.mockResolvedValue({ ok: false, motivo: 'credenziali' });
    await secondo.scrivi('Email', 'non-esiste@esempio.it');
    await secondo.scrivi('Password', 'x');
    await secondo.invia();
    expect(secondo.radice.querySelector('form')?.textContent).toBe(testoPrimo);
  });

  it('i messaggi di errore sono quelli di UX §6', () => {
    expect(testoErroreAccesso('credenziali')).toBe('Email o password non corrette.');
    expect(testoErroreAccesso('troppiTentativi')).toBe(
      'Troppi tentativi: riprova tra qualche minuto.',
    );
    expect(testoErroreAccesso('rete')).toBe('Connessione assente.');
    expect(testoErroreAccesso('disattivato')).toBe(
      'Account disattivato: rivolgiti all’amministratore.',
    );
  });

  it('dopo l’accesso torna alla pagina richiesta', async () => {
    const { invia, scrivi, sessione, naviga } = monta({ ritorno: '/utenti' });
    sessione.accedi.mockImplementation(() => {
      sessione.impostaUtente({ uid: 'a1', nome: 'Anna', cognome: 'Verdi', ruolo: 'ADMIN' });
      return Promise.resolve({ ok: true });
    });
    await scrivi('Email', 'admin@esempio.it');
    await scrivi('Password', 'segreta');
    await invia();
    expect(naviga).toHaveBeenCalledWith('/utenti');
  });

  it('ignora un ritorno non interno e va all’atterraggio del ruolo', async () => {
    const { invia, scrivi, sessione, naviga } = monta({ ritorno: '//esempio.it' });
    sessione.accedi.mockImplementation(() => {
      sessione.impostaUtente({ uid: 'a1', nome: 'Anna', cognome: 'Verdi', ruolo: 'ADMIN' });
      return Promise.resolve({ ok: true });
    });
    await scrivi('Email', 'admin@esempio.it');
    await scrivi('Password', 'segreta');
    await invia();
    expect(naviga).toHaveBeenCalledWith('/home');
  });

  it('un coordinatore con un solo reparto atterra sul mese corrente del reparto', async () => {
    const { invia, scrivi, sessione, naviga } = monta();
    sessione.accedi.mockImplementation(() => {
      sessione.impostaUtente({ uid: 'c1', nome: 'Maria', cognome: 'Rossi', ruolo: 'COORDINATORE' });
      return Promise.resolve({ ok: true });
    });
    await scrivi('Email', 'm@esempio.it');
    await scrivi('Password', 'segreta');
    await invia();
    expect(naviga).toHaveBeenCalledTimes(1);
    expect(naviga.mock.calls[0]?.[0]).toMatch(/^\/reparti\/r1\/mesi\/\d{4}-\d{2}$/);
  });

  describe('Password dimenticata', () => {
    async function apri() {
      const m = monta();
      Array.from(m.radice.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Password dimenticata?'))
        ?.click();
      m.fixture.detectChanges();
      await m.fixture.whenStable();
      m.fixture.detectChanges();
      return m;
    }

    it('apre nella stessa scheda il campo email e «Invia il link»', async () => {
      const { radice } = await apri();
      expect(radice.textContent).toContain('Invia il link');
      expect(radice.querySelectorAll('input').length).toBe(1);
    });

    it('risponde sempre con il messaggio neutro', async () => {
      const { radice, scrivi, invia, sessione } = await apri();
      sessione.inviaLinkReimpostazione.mockResolvedValue({ ok: true });
      await scrivi('Email', 'chiunque@esempio.it');
      await invia();
      expect(sessione.inviaLinkReimpostazione).toHaveBeenCalledWith('chiunque@esempio.it');
      expect(radice.textContent).toContain(
        'Se l’indirizzo è registrato riceverai un’email per reimpostare la password.',
      );
    });

    it('un indirizzo non valido è segnalato sul campo senza chiamare il servizio', async () => {
      const { radice, scrivi, invia, sessione } = await apri();
      await scrivi('Email', 'non-un-indirizzo');
      await invia();
      expect(radice.textContent).toContain('Inserisci un indirizzo email valido.');
      expect(sessione.inviaLinkReimpostazione).not.toHaveBeenCalled();
    });
  });

  it('mostra il motivo dell’uscita precedente (inattività)', () => {
    const sessione = sessioneFinta(null);
    sessione.impostaMotivoUscita('inattivita');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Sessione, useValue: sessione },
        { provide: ElencoReparti, useValue: elencoFinto([]) },
      ],
    });
    const fixture = TestBed.createComponent(Accesso);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sei uscito per inattività.');
  });
});
