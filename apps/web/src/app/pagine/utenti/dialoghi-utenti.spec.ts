import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Sessione } from '../../core/sessione.service';
import { FunzioniUtenti } from '../../funzioni/utenti';
import { coordinatoreDiProva, sessioneFinta } from '../../test/finti';
import { DialogoNuovoCoordinatore } from './dialogo-nuovo-coordinatore';
import { DialogoRiassegna } from './dialogo-riassegna';

const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('DialogoNuovoCoordinatore', () => {
  function monta() {
    const funzioni = { creaCoordinatore: vi.fn() };
    const sessione = sessioneFinta('ADMIN');
    sessione.inviaLinkReimpostazione.mockResolvedValue({ ok: true });
    const rif = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: FunzioniUtenti, useValue: funzioni },
        { provide: Sessione, useValue: sessione },
        { provide: DialogRef, useValue: rif },
      ],
    });
    const fixture = TestBed.createComponent(DialogoNuovoCoordinatore);
    fixture.detectChanges();
    const radice: HTMLElement = fixture.nativeElement;
    const scrivi = (etichetta: string, valore: string) => {
      const campo = Array.from(radice.querySelectorAll('label')).find((l) =>
        l.textContent?.includes(etichetta),
      )?.control;
      if (campo instanceof HTMLInputElement) {
        campo.value = valore;
        campo.dispatchEvent(new Event('input'));
      }
    };
    const invia = async () => {
      radice.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, radice, funzioni, sessione, rif, scrivi, invia };
  }

  it('ha tre campi con etichetta; campi non validi: errori per campo, nessuna chiamata', async () => {
    const { radice, funzioni, invia, scrivi } = monta();
    expect(Array.from(radice.querySelectorAll('label')).map((l) => testoDi(l))).toEqual([
      'Nome *',
      'Cognome *',
      'Email *',
    ]);
    scrivi('Email', 'non-valida');
    await invia();
    expect(testoDi(radice)).toContain('Inserisci il nome');
    expect(testoDi(radice)).toContain('Inserisci il cognome');
    expect(testoDi(radice)).toContain('Inserisci un indirizzo email valido.');
    expect(funzioni.creaCoordinatore).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe(radice.querySelector('input')?.id);
  });

  it('crea il coordinatore e poi invia l’email per impostare la password', async () => {
    const { funzioni, sessione, rif, invia, scrivi } = monta();
    funzioni.creaCoordinatore.mockResolvedValue({ uid: 'nuovo' });
    scrivi('Nome', 'Maria');
    scrivi('Cognome', 'Rossi');
    scrivi('Email', ' Maria.Rossi@Esempio.IT ');
    await invia();
    expect(funzioni.creaCoordinatore).toHaveBeenCalledWith({
      nome: 'Maria',
      cognome: 'Rossi',
      email: 'maria.rossi@esempio.it',
    });
    expect(sessione.inviaLinkReimpostazione).toHaveBeenCalledWith('maria.rossi@esempio.it');
    expect(rif.close).toHaveBeenCalledWith({ emailInviata: true });
  });

  it('email già usata: errore sotto il campo email, il dialogo resta aperto', async () => {
    const { radice, funzioni, sessione, rif, invia, scrivi } = monta();
    funzioni.creaCoordinatore.mockRejectedValue({ details: { codice: 'EMAIL_GIA_USATA' } });
    scrivi('Nome', 'Maria');
    scrivi('Cognome', 'Rossi');
    scrivi('Email', 'maria@esempio.it');
    await invia();
    expect(testoDi(radice)).toContain('Esiste già un utente con questa email.');
    expect(sessione.inviaLinkReimpostazione).not.toHaveBeenCalled();
    expect(rif.close).not.toHaveBeenCalled();
  });

  it('se l’email non parte, il dialogo si chiude segnalandolo', async () => {
    const { funzioni, sessione, rif, invia, scrivi } = monta();
    funzioni.creaCoordinatore.mockResolvedValue({ uid: 'nuovo' });
    sessione.inviaLinkReimpostazione.mockResolvedValue({ ok: false, motivo: 'rete' });
    scrivi('Nome', 'Maria');
    scrivi('Cognome', 'Rossi');
    scrivi('Email', 'maria@esempio.it');
    await invia();
    expect(rif.close).toHaveBeenCalledWith({ emailInviata: false });
  });
});

describe('DialogoRiassegna', () => {
  function monta(coordinatori = [coordinatoreDiProva('c3', 'Giulia', 'Bianchi')]) {
    const funzioni = { assegnaReparto: vi.fn(() => Promise.resolve({})) };
    const rif = { close: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: FunzioniUtenti, useValue: funzioni },
        { provide: DialogRef, useValue: rif },
        {
          provide: DIALOG_DATA,
          useValue: { repartoId: 'r1', repartoNome: 'Radiologia', coordinatori },
        },
      ],
    });
    const fixture = TestBed.createComponent(DialogoRiassegna);
    fixture.detectChanges();
    const radice: HTMLElement = fixture.nativeElement;
    const conferma = () =>
      Array.from(radice.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Conferma riassegnazione'),
      );
    return { fixture, radice, funzioni, rif, conferma };
  }

  it('mostra la frase di conferma dopo la scelta e chiama assegnaReparto solo con il pulsante', async () => {
    const { fixture, radice, funzioni, rif, conferma } = monta();
    const select = radice.querySelector('select');
    if (select) {
      select.value = 'c3';
      select.dispatchEvent(new Event('change'));
    }
    fixture.detectChanges();
    expect(testoDi(radice)).toContain(
      'Radiologia passerà a Giulia Bianchi, che vedrà tutti i suoi dati.',
    );
    expect(funzioni.assegnaReparto).not.toHaveBeenCalled();
    conferma()?.click();
    await fixture.whenStable();
    expect(funzioni.assegnaReparto).toHaveBeenCalledWith({
      repartoId: 'r1',
      coordinatoreUid: 'c3',
    });
    expect(rif.close).toHaveBeenCalledWith({ coordinatoreNome: 'Giulia Bianchi' });
  });

  it('senza una scelta la conferma segnala l’errore e non chiama la callable', async () => {
    const { fixture, radice, funzioni, conferma } = monta();
    conferma()?.click();
    fixture.detectChanges();
    expect(testoDi(radice)).toContain('Scegli il coordinatore a cui assegnare il reparto.');
    expect(funzioni.assegnaReparto).not.toHaveBeenCalled();
  });

  it('senza altri coordinatori attivi lo dice e non offre la conferma', () => {
    const { radice, conferma } = monta([]);
    expect(testoDi(radice)).toContain('Non ci sono altri coordinatori attivi');
    expect(conferma()).toBeUndefined();
  });
});
