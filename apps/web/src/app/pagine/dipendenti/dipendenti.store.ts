import { computed, inject, Injectable, signal } from '@angular/core';
import { oggi, statoDipendente, type StatoDipendente } from '@turni/domain';
import { DipendentiRepo, type DipendenteSalvato } from '../../dati/dipendenti.repo';
import { RepartiRepo, type RepartoSintesi } from '../../dati/reparti.repo';
import { TurniRepo, type TurnoSalvato } from '../../dati/turni.repo';

export type StatoElencoDipendenti = 'caricamento' | 'pronto' | 'errore' | 'nonDisponibile';
export type FiltroDipendenti = 'inServizio' | 'cessati' | 'tutti';

/** Minuscolo e senza accenti: «Nicolò» si trova scrivendo «nico». */
export function perRicerca(testo: string): string {
  return testo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('it')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface RigaDipendente {
  readonly dipendente: DipendenteSalvato;
  readonly stato: StatoDipendente;
}

/**
 * Stato condiviso dell'elenco e della scheda (UX §7.5): reparto, dipendenti e turni del reparto. Si fornisce
 * dalla rotta `reparti/:rid/dipendenti`, così la scheda (rotta figlia) vede gli stessi dati dell'elenco.
 */
@Injectable()
export class DipendentiStore {
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly dipendentiRepo = inject(DipendentiRepo);
  private readonly turniRepo = inject(TurniRepo);

  readonly stato = signal<StatoElencoDipendenti>('caricamento');
  readonly reparto = signal<RepartoSintesi | null>(null);
  readonly dipendenti = signal<readonly DipendenteSalvato[]>([]);
  readonly turni = signal<readonly TurnoSalvato[]>([]);
  readonly ricerca = signal('');
  readonly filtro = signal<FiltroDipendenti>('inServizio');

  /** Il giorno corrente si legge una volta per caricamento (dal dominio). */
  readonly oggi = signal(oggi());

  readonly righe = computed<readonly RigaDipendente[]>(() => {
    const oggiCorrente = this.oggi();
    return this.dipendenti()
      .map((dipendente) => ({ dipendente, stato: statoDipendente(dipendente, oggiCorrente) }))
      .sort(
        (a, b) =>
          a.dipendente.cognome.localeCompare(b.dipendente.cognome, 'it') ||
          a.dipendente.nome.localeCompare(b.dipendente.nome, 'it'),
      );
  });

  readonly righeVisibili = computed(() => {
    const filtro = this.filtro();
    const ricerca = perRicerca(this.ricerca());
    return this.righe().filter(({ dipendente, stato }) => {
      const cessato = stato === 'cessato';
      if ((filtro === 'inServizio' && cessato) || (filtro === 'cessati' && !cessato)) {
        return false;
      }
      return (
        ricerca === '' ||
        perRicerca(`${dipendente.cognome} ${dipendente.nome}`).includes(ricerca) ||
        perRicerca(`${dipendente.nome} ${dipendente.cognome}`).includes(ricerca)
      );
    });
  });

  readonly turnoPerCodice = computed(() => new Map(this.turni().map((t) => [t.codice, t])));

  /** Ci sono dipendenti (anche cessati): abilita «Fine: vai alla pianificazione». */
  readonly haDipendenti = computed(() => this.dipendenti().length > 0);

  /** Reparto, dipendenti e turni. `silenzioso`: rilettura dopo un salvataggio, senza lo scheletro. */
  async carica(repartoId: string, silenzioso = false): Promise<void> {
    if (!silenzioso) {
      this.stato.set('caricamento');
    }
    try {
      const reparto = await this.repartiRepo.leggiConfigurazione(repartoId);
      if (reparto === null) {
        this.reparto.set(null);
        this.dipendenti.set([]);
        this.stato.set('nonDisponibile');
        return;
      }
      const [dipendenti, turni] = await Promise.all([
        this.dipendentiRepo.elenco(repartoId),
        this.turniRepo.elenco(repartoId),
      ]);
      this.oggi.set(oggi());
      this.reparto.set(reparto);
      this.dipendenti.set(dipendenti);
      this.turni.set(turni);
      this.stato.set('pronto');
    } catch {
      this.stato.set('errore');
    }
  }
}
