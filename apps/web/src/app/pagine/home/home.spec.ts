import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Ruolo } from '@turni/domain';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import type { RepartoSintesi } from '../../dati/reparti.repo';
import type { UtenteElenco } from '../../dati/utenti.repo';
import { coordinatoreDiProva, elencoFinto, repartoDiProva, sessioneFinta } from '../../test/finti';
import { Home } from './home';

function monta(ruolo: Ruolo, reparti: RepartoSintesi[], utenti: UtenteElenco[] = []) {
  const elenco = elencoFinto(reparti, utenti);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: Sessione, useValue: sessioneFinta(ruolo) },
      { provide: ElencoReparti, useValue: elenco },
    ],
  });
  const fixture = TestBed.createComponent(Home);
  fixture.detectChanges();
  const radice: HTMLElement = fixture.nativeElement;
  return { fixture, radice, elenco };
}

const testoDi = (elemento: Element): string =>
  (elemento.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('Home', () => {
  beforeEach(() => localStorage.clear());

  it('ha l’area «Avvisi aperti» predisposta e vuota (per tutti i ruoli)', () => {
    for (const ruolo of ['ADMIN', 'COORDINATORE'] as const) {
      TestBed.resetTestingModule();
      const { radice } = monta(ruolo, []);
      expect(testoDi(radice)).toContain('Avvisi aperti');
      expect(testoDi(radice)).toContain('Nessun avviso aperto');
    }
  });

  describe('COORDINATORE', () => {
    it('senza reparti: stato vuoto con «Crea il primo reparto» verso /reparti/nuovo', () => {
      const { radice } = monta('COORDINATORE', []);
      expect(testoDi(radice)).toContain('Non hai ancora reparti');
      const link = Array.from(radice.querySelectorAll('a')).find((a) =>
        a.textContent?.includes('Crea il primo reparto'),
      );
      expect(link?.getAttribute('href')).toBe('/reparti/nuovo');
    });

    it('con reparti: elenco con «Aggiungi reparto» e «Apri» verso il mese corrente', () => {
      const { radice } = monta('COORDINATORE', [
        repartoDiProva('r1', 'Radiologia'),
        repartoDiProva('r2', 'Cardiologia'),
      ]);
      const link = Array.from(radice.querySelectorAll('a'));
      const aggiungi = link.find((a) => a.textContent?.includes('Aggiungi reparto'));
      expect(aggiungi?.getAttribute('href')).toBe('/reparti/nuovo');
      const apri = link.filter((a) => a.textContent?.trim() === 'Apri');
      expect(apri.length).toBe(2);
      expect(apri[0]?.getAttribute('href')).toMatch(/^\/reparti\/r1\/mesi\/\d{4}-\d{2}$/);
    });

    it('un reparto da completare mostra «Riprendi» e il passo', () => {
      const { radice } = monta('COORDINATORE', [
        repartoDiProva('r1', 'Radiologia', 'u1', 'dipendenti'),
      ]);
      expect(testoDi(radice)).toContain('Configurazione da completare');
      expect(testoDi(radice)).toContain('passo 3 di 3');
      const riprendi = Array.from(radice.querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Riprendi',
      );
      expect(riprendi?.getAttribute('href')).toBe('/reparti/r1/dipendenti');
    });

    it('errore di caricamento: messaggio con «Riprova» che ricarica', () => {
      const { fixture, radice, elenco } = monta('COORDINATORE', []);
      elenco.impostaStato('errore');
      fixture.detectChanges();
      expect(testoDi(radice)).toContain('Impossibile caricare i reparti.');
      const riprova = Array.from(radice.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Riprova'),
      );
      riprova?.click();
      expect(elenco.carica).toHaveBeenLastCalledWith(true);
    });
  });

  describe('ADMIN', () => {
    const maria = coordinatoreDiProva('c1', 'Maria', 'Rossi');
    const paolo = coordinatoreDiProva('c2', 'Paolo', 'Neri', false);
    const reparti = [
      repartoDiProva('r1', 'Radiologia', 'c1'),
      repartoDiProva('r2', 'Cardiologia', 'c1'),
      repartoDiProva('r3', 'Ortopedia', 'c2'),
    ];

    it('mostra i reparti raggruppati per coordinatore, con «Disattivato» dove serve', () => {
      const { radice } = monta('ADMIN', reparti, [maria, paolo]);
      const titoli = Array.from(radice.querySelectorAll('h3')).map(testoDi);
      expect(titoli).toEqual(['Maria Rossi · 2 reparti', 'Paolo Neri · 1 reparto Disattivato']);
    });

    it('non ha azioni di modifica né pulsanti disabilitati: solo «Apri»', () => {
      const { radice } = monta('ADMIN', reparti, [maria, paolo]);
      expect(radice.querySelector('button')).toBeNull();
      expect(radice.querySelector('[disabled], [aria-disabled="true"]')).toBeNull();
      const testi = Array.from(radice.querySelectorAll('a')).map((a) => a.textContent?.trim());
      expect(testi).toEqual(['Apri', 'Apri', 'Apri']);
      expect(testoDi(radice)).not.toContain('Aggiungi reparto');
      expect(testoDi(radice)).not.toContain('Riprendi');
    });

    it('senza reparti: «Nessun reparto ancora creato dai coordinatori»', () => {
      const { radice } = monta('ADMIN', [], [maria]);
      expect(testoDi(radice)).toContain('Nessun reparto ancora creato dai coordinatori');
    });
  });
});
