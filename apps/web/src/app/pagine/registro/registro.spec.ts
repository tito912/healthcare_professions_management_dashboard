// Test di componente del Registro attività (UX §7.12): ADMIN e coordinatore, filtri, «Carica altre», errori.
import { TestBed } from '@angular/core/testing';
import type { Ruolo } from '@turni/domain';
import { vi } from 'vitest';
import { Sessione } from '../../core/sessione.service';
import { DipendentiRepo } from '../../dati/dipendenti.repo';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { RegistroRepo, type FiltriRegistro, type VoceRegistro } from '../../dati/registro.repo';
import { coordinatoreDiProva, elencoFinto, repartoDiProva, sessioneFinta } from '../../test/finti';
import { testoDi } from '../../test/monta-griglia';
import { Registro } from './registro';

const ISTANTE = Date.UTC(2026, 10, 17, 13, 32);

function voce(id: string, parziale: Partial<VoceRegistro> = {}): VoceRegistro {
  return {
    id,
    ilMs: ISTANTE,
    tipo: 'mese.convalidato',
    autoreUid: 'u1',
    autoreNome: 'Maria Rossi',
    repartoId: 'r1',
    chiaveMese: '2026-11',
    dipendenteId: null,
    dettagli: {},
    ...parziale,
  };
}

interface Opzioni {
  readonly ruolo?: Ruolo;
  readonly pagine?: readonly (readonly VoceRegistro[])[];
  readonly errore?: boolean;
}

async function monta(opzioni: Opzioni = {}) {
  const pagine = [...(opzioni.pagine ?? [[voce('v1')]])];
  const successiva = vi.fn(() =>
    opzioni.errore === true
      ? Promise.reject(new Error('rete'))
      : Promise.resolve({ elementi: pagine.shift() ?? [], ancora: pagine.length > 0 }),
  );
  const apri = vi.fn((_fonti: unknown, _filtri: FiltriRegistro) => ({ successiva }));
  const elenco = elencoFinto(
    [repartoDiProva('r1', 'Radiologia', 'u1'), repartoDiProva('r2', 'Ortopedia', 'u1')],
    [coordinatoreDiProva('u1', 'Maria', 'Rossi')],
  );
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: Sessione, useValue: sessioneFinta(opzioni.ruolo ?? 'ADMIN') },
      { provide: ElencoReparti, useValue: elenco },
      { provide: RegistroRepo, useValue: { apri } },
      { provide: DipendentiRepo, useValue: { elenco: () => Promise.resolve([]) } },
    ],
  });
  const fixture = TestBed.createComponent(Registro);
  const radice = fixture.nativeElement as HTMLElement;
  const assesta = async (): Promise<void> => {
    for (let i = 0; i < 4; i += 1) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  };
  await assesta();
  return { fixture, radice, apri, successiva, elenco, assesta };
}

function campo(radice: HTMLElement, etichetta: string): HTMLSelectElement | HTMLInputElement {
  const label = Array.from(radice.querySelectorAll('label')).find((l) =>
    testoDi(l).startsWith(etichetta),
  );
  const id = label?.getAttribute('for');
  const trovato = id === null || id === undefined ? null : radice.querySelector(`#${id}`);
  if (!(trovato instanceof HTMLSelectElement || trovato instanceof HTMLInputElement)) {
    throw new Error(`Campo «${etichetta}» non trovato`);
  }
  return trovato;
}

function imposta(c: HTMLSelectElement | HTMLInputElement, valore: string): void {
  c.value = valore;
  c.dispatchEvent(new Event(c instanceof HTMLSelectElement ? 'change' : 'input'));
}

