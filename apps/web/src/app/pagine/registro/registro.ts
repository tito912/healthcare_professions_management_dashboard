// Registro attività (UX §7.12): consultazione, mai modifica. L'ADMIN filtra per reparto, utente, operazione e periodo
// su tutte le voci; il coordinatore vede solo quelle dei propri reparti. Pagine da 50 voci, le più recenti prima.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import {
  eDataISO,
  dataISO,
  limitiPeriodo,
  TIPI_OPERAZIONE,
  type DataISO,
  type TipoOperazione,
} from '@turni/domain';
import { Sessione } from '../../core/sessione.service';
import { DipendentiRepo } from '../../dati/dipendenti.repo';
import { ElencoReparti } from '../../dati/elenco-reparti';
import {
  AUTORE_SISTEMA,
  RegistroRepo,
  type FiltriRegistro,
  type FonteRegistro,
  type VoceRegistro,
} from '../../dati/registro.repo';
import type { PaginatoreUnito } from '../../dati/registro.paginatore';
import { testi } from '../../testi/it';
import { testiRegistro } from '../../testi/it-registro';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { Input } from '../../ui/input';
import { Select, type OpzioneSelect } from '../../ui/select';
import { Table, TableScheletro } from '../../ui/table';
import { rigaDiVoce, type RigaRegistro } from './modello';

type StatoRegistro = 'caricamento' | 'pronto' | 'errore';

