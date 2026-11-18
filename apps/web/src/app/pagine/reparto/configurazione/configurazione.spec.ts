import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { codiceAssenza, codiceTurno, oraLocale, type Ruolo } from '@turni/domain';
import { Sessione } from '../../../core/sessione.service';
import { AssenzeRepo, type AssenzaSalvata } from '../../../dati/assenze.repo';
import {
  ConfigurazioneRepo,
  type CampiReparto,
  type Operazione,
} from '../../../dati/configurazione.repo';
import { ElencoReparti } from '../../../dati/elenco-reparti';
import { RepartiRepo, type RepartoConfigurazione } from '../../../dati/reparti.repo';
import { TurniRepo, type TurnoSalvato } from '../../../dati/turni.repo';
import { elencoFinto, sessioneFinta } from '../../../test/finti';
import { ToastService } from '../../../ui/toast';
import { Configurazione } from './configurazione';

@Component({ selector: 'app-vuoto', template: '' })
class Vuoto {}

const PREDEFINITE: AssenzaSalvata[] = [
  {
    codice: codiceAssenza('R'),
    descrizione: 'Riposo',
    effetto: 'comeRiposo',
    malattia: false,
    predefinita: true,
    attivo: true,
    ordine: 0,
  },
  {
    codice: codiceAssenza('MA'),
    descrizione: 'Malattia',
    effetto: 'neutra',
    malattia: true,
    predefinita: true,
    attivo: true,
    ordine: 1,
  },
];

function reparto(passo: RepartoConfigurazione['passo']): RepartoConfigurazione {
  return {
    id: 'r1',
    nome: 'Radiologia',
    coordinatoreUid: 'u1',
    passo,
    attribuzioneNotte: 'inizio',
    festivita: { nazionaliEscluse: [], locali: [] },
  };
}

interface Salvataggio {
  readonly reparto: CampiReparto;
  readonly operazioni: readonly Operazione[];
}