describe('Registro attività', () => {
  it('ADMIN: legge tutte le voci con una sola fonte e mostra data, utente, reparto, operazione e dettagli', async () => {
    const t = await monta();
    expect(testoDi(t.radice.querySelector('h1') as Element)).toBe('Registro attività');
    expect(t.apri).toHaveBeenCalledTimes(1);
    expect(t.apri.mock.calls[0]?.[0]).toEqual([{ tipo: 'tutte' }]);
    const celle = Array.from(t.radice.querySelectorAll('tr[data-voce] td')).map(testoDi);
    expect(celle).toEqual([
      '17/11/2026 14:32',
      'Maria Rossi',
      'Radiologia',
      'Mese convalidato',
      '2026-11',
    ]);
  });

  it('coordinatore: una fonte per ciascun proprio reparto; il filtro reparto la restringe', async () => {
    const t = await monta({ ruolo: 'COORDINATORE' });
    expect(t.apri.mock.calls[0]?.[0]).toEqual([
      { tipo: 'reparto', id: 'r1' },
      { tipo: 'reparto', id: 'r2' },
    ]);
    imposta(campo(t.radice, 'Reparto'), 'r2');
    await t.assesta();
    expect(t.apri.mock.calls.at(-1)?.[0]).toEqual([{ tipo: 'reparto', id: 'r2' }]);
  });

  it('i filtri diventano i vincoli della query e «Azzera» li toglie', async () => {
    const t = await monta();
    imposta(campo(t.radice, 'Operazione'), 'consuntivo.modificato');
    imposta(campo(t.radice, 'Utente'), 'SISTEMA');
    imposta(campo(t.radice, 'Dal'), '2026-11-01');
    imposta(campo(t.radice, 'Al'), '2026-11-17');
    await t.assesta();
    const filtri = t.apri.mock.calls.at(-1)?.[1];
    expect(filtri).toMatchObject({
      repartoId: null,
      autore: 'SISTEMA',
      tipo: 'consuntivo.modificato',
    });
    // 01/11/2026 00:00 e 18/11/2026 00:00 a Roma (ora solare).
    expect(filtri?.daMs).toBe(Date.UTC(2026, 9, 31, 23, 0));
    expect(filtri?.aMs).toBe(Date.UTC(2026, 10, 17, 23, 0));

    const azzera = Array.from(t.radice.querySelectorAll('button')).find((b) =>
      testoDi(b).includes('Azzera'),
    );
    azzera?.click();
    await t.assesta();
    expect(t.apri.mock.calls.at(-1)?.[1]).toEqual({
      repartoId: null,
      autore: null,
      tipo: null,
      daMs: null,
      aMs: null,
    });
  });

  it('un periodo con la fine prima dell’inizio mostra l’errore e non legge', async () => {
    const t = await monta();
    const letture = t.apri.mock.calls.length;
    imposta(campo(t.radice, 'Dal'), '2026-11-17');
    imposta(campo(t.radice, 'Al'), '2026-11-01');
    await t.assesta();
    expect(t.radice.textContent).toContain('La data finale precede quella iniziale.');
    expect(t.apri.mock.calls.length).toBe(letture);
  });

  it('«Carica altre» aggiunge la pagina successiva e scompare alla fine', async () => {
    const t = await monta({ pagine: [[voce('v1')], [voce('v2'), voce('v3')]] });
    const altre = (): HTMLButtonElement | undefined =>
      Array.from(t.radice.querySelectorAll('button')).find((b) => testoDi(b) === 'Carica altre');
    expect(t.radice.querySelectorAll('tr[data-voce]').length).toBe(1);
    altre()?.click();
    await t.assesta();
    expect(t.radice.querySelectorAll('tr[data-voce]').length).toBe(3);
    expect(altre()).toBeUndefined();
    expect(t.apri).toHaveBeenCalledTimes(1);
  });

  it('senza voci mostra lo stato vuoto', async () => {
    const t = await monta({ pagine: [[]] });
    expect(t.radice.textContent).toContain('Nessuna voce corrisponde ai filtri.');
  });

  it('se la lettura fallisce mostra l’errore e «Riprova» rilegge', async () => {
    const t = await monta({ errore: true });
    expect(t.radice.querySelector('[role="alert"]')?.textContent).toContain(
      'Impossibile leggere il registro',
    );
    const letture = t.apri.mock.calls.length;
    Array.from(t.radice.querySelectorAll('[role="alert"] button'))
      .find((b) => testoDi(b) === 'Riprova')
      ?.dispatchEvent(new Event('click'));
    await t.assesta();
    expect(t.apri.mock.calls.length).toBe(letture + 1);
  });

  it('non offre nessuna azione di modifica', async () => {
    const t = await monta();
    expect(t.radice.querySelectorAll('input:not([type="date"]), textarea').length).toBe(0);
  });
});
