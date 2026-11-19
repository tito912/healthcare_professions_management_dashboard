// Scheda «Festività dell'anno» del report (UX §7.10): selettore dell'anno; righe = dipendenti, colonne = festività
// dell'anno (nazionali non escluse e locali) con il codice del turno lavorato, ultima colonna «Totale». Dai riepiloghi
// dell'anno (una query `anno ==`, una volta per anno): comprende anche i mesi in bozza, e lo dice.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { ConfigurazioneFestivita } from '@turni/domain';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import { RiepiloghiRepo, type RiepilogoFestivitaAnno } from '../../dati/riepiloghi.repo';
import { testi } from '../../testi/it';
import { testiReport } from '../../testi/it-report';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import { vistaFestivita } from './modello';

type Stato = 'caricamento' | 'pronto' | 'errore';

const ANNO_MINIMO = 2020;

@Component({
  selector: 'app-report-festivita',
  imports: [Button, EmptyState, Icona, TableScheletro],
  template: `
    <div
      class="mb-3 flex items-center gap-1"
      role="group"
      [attr.aria-label]="testiReport.anno.etichetta"
    >
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
        [attr.aria-label]="testiReport.anno.precedente"
        [disabled]="anno() <= annoMinimo"
        (click)="vaiAdAnno(anno() - 1)"
      >
        <app-icona nome="frecciaSinistra" />
      </button>
      <span class="min-w-16 text-center text-titolo-sezione" data-anno>{{ anno() }}</span>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
        [attr.aria-label]="testiReport.anno.successivo"
        [disabled]="anno() >= annoMassimo()"
        (click)="vaiAdAnno(anno() + 1)"
      >
        <app-icona nome="frecciaDestra" />
      </button>
    </div>

    @switch (stato()) {
      @case ('caricamento') {
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiReport.festivita.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('pronto') {
        @if (vista(); as v) {
          @if (v.righe.length === 0) {
            <app-empty-state [titolo]="testiReport.nessunDipendente" icona="report" />
          } @else {
            <div class="overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
              <table class="w-full border-collapse text-tabella">
                <caption class="sr-only">
                  {{
                    testiReport.festivita.tabella(anno())
                  }}
                </caption>
                <thead>
                  <tr class="bg-sfondo-neutro">
                    <th
                      scope="col"
                      class="sticky left-0 z-10 h-riga min-w-40 border-b border-bordo bg-sfondo-neutro px-3 text-left font-semibold"
                    >
                      {{ testiReport.colonne.dipendente }}
                    </th>
                    @for (c of v.colonne; track c.id) {
                      <th
                        scope="col"
                        class="h-riga min-w-24 border-b border-bordo px-2 text-center font-semibold"
                        [attr.title]="
                          c.nonPiuInElenco ? testiReport.festivita.nonPiuInElenco : null
                        "
                      >
                        <span class="block">{{ c.nome }}</span>
                        <span class="block text-nota font-normal text-testo-secondario">{{
                          c.data
                        }}</span>
                      </th>
                    }
                    <th
                      scope="col"
                      class="sticky right-0 z-10 h-riga min-w-20 border-b border-l border-bordo bg-sfondo-neutro px-2 text-right font-semibold"
                    >
                      {{ testiReport.festivita.colonnaTotale }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  @for (r of v.righe; track r.id) {
                    <tr [attr.data-dipendente]="r.id">
                      <th
                        scope="row"
                        class="sticky left-0 z-10 h-riga border-b border-bordo bg-sfondo px-3 text-left font-medium"
                      >
                        <span [attr.title]="r.nomeCompleto">{{ r.nome }}</span>
                      </th>
                      @for (cella of r.celle; track $index) {
                        <td
                          class="h-riga border-b border-bordo px-2 text-center"
                          [attr.data-festivita]="v.colonne[$index]?.id"
                        >
                          @if (cella === null) {
                            <span class="text-testo-secondario" aria-hidden="true">—</span>
                            <span class="sr-only">{{ testiReport.festivita.nonLavorata }}</span>
                          } @else {
                            {{ cella }}
                          }
                        </td>
                      }
                      <td
                        class="sticky right-0 z-10 h-riga border-b border-l border-bordo bg-sfondo px-2 text-right font-medium tabular-nums"
                        data-totale
                      >
                        {{ r.totale }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-nota text-testo-secondario">{{ testiReport.festivita.legenda }}</p>
            @if (v.conBozza) {
              <p class="text-nota text-avviso-testo" data-con-bozza>
                {{ testiReport.festivita.conBozza }}
              </p>
            }
          }
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedaFestivita {
  protected readonly testi = testi;
  protected readonly testiReport = testiReport;
  protected readonly annoMinimo = ANNO_MINIMO;
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly riepiloghiRepo = inject(RiepiloghiRepo);

  readonly repartoId = input.required<string>();
  readonly anno = input.required<number>();
  /** L'anno del bimestre in corso: oltre non si va. */
  readonly annoMassimo = input.required<number>();
  readonly dipendenti = input.required<readonly DipendenteSalvato[]>();
  readonly festivita = input.required<ConfigurazioneFestivita>();

  protected readonly stato = signal<Stato>('caricamento');
  private readonly riepiloghi = signal<readonly RiepilogoFestivitaAnno[]>([]);
  private richiesta = 0;

  protected readonly vista = computed(() =>
    this.stato() === 'pronto'
      ? vistaFestivita(this.anno(), this.festivita(), this.dipendenti(), this.riepiloghi())
      : null,
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
    this.stato.set('caricamento');
    try {
      const riepiloghi = await this.riepiloghiRepo.perAnno(this.repartoId(), this.anno());
      if (numero !== this.richiesta) {
        return;
      }
      this.riepiloghi.set(riepiloghi);
      this.stato.set('pronto');
    } catch {
      if (numero === this.richiesta) {
        this.stato.set('errore');
      }
    }
  }

  protected vaiAdAnno(anno: number): void {
    void this.router.navigate([], {
      relativeTo: this.rotta,
      queryParams: { anno },
      queryParamsHandling: 'merge',
    });
  }
}
