import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { RepartiRepo } from '../../dati/reparti.repo';
import { UtentiRepo } from '../../dati/utenti.repo';
import { FunzioniUtenti } from '../../funzioni/utenti';
import { coordinatoreDiProva, elencoFinto, repartoDiProva, sessioneFinta } from '../../test/finti';
import { Dialoghi } from '../../ui/dialog';
import { ToastService } from '../../ui/toast';
import { Utenti } from './utenti';

const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Lascia correre le promesse in sospeso (i repository finti rispondono in modo asincrono) e aggiorna la vista. */
async function attendi(fixture: {
  detectChanges(): void;
  whenStable(): Promise<unknown>;
}): Promise<void> {
  fixture.detectChanges();
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function monta(opzioni: { vuoto?: boolean } = {}) {
  const admin = {
    uid: 'a1',
    nome: 'Anna',
    cognome: 'Verdi',
    email: 'anna@esempio.it',
    ruolo: 'ADMIN' as const,
    attivo: true,
  };
  const maria = coordinatoreDiProva('c1', 'Maria', 'Rossi');
  const paolo = coordinatoreDiProva('c2', 'Paolo', 'Neri', false);
  const giulia = coordinatoreDiProva('c3', 'Giulia', 'Bianchi');
  const utentiRepo = {
    tutti: vi.fn(() => Promise.resolve(opzioni.vuoto ? [admin] : [admin, maria, paolo, giulia])),
  };
  const repartiRepo = {
    tutti: vi.fn(() =>
      Promise.resolve(
        opzioni.vuoto
          ? []
          : [repartoDiProva('r1', 'Radiologia', 'c1'), repartoDiProva('r2', 'Ortopedia', 'c2')],
      ),
    ),
  };
  const funzioni = {
    creaCoordinatore: vi.fn(),
    impostaStatoUtente: vi.fn(() => Promise.resolve({ uid: 'c1', attivo: false })),
    assegnaReparto: vi.fn(),
  };
  const dialoghi = { conferma: vi.fn(), apri: vi.fn() };
  const sessione = sessioneFinta('ADMIN');
  sessione.inviaLinkReimpostazione.mockResolvedValue({ ok: true });
  TestBed.configureTestingModule({
    providers: [
      { provide: UtentiRepo, useValue: utentiRepo },
      { provide: RepartiRepo, useValue: repartiRepo },
      { provide: FunzioniUtenti, useValue: funzioni },
      { provide: Dialoghi, useValue: dialoghi },
      { provide: Sessione, useValue: sessione },
      { provide: ElencoReparti, useValue: elencoFinto([]) },
    ],
  });
  const fixture = TestBed.createComponent(Utenti);
  await attendi(fixture);
  const radice: HTMLElement = fixture.nativeElement;
  const toast = TestBed.inject(ToastService);
  const pulsante = (testo: string) =>
    Array.from(radice.querySelectorAll('button')).find((b) => testoDi(b).includes(testo));
  const stabile = () => attendi(fixture);
  return { fixture, radice, utentiRepo, funzioni, dialoghi, sessione, toast, pulsante, stabile };
}

describe('Utenti (ADMIN)', () => {
  it('elenca i coordinatori con email, stato e reparti, e i reparti con il coordinatore', async () => {
    const { radice } = await monta();
    const [tabellaCoordinatori, tabellaReparti] = Array.from(radice.querySelectorAll('table'));
    const righe = Array.from(tabellaCoordinatori?.querySelectorAll('tbody tr') ?? []).map(testoDi);
    expect(righe.length).toBe(3);
    expect(righe[0]).toContain('Maria Rossi');
    expect(righe[0]).toContain('maria@esempio.it');
    expect(righe[0]).toContain('attivo');
    expect(righe[0]).toContain('Radiologia');
    expect(righe.find((r) => r.includes('Paolo Neri'))).toContain('disattivato');
    expect(righe.find((r) => r.includes('Giulia Bianchi'))).toContain('—');
    const reparti = Array.from(tabellaReparti?.querySelectorAll('tbody tr') ?? []).map(testoDi);
    expect(reparti.find((r) => r.includes('Ortopedia'))).toContain('Paolo Neri (disattivato)');
    expect(reparti.find((r) => r.includes('Ortopedia'))).toContain('coordinatore disattivato');
  });

  it('i coordinatori disattivati hanno solo il menu (niente «Reimposta password»)', async () => {
    const { radice } = await monta();
    const riga = Array.from(radice.querySelectorAll('tbody tr')).find((r) =>
      r.textContent?.includes('Paolo Neri'),
    );
    expect(riga?.textContent).not.toContain('Reimposta password');
    expect(riga?.querySelector('app-menu button')).not.toBeNull();
  });

  it('senza coordinatori: «Nessun coordinatore» con «Nuovo coordinatore»', async () => {
    const { radice } = await monta({ vuoto: true });
    expect(testoDi(radice)).toContain('Nessun coordinatore');
    expect(testoDi(radice)).toContain('Nuovo coordinatore');
  });

  it('«Disattiva…» chiede conferma con il testo di UX §7.11; se si annulla non cambia nulla', async () => {
    const { funzioni, dialoghi, pulsante, stabile, radice } = await monta();
    dialoghi.conferma.mockResolvedValue(false);
    const menu = radice.querySelector<HTMLButtonElement>('tbody tr app-menu button');
    menu?.click();
    await stabile();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((v) => v.textContent?.includes('Disattiva…'))
      ?.click();
    await stabile();
    expect(dialoghi.conferma).toHaveBeenCalledTimes(1);
    expect(dialoghi.conferma.mock.calls[0]?.[0]).toMatchObject({
      messaggio: 'Maria Rossi non potrà più accedere. I suoi reparti restano e vanno riassegnati.',
      pericolo: true,
    });
    expect(funzioni.impostaStatoUtente).not.toHaveBeenCalled();
    expect(pulsante).toBeDefined();
  });

  it('confermata la disattivazione chiama impostaStatoUtente({ attivo: false }) e ricarica', async () => {
    const { funzioni, dialoghi, utentiRepo, stabile, radice, toast } = await monta();
    dialoghi.conferma.mockResolvedValue(true);
    radice.querySelector<HTMLButtonElement>('tbody tr app-menu button')?.click();
    await stabile();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((v) => v.textContent?.includes('Disattiva…'))
      ?.click();
    await stabile();
    expect(funzioni.impostaStatoUtente).toHaveBeenCalledWith({ uid: 'c1', attivo: false });
    expect(utentiRepo.tutti).toHaveBeenCalledTimes(2);
    expect(toast.messaggi().at(-1)?.testo).toBe('Maria Rossi è stato disattivato.');
  });

  it('«Riattiva» non chiede conferma', async () => {
    const { funzioni, dialoghi, stabile, radice } = await monta();
    const riga = Array.from(radice.querySelectorAll('tbody tr')).find((r) =>
      r.textContent?.includes('Paolo Neri'),
    );
    riga?.querySelector<HTMLButtonElement>('app-menu button')?.click();
    await stabile();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((v) => v.textContent?.includes('Riattiva'))
      ?.click();
    await stabile();
    expect(dialoghi.conferma).not.toHaveBeenCalled();
    expect(funzioni.impostaStatoUtente).toHaveBeenCalledWith({ uid: 'c2', attivo: true });
  });

  it('«Reimposta password» invia l’email e conferma con un toast', async () => {
    const { sessione, pulsante, stabile, toast } = await monta();
    pulsante('Reimposta password')?.click();
    await stabile();
    expect(sessione.inviaLinkReimpostazione).toHaveBeenCalledWith('maria@esempio.it');
    expect(toast.messaggi().at(-1)?.testo).toBe('Email per reimpostare la password inviata.');
  });

  it('«Riassegna…» apre il dialogo con i soli coordinatori attivi diversi da quello attuale', async () => {
    const { dialoghi, pulsante, stabile } = await monta();
    dialoghi.apri.mockResolvedValue(undefined);
    pulsante('Riassegna…')?.click();
    await stabile();
    const dati = dialoghi.apri.mock.calls[0]?.[1];
    expect(dati.repartoNome).toBe('Radiologia');
    expect(dati.coordinatori.map((c: { uid: string }) => c.uid)).toEqual(['c3']);
  });

  it('un errore della callable è mostrato come toast d’errore (assertive)', async () => {
    const { funzioni, dialoghi, stabile, radice, toast } = await monta();
    dialoghi.conferma.mockResolvedValue(true);
    funzioni.impostaStatoUtente.mockRejectedValueOnce({ details: { codice: 'NON_COORDINATORE' } });
    radice.querySelector<HTMLButtonElement>('tbody tr app-menu button')?.click();
    await stabile();
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
      .find((v) => v.textContent?.includes('Disattiva…'))
      ?.click();
    await stabile();
    expect(toast.messaggi().at(-1)).toMatchObject({
      tipo: 'errore',
      testo: 'L’utente scelto non è un coordinatore.',
    });
  });

  it('«Nuovo coordinatore» chiuso con successo dà il toast di UX §7.11 e ricarica', async () => {
    const { dialoghi, pulsante, stabile, toast, utentiRepo } = await monta();
    dialoghi.apri.mockResolvedValue({ emailInviata: true });
    pulsante('Nuovo coordinatore')?.click();
    await stabile();
    expect(toast.messaggi().at(-1)?.testo).toBe(
      'Coordinatore creato: ha ricevuto l’email per impostare la password.',
    );
    expect(utentiRepo.tutti).toHaveBeenCalledTimes(2);
  });
});
