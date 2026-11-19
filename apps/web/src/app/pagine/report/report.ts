// Schermata 7, «Report» di un reparto (UX §7.10, PIANO 4.1 criterio 5): schede «Bimestre» e «Festività dell'anno».
// Il coordinatore proprietario scarica e invia; l'ADMIN consulta e scarica (nessun pulsante di invio). La scheda, il
// bimestre e l'anno stanno nell'URL (`?scheda=bimestre|festivita&bimestre=AAAA-Bn&anno=AAAA`).
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  annoDelBimestre,
  bimestreDi,
  chiaveMeseDi,
  eIdBimestre,
  type ConfigurazioneFestivita,
  type IdBimestre,
} from '@turni/domain';
import { DATA_OGGI } from '../../core/ambiente';
import { Sessione } from '../../core/sessione.service';
import { DipendentiRepo, type DipendenteSalvato } from '../../dati/dipendenti.repo';
import { RepartiRepo } from '../../dati/reparti.repo';
import { testi } from '../../testi/it';
import { testiReport } from '../../testi/it-report';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import { SchedaBimestre } from './scheda-bimestre';
import { SchedaFestivita } from './scheda-festivita';

type Stato = 'caricamento' | 'pronto' | 'errore' | 'nonDisponibile';
type Scheda = 'bimestre' | 'festivita';

const ANNO_MINIMO = 2020;

@Component({
  selector: 'app-report',
  imports: [Button, EmptyState, Icona, RouterLink, SchedaBimestre, SchedaFestivita, TableScheletro],
  template: `
    @switch (stato()) {
      @case ('caricamento') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiReport.titolo }}</h1>
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiReport.titolo }}</h1>
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiReport.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonDisponibile') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiReport.titolo }}</h1>
        <app-empty-state [titolo]="testiReport.nonDisponibile" icona="info">
          <a appButton routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        <div class="mb-3 flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-titolo-pagina">{{ testiReport.titoloReparto(nomeReparto()) }}</h1>
          <nav
            [attr.aria-label]="testiReport.schede.etichetta"
            class="flex gap-1 rounded-campo border border-bordo p-0.5"
          >
            <a
              class="rounded-campo px-3 py-1"
              [class.bg-nota-sfondo]="scheda() === 'bimestre'"
              [class.font-semibold]="scheda() === 'bimestre'"
              [routerLink]="[]"
              [queryParams]="{ scheda: 'bimestre' }"
              queryParamsHandling="merge"
              [attr.aria-current]="scheda() === 'bimestre' ? 'page' : null"
              data-scheda="bimestre"
              >{{ testiReport.schede.bimestre }}</a
            >
            <a
              class="rounded-campo px-3 py-1"
              [class.bg-nota-sfondo]="scheda() === 'festivita'"
              [class.font-semibold]="scheda() === 'festivita'"
              [routerLink]="[]"
              [queryParams]="{ scheda: 'festivita' }"
              queryParamsHandling="merge"
              [attr.aria-current]="scheda() === 'festivita' ? 'page' : null"
              data-scheda="festivita"
              >{{ testiReport.schede.festivita }}</a
            >
          </nav>
        </div>

        @if (scheda() === 'bimestre') {
          <app-report-bimestre
            [repartoId]="repartoId()"
            [idBimestre]="idBimestre()"
            [bimestreMassimo]="bimestreCorrente()"
            [dipendenti]="dipendenti()"
            [puoInviare]="puoInviare()"
          />
        } @else {
          <app-report-festivita
            [repartoId]="repartoId()"
            [anno]="anno()"
            [annoMassimo]="annoCorrente()"
            [dipendenti]="dipendenti()"
            [festivita]="festivita()"
          />
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Report {
  protected readonly testi = testi;
  protected readonly testiReport = testiReport;
  private readonly rotta = inject(ActivatedRoute);
  private readonly oggi = inject(DATA_OGGI);
  private readonly sessione = inject(Sessione);
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly dipendentiRepo = inject(DipendentiRepo);

  private readonly parametri = toSignal(this.rotta.paramMap, {
    initialValue: this.rotta.snapshot.paramMap,
  });
  private readonly query = toSignal(this.rotta.queryParamMap, {
    initialValue: this.rotta.snapshot.queryParamMap,
  });

  protected readonly repartoId = computed(() => this.parametri().get('rid') ?? '');
  protected readonly bimestreCorrente = computed(() => bimestreDi(chiaveMeseDi(this.oggi())));
  protected readonly annoCorrente = computed(() => annoDelBimestre(this.bimestreCorrente()));
  protected readonly scheda = computed<Scheda>(() =>
    this.query().get('scheda') === 'festivita' ? 'festivita' : 'bimestre',
  );
  /** Il bimestre dell'URL, se è valido e non nel futuro; altrimenti quello in corso. */
  protected readonly idBimestre = computed<IdBimestre>(() => {
    const letto = this.query().get('bimestre');
    return letto !== null &&
      eIdBimestre(letto) &&
      letto >= `${ANNO_MINIMO}-B1` &&
      letto <= this.bimestreCorrente()
      ? letto
      : this.bimestreCorrente();
  });
  protected readonly anno = computed(() => {
    const letto = Number(this.query().get('anno'));
    return Number.isInteger(letto) && letto >= ANNO_MINIMO && letto <= this.annoCorrente()
      ? letto
      : this.annoCorrente();
  });
  /** Solo il coordinatore del reparto invia: l'ADMIN no (UX §7.10). */
  protected readonly puoInviare = computed(() => this.sessione.ruolo() === 'COORDINATORE');

  protected readonly stato = signal<Stato>('caricamento');
  protected readonly nomeReparto = signal('');
  protected readonly festivita = signal<ConfigurazioneFestivita>({
    nazionaliEscluse: [],
    locali: [],
  });
  protected readonly dipendenti = signal<readonly DipendenteSalvato[]>([]);
  private richiesta = 0;

  constructor() {
    effect(() => {
      this.repartoId();
      untracked(() => void this.carica());
    });
  }

  protected async carica(): Promise<void> {
    const numero = ++this.richiesta;
    const rid = this.repartoId();
    this.stato.set('caricamento');
    try {
      const reparto = await this.repartiRepo.leggiConfigurazione(rid);
      if (numero !== this.richiesta) {
        return;
      }
      if (reparto === null) {
        this.stato.set('nonDisponibile');
        return;
      }
      const dipendenti = await this.dipendentiRepo.elenco(rid);
      if (numero !== this.richiesta) {
        return;
      }
      this.nomeReparto.set(reparto.nome);
      this.festivita.set(reparto.festivita);
      this.dipendenti.set(dipendenti);
      this.stato.set('pronto');
    } catch {
      if (numero === this.richiesta) {
        this.stato.set('errore');
      }
    }
  }
}
