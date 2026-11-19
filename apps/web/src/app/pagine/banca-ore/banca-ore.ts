// Schermata 6, «Banca ore» (UX §7.8, PIANO 3.2 criterio 5): un dipendente per riga, una colonna per mese con il solo
// saldo, riporto e totale dell'anno fissi a destra, selettore dell'anno. I valori li scrive il trigger (D4); qui si
// leggono soltanto. Credito e debito si distinguono per segno e colore, il provvisorio (mese in bozza) per «≈» e
// corsivo; il clic sul nome apre il dettaglio del dipendente. Il coordinatore e l'ADMIN la vedono allo stesso modo.
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DATA_OGGI } from '../../core/ambiente';
import { BancaOreRepo, type BancaOreSalvata } from '../../dati/banca-ore.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../../dati/dipendenti.repo';
import { RepartiRepo } from '../../dati/reparti.repo';
import { testi } from '../../testi/it';
import { testiBancaOre } from '../../testi/it-banca-ore';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import { righeBancaOre, type SaldoVista } from './modello';

const ANNO_MINIMO = 2020;

type Stato = 'caricamento' | 'pronto' | 'errore' | 'nonDisponibile';

@Component({
  selector: 'app-banca-ore',
  imports: [Button, EmptyState, Icona, RouterLink, TableScheletro],
  template: `
    @switch (stato()) {
      @case ('caricamento') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiBancaOre.titolo }}</h1>
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiBancaOre.titolo }}</h1>
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiBancaOre.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonDisponibile') {
        <h1 class="mb-4 text-titolo-pagina">{{ testiBancaOre.titolo }}</h1>
        <app-empty-state [titolo]="testiBancaOre.nonDisponibile" icona="info">
          <a appButton routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        <div class="mb-3 flex flex-wrap items-center justify-between gap-4">
          <h1 class="text-titolo-pagina">{{ testiBancaOre.titoloReparto(nomeReparto()) }}</h1>
          <div class="flex items-center gap-4">
            <div
              class="flex items-center gap-1"
              role="group"
              [attr.aria-label]="testiBancaOre.anno"
            >
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                [attr.aria-label]="testiBancaOre.annoPrecedente"
                [disabled]="anno() <= annoMinimo"
                (click)="vaiAdAnno(anno() - 1)"
              >
                <app-icona nome="frecciaSinistra" />
              </button>
              <span class="min-w-16 text-center text-titolo-sezione" data-anno>{{ anno() }}</span>
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                [attr.aria-label]="testiBancaOre.annoSuccessivo"
                [disabled]="anno() >= annoMassimo()"
                (click)="vaiAdAnno(anno() + 1)"
              >
                <app-icona nome="frecciaDestra" />
              </button>
            </div>
            <label class="flex items-center gap-2">
              <span class="sr-only">{{ testiBancaOre.ricerca }}</span>
              <input
                type="search"
                autocomplete="off"
                class="h-controllo w-56 rounded-campo border border-bordo bg-sfondo px-2"
                [placeholder]="testiBancaOre.ricerca + '…'"
                [value]="ricerca()"
                (input)="ricerca.set(testoCampo($event))"
              />
            </label>
          </div>
        </div>

        @if (righe().length === 0) {
          <app-empty-state
            [titolo]="
              ricerca() === '' ? testiBancaOre.nessunDipendente : testiBancaOre.nessunRisultato
            "
            icona="banca"
          />
        } @else {
          <div class="overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
            <table class="w-full border-collapse text-tabella">
              <caption class="sr-only">
                {{
                  testiBancaOre.tabella(anno())
                }}
              </caption>
              <thead>
                <tr class="bg-sfondo-neutro">
                  <th
                    scope="col"
                    class="sticky left-0 z-10 h-riga min-w-40 border-b border-bordo bg-sfondo-neutro px-3 text-left font-semibold"
                  >
                    {{ testiBancaOre.dipendente }}
                  </th>
                  @for (mese of testi.mesiBrevi; track mese) {
                    <th
                      scope="col"
                      class="h-riga min-w-14 border-b border-bordo px-2 text-right font-semibold"
                    >
                      {{ mese }}
                    </th>
                  }
                  <th
                    scope="col"
                    class="sticky right-24 z-10 h-riga min-w-20 border-b border-l border-bordo bg-sfondo-neutro px-2 text-right font-semibold"
                  >
                    {{ testiBancaOre.riporto }}
                  </th>
                  <th
                    scope="col"
                    class="sticky right-0 z-10 h-riga min-w-24 border-b border-bordo bg-sfondo-neutro px-2 text-right font-semibold"
                  >
                    {{ testiBancaOre.totale(anno()) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (r of righe(); track r.id) {
                  <tr>
                    <th
                      scope="row"
                      class="sticky left-0 z-10 h-riga border-b border-bordo bg-sfondo px-3 text-left font-medium"
                    >
                      <a
                        class="flex items-center gap-1 text-testo hover:underline"
                        [routerLink]="['/reparti', repartoId(), 'banca-ore', r.id]"
                        [queryParams]="{ anno: anno() }"
                        [attr.title]="r.nomeCompleto"
                        [attr.aria-label]="testiBancaOre.apriDettaglio(r.nomeCompleto)"
                      >
                        <span class="truncate">{{ r.nome }}</span>
                        <span aria-hidden="true">›</span>
                      </a>
                    </th>
                    @for (m of r.mesi; track $index) {
                      <td
                        class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                        [class.text-credito]="m?.segno === 'credito'"
                        [class.text-debito]="m?.segno === 'debito'"
                        [class.italic]="m?.provvisorio"
                        [attr.title]="m?.provvisorio ? testiBancaOre.provvisorio : null"
                        [attr.aria-label]="etichettaMese($index, m)"
                        [attr.data-mese]="$index + 1"
                      >
                        @if (m === null) {
                          <span class="text-testo-secondario" aria-hidden="true">—</span>
                        } @else {
                          {{ m.testo }}
                        }
                      </td>
                    }
                    <td
                      class="sticky right-24 z-10 h-riga border-b border-l border-bordo bg-sfondo px-2 text-right tabular-nums"
                      [class.text-credito]="r.riporto.segno === 'credito'"
                      [class.text-debito]="r.riporto.segno === 'debito'"
                      data-riporto
                    >
                      {{ r.riporto.testo }}
                    </td>
                    <td
                      class="sticky right-0 z-10 h-riga border-b border-bordo bg-sfondo px-2 text-right font-medium tabular-nums"
                      [class.text-credito]="r.totale.segno === 'credito'"
                      [class.text-debito]="r.totale.segno === 'debito'"
                      [class.italic]="r.totale.provvisorio"
                      [attr.title]="r.totale.provvisorio ? testiBancaOre.totaleProvvisorio : null"
                      data-totale
                    >
                      {{ r.totale.testo }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-nota text-testo-secondario">{{ testiBancaOre.legenda }}</p>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BancaOre {
  protected readonly testi = testi;
  protected readonly testiBancaOre = testiBancaOre;
  protected readonly annoMinimo = ANNO_MINIMO;
  private readonly rotta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly oggi = inject(DATA_OGGI);
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly dipendentiRepo = inject(DipendentiRepo);
  private readonly bancaOreRepo = inject(BancaOreRepo);

  private readonly parametri = toSignal(this.rotta.paramMap, {
    initialValue: this.rotta.snapshot.paramMap,
  });
  private readonly query = toSignal(this.rotta.queryParamMap, {
    initialValue: this.rotta.snapshot.queryParamMap,
  });

  protected readonly repartoId = computed(() => this.parametri().get('rid') ?? '');
  protected readonly annoCorrente = computed(() => Number(this.oggi().slice(0, 4)));
  protected readonly annoMassimo = computed(() => this.annoCorrente() + 1);
  /** L'anno nell'URL (`?anno=2026`), se è un anno ragionevole; altrimenti l'anno corrente. */
  protected readonly anno = computed(() => {
    const letto = Number(this.query().get('anno'));
    return Number.isInteger(letto) && letto >= ANNO_MINIMO && letto <= this.annoMassimo()
      ? letto
      : this.annoCorrente();
  });

  protected readonly stato = signal<Stato>('caricamento');
  protected readonly nomeReparto = signal('');
  protected readonly ricerca = signal('');
  private readonly dipendenti = signal<readonly DipendenteSalvato[]>([]);
  private readonly banche = signal<readonly BancaOreSalvata[]>([]);
  private richiesta = 0;

  protected readonly righe = computed(() =>
    righeBancaOre(this.dipendenti(), this.banche(), this.ricerca()),
  );

  constructor() {
    effect(() => {
      this.repartoId();
      this.anno();
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
      const [dipendenti, banche] = await Promise.all([
        this.dipendentiRepo.elenco(rid),
        this.bancaOreRepo.anno(rid, this.anno()),
      ]);
      if (numero !== this.richiesta) {
        return;
      }
      this.nomeReparto.set(reparto.nome);
      this.dipendenti.set(dipendenti);
      this.banche.set(banche);
      this.stato.set('pronto');
    } catch {
      if (numero === this.richiesta) {
        this.stato.set('errore');
      }
    }
  }

  protected vaiAdAnno(anno: number): void {
    void this.router.navigate([], { relativeTo: this.rotta, queryParams: { anno } });
  }

  protected testoCampo(evento: Event): string {
    return evento.target instanceof HTMLInputElement ? evento.target.value : '';
  }

  protected etichettaMese(indice: number, saldo: SaldoVista | null): string {
    const mese = testi.mesiBrevi[indice] ?? '';
    return saldo === null
      ? `${mese}: ${testiBancaOre.meseNonCreato}`
      : testiBancaOre.saldoMese(mese, saldo.testo.replace('≈', ''), saldo.provvisorio);
  }
}