async function monta(
  ruolo: Ruolo,
  opzioni: {
    passo?: RepartoConfigurazione['passo'];
    turni?: TurnoSalvato[];
    lettura?: () => Promise<RepartoConfigurazione | null>;
    salvaRifiuta?: boolean;
  } = {},
) {
  const salvataggi: Salvataggio[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'reparti/:rid/dipendenti', component: Vuoto }]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ rid: 'r1' })),
          snapshot: { paramMap: convertToParamMap({ rid: 'r1' }) },
        },
      },
      { provide: Sessione, useValue: sessioneFinta(ruolo) },
      { provide: ElencoReparti, useValue: elencoFinto([]) },
      {
        provide: RepartiRepo,
        useValue: {
          leggiConfigurazione:
            opzioni.lettura ?? (() => Promise.resolve(reparto(opzioni.passo ?? 'turni'))),
        },
      },
      { provide: TurniRepo, useValue: { elenco: () => Promise.resolve(opzioni.turni ?? []) } },
      { provide: AssenzeRepo, useValue: { elenco: () => Promise.resolve(PREDEFINITE) } },
      {
        provide: ConfigurazioneRepo,
        useValue: {
          salva: (_id: string, _uid: string, campi: CampiReparto, operazioni: Operazione[]) => {
            if (opzioni.salvaRifiuta === true) {
              return Promise.reject(new Error('rifiutato'));
            }
            salvataggi.push({ reparto: campi, operazioni });
            return Promise.resolve();
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(Configurazione);
  fixture.detectChanges();
  // Il caricamento è asincrono (promesse già risolte): si lascia girare la coda prima di leggere il DOM.
  for (let giro = 0; giro < 5; giro++) {
    await fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
    fixture.detectChanges();
  }
  return { fixture, radice: fixture.nativeElement as HTMLElement, salvataggi };
}

const testoDi = (e: Element): string => (e.textContent ?? '').replace(/\s+/g, ' ').trim();

function scrivi(campo: HTMLInputElement, valore: string): void {
  campo.value = valore;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

const riga = (radice: HTMLElement, codice: string): HTMLElement => {
  const trovata = radice.querySelector<HTMLElement>(`tr[data-codice="${codice}"]`);
  if (trovata === null) {
    throw new Error(`Riga ${codice} non trovata in: ${radice.innerHTML.slice(0, 1500)}`);
  }
  return trovata;
};

describe('Configurazione del reparto', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('un reparto nuovo parte dal modello M1, P1, N1 con durata e notturno calcolati', async () => {
    const { radice } = await monta('COORDINATORE');
    for (const codice of ['M1', 'P1', 'N1']) {
      expect(riga(radice, codice)).toBeTruthy();
    }
    expect(testoDi(riga(radice, 'M1').querySelector('[data-calcolo="durata"]') as Element)).toBe(
      '6 h 30',
    );
    expect(testoDi(riga(radice, 'N1').querySelector('[data-calcolo="durata"]') as Element)).toBe(
      '9 h',
    );
    expect(testoDi(riga(radice, 'N1').querySelector('[data-calcolo="notturno"]') as Element)).toBe(
      'sì',
    );
    expect(testoDi(riga(radice, 'M1').querySelector('[data-calcolo="notturno"]') as Element)).toBe(
      'no',
    );
    expect(testoDi(radice)).toContain('Tutto salvato.');
    // R e MA: predefinite, senza menu
    expect(testoDi(riga(radice, 'R'))).toContain('predefinita');
    expect(riga(radice, 'MA').querySelector('app-menu')).toBeNull();
  });

  it('cambiando gli orari mentre si digita, durata e notturno si aggiornano', async () => {
    const { fixture, radice } = await monta('COORDINATORE');
    const inizio = riga(radice, 'M1').querySelector<HTMLInputElement>('input[type="time"]');
    const durata = riga(radice, 'M1').querySelector('[data-calcolo="durata"]') as Element;
    scrivi(inizio as HTMLInputElement, '20:00');
    fixture.detectChanges();
    // 20:00-14:00 è notturno: la pausa proposta è 0 (D5), quindi 18 h.
    expect(testoDi(durata)).toBe('18 h');
    expect(testoDi(riga(radice, 'M1').querySelector('[data-calcolo="notturno"]') as Element)).toBe(
      'sì',
    );
    expect(testoDi(radice)).toContain('Ci sono modifiche non salvate.');
  });

  it('un codice che collide è segnalato con chi lo usa già', async () => {
    const { fixture, radice } = await monta('COORDINATORE');
    const aggiungi = Array.from(radice.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Aggiungi turno'),
    );
    aggiungi?.click();
    fixture.detectChanges();
    const campo = radice.querySelector<HTMLInputElement>('input[data-campo-codice]');
    scrivi(campo as HTMLInputElement, 'n1');
    fixture.detectChanges();
    expect(campo?.value).toBe('N1');
    expect(testoDi(radice)).toContain('Codice già usato da N1 Notte');
    scrivi(campo as HTMLInputElement, 'zz');
    fixture.detectChanges();
    expect(testoDi(radice)).toContain(
      'Il codice di un turno è una lettera e una cifra, per esempio M1.',
    );
  });

  it('«Salva modifiche» con un errore non scrive; poi mostra tutti gli errori', async () => {
    const { fixture, radice, salvataggi } = await monta('COORDINATORE');
    radice
      .querySelectorAll('button')
      .forEach((b) => b.textContent?.includes('Aggiungi turno') && b.click());
    fixture.detectChanges();
    const salva = Array.from(radice.querySelectorAll('button')).find(
      (b) => testoDi(b) === 'Salva modifiche',
    );
    salva?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(salvataggi).toHaveLength(0);
    expect(testoDi(radice)).toContain('Correggi i campi segnalati prima di salvare.');
    expect(testoDi(radice)).toContain('Scrivi il codice.');
    expect(testoDi(radice)).toContain('Scrivi il nome.');
  });

  it('un reparto non leggibile (null) mostra «Reparto non disponibile.»', async () => {
    const { radice } = await monta('COORDINATORE', { lettura: () => Promise.resolve(null) });
    expect(testoDi(radice)).toContain('Reparto non disponibile.');
    expect(testoDi(radice)).toContain('Torna alla Home');
  });

  it('un errore di lettura mostra il messaggio di errore e non la griglia', async () => {
    const { radice } = await monta('COORDINATORE', {
      lettura: () => Promise.reject(new Error('rete')),
    });
    expect(testoDi(radice)).toContain('Impossibile caricare la configurazione.');
    expect(radice.querySelector('tr[data-codice="M1"]')).toBeNull();
  });

  it('un salvataggio rifiutato mostra il toast e conserva la bozza', async () => {
    const { fixture, radice } = await monta('COORDINATORE', { salvaRifiuta: true });
    const errore = vi.spyOn(TestBed.inject(ToastService), 'errore');
    const inizio = riga(radice, 'M1').querySelector<HTMLInputElement>('input[type="time"]');
    scrivi(inizio as HTMLInputElement, '08:00');
    fixture.detectChanges();
    const salva = Array.from(radice.querySelectorAll('button')).find(
      (b) => testoDi(b) === 'Salva modifiche',
    );
    salva?.click();
    await fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
    fixture.detectChanges();
    expect(errore).toHaveBeenCalledWith(
      'Salvataggio non riuscito: riprova. Le modifiche sono conservate.',
    );
    expect(testoDi(radice)).toContain('Ci sono modifiche non salvate.');
    expect(riga(radice, 'M1').querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe(
      '08:00',
    );
  });

  it('«Salva e continua» scrive i tre turni del modello e avanza al passo dei dipendenti', async () => {
    const { fixture, radice, salvataggi } = await monta('COORDINATORE');
    const continua = Array.from(radice.querySelectorAll('button')).find(
      (b) => testoDi(b) === 'Salva e continua',
    );
    continua?.click();
    await fixture.whenStable();
    await new Promise<void>((risolvi) => setTimeout(risolvi, 0));
    expect(TestBed.inject(Router).url).toBe('/reparti/r1/dipendenti');
    expect(salvataggi).toHaveLength(1);
    expect(salvataggi[0]?.reparto.passo).toBe('dipendenti');
    expect(salvataggi[0]?.reparto.nome).toBe('Radiologia');
    expect(salvataggi[0]?.operazioni.map((o) => o.tipo)).toEqual([
      'creaTurno',
      'creaTurno',
      'creaTurno',
    ]);
  });

  it('una nazionale rimossa si ripristina e una locale si aggiunge', async () => {
    const { fixture, radice } = await monta('COORDINATORE');
    const rimuovi = radice.querySelector<HTMLButtonElement>('button[aria-label="Rimuovi Natale"]');
    rimuovi?.click();
    fixture.detectChanges();
    expect(radice.querySelector('tr[data-festivita="natale"]')).toBeNull();
    expect(testoDi(radice.querySelector('[data-festivita-rimosse]') as Element)).toContain(
      'Natale',
    );
    const ripristina = radice.querySelector<HTMLButtonElement>(
      'button[aria-label="Ripristina Natale"]',
    );
    ripristina?.click();
    fixture.detectChanges();
    expect(radice.querySelector('tr[data-festivita="natale"]')).not.toBeNull();
  });

  it('con la configurazione completata un turno salvato si può solo disattivare', async () => {
    const turno: TurnoSalvato = {
      codice: codiceTurno('M1'),
      tipo: 'turno',
      nome: 'Mattina',
      colore: 'arancio',
      inizio: oraLocale('07:00'),
      fine: oraLocale('14:00'),
      pausaMinuti: 30,
      notturno: false,
      attivo: true,
      ordine: 0,
    };
    const { radice } = await monta('COORDINATORE', { passo: 'completata', turni: [turno] });
    // Il codice di un turno salvato non è modificabile: nessun campo del codice.
    expect(radice.querySelector('[data-campo-codice]')).toBeNull();
    expect(radice.textContent).not.toContain('Salva e continua');
  });

  describe('ADMIN', () => {
    it('vede tutto in sola lettura: nessun campo, nessun pulsante di modifica', async () => {
      const { radice } = await monta('ADMIN');
      expect(testoDi(radice)).toContain('Sola consultazione (ADMIN)');
      expect(radice.querySelectorAll('input, select, textarea')).toHaveLength(2); // solo i radio dell'impostazione
      radice
        .querySelectorAll<HTMLInputElement>('input')
        .forEach((i) => expect(i.type).toBe('radio'));
      radice.querySelectorAll('fieldset').forEach((f) => expect(f.disabled).toBe(true));
      const pulsanti = Array.from(radice.querySelectorAll('button')).map(testoDi);
      expect(pulsanti.some((t) => /Salva|Aggiungi|Rimuovi|Ripristina/.test(t))).toBe(false);
      expect(radice.querySelector('app-menu')).toBeNull();
      expect(testoDi(riga(radice, 'M1'))).toContain('Mattina');
    });
  });
});