@Component({
  selector: 'app-registro',
  imports: [Button, EmptyState, Icona, Input, Select, Table, TableScheletro],
  template: `
    <h1 class="text-titolo-pagina">{{ testiRegistro.titolo }}</h1>
    <p class="mt-1 mb-4 text-testo-secondario">{{ testiRegistro.descrizione }}</p>

    <form
      class="mb-4 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] items-end gap-3"
      role="search"
      [attr.aria-label]="testiRegistro.filtri.gruppo"
      (submit)="$event.preventDefault()"
    >
      <app-select
        [etichetta]="testiRegistro.filtri.reparto"
        [segnaposto]="testiRegistro.filtri.tutti"
        [opzioni]="opzioniReparto()"
        [(valore)]="repartoId"
      />
      <app-select
        [etichetta]="testiRegistro.filtri.utente"
        [segnaposto]="testiRegistro.filtri.tutti"
        [opzioni]="opzioniUtente()"
        [(valore)]="autore"
      />
      <app-select
        [etichetta]="testiRegistro.filtri.operazione"
        [segnaposto]="testiRegistro.filtri.tutte"
        [opzioni]="opzioniOperazione"
        [(valore)]="tipo"
      />
      <app-input tipo="date" [etichetta]="testiRegistro.filtri.dal" [(valore)]="dal" />
      <app-input
        tipo="date"
        [etichetta]="testiRegistro.filtri.al"
        [errore]="periodoValido() ? '' : testiRegistro.periodoNonValido"
        [(valore)]="al"
      />
      @if (filtriAttivi()) {
        <button appButton type="button" (click)="azzera()">
          {{ testiRegistro.filtri.azzera }}
        </button>
      }
    </form>

    @switch (stato()) {
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiRegistro.errore }}</p>
          <button appButton type="button" (click)="avvia()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('pronto') {
        @if (righe().length === 0) {
          <app-empty-state
            [titolo]="testiRegistro.vuoto"
            [testo]="testiRegistro.vuotoDescrizione"
            icona="info"
          />
        } @else {
          <app-table [etichetta]="testiRegistro.tabella">
            <thead>
              <tr>
                <th scope="col">{{ testiRegistro.colonne.dataOra }}</th>
                <th scope="col">{{ testiRegistro.colonne.utente }}</th>
                <th scope="col">{{ testiRegistro.colonne.reparto }}</th>
                <th scope="col">{{ testiRegistro.colonne.operazione }}</th>
                <th scope="col">{{ testiRegistro.colonne.dettagli }}</th>
              </tr>
            </thead>
            <tbody>
              @for (riga of righe(); track riga.id) {
                <tr data-voce>
                  <td class="whitespace-nowrap">{{ riga.dataOra }}</td>
                  <td>{{ riga.utente }}</td>
                  <td>{{ riga.reparto }}</td>
                  <td>{{ riga.operazione }}</td>
                  <td class="break-words">{{ riga.dettagli }}</td>
                </tr>
              }
            </tbody>
          </app-table>
          @if (errorePagina()) {
            <p role="alert" class="mt-2 text-blocco-testo">{{ testiRegistro.errorePagina }}</p>
          }
          @if (ancora()) {
            <div class="mt-4 flex justify-center">
              <button
                appButton
                type="button"
                [caricamento]="caricandoAltre()"
                (click)="caricaAltre()"
              >
                {{ testiRegistro.caricaAltre }}
              </button>
            </div>
          }
        }
      }
      @default {
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Registro implements OnInit {
  protected readonly testi = testi;
  protected readonly testiRegistro = testiRegistro;
  private readonly sessione = inject(Sessione);
  private readonly elenco = inject(ElencoReparti);
  private readonly repo = inject(RegistroRepo);
  private readonly dipendentiRepo = inject(DipendentiRepo);

  protected readonly repartoId = signal('');
  protected readonly autore = signal('');
  protected readonly tipo = signal('');
  protected readonly dal = signal('');
  protected readonly al = signal('');

  protected readonly stato = signal<StatoRegistro>('caricamento');
  protected readonly voci = signal<readonly VoceRegistro[]>([]);
  protected readonly ancora = signal(false);
  protected readonly caricandoAltre = signal(false);
  protected readonly errorePagina = signal(false);
  /** Reparto -> (dipendente -> «Cognome Nome»): letto una volta per reparto che compare nelle voci. */
  private readonly dipendenti = signal<ReadonlyMap<string, ReadonlyMap<string, string>>>(new Map());
  private readonly dipendentiRichiesti = new Set<string>();

  private paginatore: PaginatoreUnito<VoceRegistro> | null = null;
  private lettura = 0;

  private readonly eAdmin = computed(() => this.sessione.ruolo() === 'ADMIN');

  protected readonly opzioniOperazione: readonly OpzioneSelect[] = TIPI_OPERAZIONE.map((t) => ({
    valore: t,
    etichetta: testiRegistro.operazioni[t],
  }));

  protected readonly opzioniReparto = computed<readonly OpzioneSelect[]>(() =>
    [...this.elenco.reparti()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
      .map((r) => ({ valore: r.id, etichetta: r.nome })),
  );

  protected readonly opzioniUtente = computed<readonly OpzioneSelect[]>(() => {
    const utenti = this.eAdmin()
      ? this.elenco.utenti().map((u) => ({ valore: u.uid, etichetta: `${u.nome} ${u.cognome}` }))
      : [this.sessione.utente()].flatMap((u) =>
          u === null ? [] : [{ valore: u.uid, etichetta: `${u.nome} ${u.cognome}` }],
        );
    return [...utenti, { valore: AUTORE_SISTEMA, etichetta: testiRegistro.filtri.sistema }];
  });

  protected readonly periodoValido = computed(() => {
    const dal = this.dataFiltro(this.dal());
    const al = this.dataFiltro(this.al());
    return dal === null || al === null || dal <= al;
  });

  protected readonly filtriAttivi = computed(
    () =>
      this.repartoId() !== '' ||
      this.autore() !== '' ||
      this.tipo() !== '' ||
      this.dal() !== '' ||
      this.al() !== '',
  );

  /** Filtri in forma di query; `null` se il periodo non è valido (nessuna lettura finché non si corregge). */
  private readonly filtri = computed<FiltriRegistro | null>(() => {
    if (!this.periodoValido()) {
      return null;
    }
    const limiti = limitiPeriodo(this.dataFiltro(this.dal()), this.dataFiltro(this.al()));
    const tipo = TIPI_OPERAZIONE.find((t) => t === this.tipo()) ?? null;
    return {
      repartoId: this.repartoId() === '' ? null : this.repartoId(),
      autore: this.autore() === '' ? null : this.autore(),
      tipo,
      daMs: limiti.daMs,
      aMs: limiti.aMs,
    };
  });

  protected readonly righe = computed<readonly RigaRegistro[]>(() => {
    const reparti = new Map(this.elenco.reparti().map((r) => [r.id, r.nome]));
    const dipendenti = this.dipendenti();
    return this.voci().map((voce) =>
      rigaDiVoce(voce, {
        nomeReparto: (id) => reparti.get(id),
        nomeDipendente: (repartoId, dipendenteId) => {
          const elencoReparto = dipendenti.get(repartoId);
          return elencoReparto === undefined
            ? undefined
            : (elencoReparto.get(dipendenteId) ?? null);
        },
      }),
    );
  });

  constructor() {
    effect(() => {
      const filtri = this.filtri();
      if (this.elenco.stato() === 'pronto' && filtri !== null) {
        untracked(() => this.avvia());
      }
    });
  }

  ngOnInit(): void {
    void this.elenco.carica();
  }

  private dataFiltro(valore: string): DataISO | null {
    return eDataISO(valore) ? dataISO(valore) : null;
  }

  protected azzera(): void {
    this.repartoId.set('');
    this.autore.set('');
    this.tipo.set('');
    this.dal.set('');
    this.al.set('');
  }

  private fonti(filtri: FiltriRegistro): readonly FonteRegistro[] {
    if (this.eAdmin()) {
      return [{ tipo: 'tutte' }];
    }
    const propri = this.elenco.reparti().map((r) => r.id);
    const scelti =
      filtri.repartoId === null ? propri : propri.filter((id) => id === filtri.repartoId);
    return scelti.map((id) => ({ tipo: 'reparto', id }));
  }

  /** Riparte dalla prima pagina con i filtri correnti. */
  protected avvia(): void {
    const filtri = this.filtri();
    if (filtri === null) {
      return;
    }
    const numero = ++this.lettura;
    this.stato.set('caricamento');
    this.errorePagina.set(false);
    this.voci.set([]);
    this.ancora.set(false);
    this.paginatore = this.repo.apri(this.fonti(filtri), filtri);
    void this.leggiPagina(numero, false);
  }

  protected caricaAltre(): void {
    if (this.paginatore !== null && !this.caricandoAltre()) {
      void this.leggiPagina(this.lettura, true);
    }
  }

  private async leggiPagina(numero: number, aggiunta: boolean): Promise<void> {
    const paginatore = this.paginatore;
    if (paginatore === null) {
      return;
    }
    this.caricandoAltre.set(aggiunta);
    this.errorePagina.set(false);
    try {
      const pagina = await paginatore.successiva();
      if (numero !== this.lettura) {
        return;
      }
      this.voci.update((voci) => [...voci, ...pagina.elementi]);
      this.ancora.set(pagina.ancora);
      this.stato.set('pronto');
      void this.caricaNomiDipendenti(pagina.elementi);
    } catch {
      if (numero === this.lettura) {
        if (aggiunta) {
          this.errorePagina.set(true);
        } else {
          this.stato.set('errore');
        }
      }
    } finally {
      if (numero === this.lettura) {
        this.caricandoAltre.set(false);
      }
    }
  }

  /** Per ogni reparto che compare con un dipendente si legge l'anagrafica una volta sola (i nomi non stanno nel registro). */
  private async caricaNomiDipendenti(voci: readonly VoceRegistro[]): Promise<void> {
    const reparti = new Set(
      voci.flatMap((v) => (v.dipendenteId !== null && v.repartoId !== null ? [v.repartoId] : [])),
    );
    for (const repartoId of reparti) {
      if (this.dipendentiRichiesti.has(repartoId)) {
        continue;
      }
      this.dipendentiRichiesti.add(repartoId);
      try {
        const elenco = await this.dipendentiRepo.elenco(repartoId);
        this.dipendenti.update(
          (corrente) =>
            new Map([
              ...corrente,
              [repartoId, new Map(elenco.map((d) => [d.id, `${d.cognome} ${d.nome}`]))],
            ]),
        );
      } catch {
        // Senza anagrafica il dettaglio mostra solo i codici: si riprova alla prossima apertura della pagina.
        this.dipendentiRichiesti.delete(repartoId);
      }
    }
  }
}
