// Dettaglio del dipendente (schermata 9, U10, UX §7.9, PIANO 3.2 criterio 6): al posto del tooltip della banca ore.
// Per mese ore dovute, lavorate e saldo; elenco delle variazioni di orario; assenze per tipologia con il totale dei
// giorni. I dati sono letti: banca ore e riepiloghi li scrive il trigger, le variazioni vengono dalle righe dei soli
// mesi che ne hanno (`variazioni > 0` nel riepilogo).
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
import { eChiaveMese, formattaData, formattaOreSettimanali, formattaSaldoOre } from '@turni/domain';
import { DATA_OGGI } from '../../core/ambiente';
import { AssenzeRepo, type AssenzaSalvata } from '../../dati/assenze.repo';
import { BancaOreRepo, type BancaOreSalvata } from '../../dati/banca-ore.repo';
import { DipendentiRepo, type DipendenteSalvato } from '../../dati/dipendenti.repo';
import { RiepiloghiRepo, type RiepilogoDelDipendente } from '../../dati/riepiloghi.repo';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import {
  assenzePerTipologia,
  oreDeiMesi,
  variazioniDellaRiga,
  type RigaVariazione,
} from './modello';

const ANNO_MINIMO = 2020;

type Stato = 'caricamento' | 'pronto' | 'errore' | 'nonTrovato';

@Component({
  selector: 'app-dettaglio-dipendente',
  imports: [Button, EmptyState, Icona, RouterLink, TableScheletro],
  template: `
    @switch (stato()) {
      @case ('caricamento') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dettaglioDipendente.titolo }}</h1>
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dettaglioDipendente.titolo }}</h1>
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testi.dettaglioDipendente.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonTrovato') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dettaglioDipendente.titolo }}</h1>
        <app-empty-state [titolo]="testi.dettaglioDipendente.nonTrovato" icona="info">
          <a appButton [routerLink]="['/reparti', repartoId(), 'banca-ore']">{{
            testi.dettaglioDipendente.tornaAllaBancaOre
          }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        <a
          class="mb-2 inline-flex items-center gap-1 text-testo-neutro hover:underline"
          [routerLink]="['/reparti', repartoId(), 'banca-ore']"
          [queryParams]="{ anno: anno() }"
        >
          ‹ {{ testi.dettaglioDipendente.tornaAllaBancaOre }}
        </a>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-titolo-pagina" data-nome>{{ nome() }}</h1>
            <p class="text-testo-secondario" data-sottotitolo>{{ sottotitolo() }}</p>
          </div>
          <div class="flex items-center gap-4">
            <div
              class="flex items-center gap-1"
              role="group"
              [attr.aria-label]="testi.dettaglioDipendente.anno"
            >
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                [attr.aria-label]="testi.dettaglioDipendente.annoPrecedente"
                [disabled]="anno() <= annoMinimo"
                (click)="vaiAdAnno(anno() - 1)"
              >
                <app-icona nome="frecciaSinistra" />
              </button>
              <span class="min-w-16 text-center text-titolo-sezione" data-anno>{{ anno() }}</span>
              <button
                type="button"
                class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                [attr.aria-label]="testi.dettaglioDipendente.annoSuccessivo"
                [disabled]="anno() >= annoMassimo()"
                (click)="vaiAdAnno(anno() + 1)"
              >
                <app-icona nome="frecciaDestra" />
              </button>
            </div>
            <a
              appButton
              [routerLink]="['/reparti', repartoId(), 'dipendenti', did(), 'anagrafica']"
              >{{ testi.dettaglioDipendente.anagrafica }}</a
            >
          </div>
        </div>

        @if (banca(); as b) {
          <p class="mb-4 flex flex-wrap gap-x-6 gap-y-1" data-riepilogo>
            <span>{{ testi.dettaglioDipendente.riporto(anno() - 1, saldo(b.riportoMinuti)) }}</span>
            <span class="font-semibold">{{
              testi.dettaglioDipendente.saldoAnno(anno(), saldo(b.saldoAnnoMinuti), b.provvisorio)
            }}</span>
            @if (b.provvisorio) {
              <span>{{
                testi.dettaglioDipendente.diCuiDefinitivo(saldo(b.saldoDefinitivoMinuti))
              }}</span>
            }
          </p>
        }

        <h2 class="mb-2 text-titolo-sezione">{{ testi.dettaglioDipendente.oreMese }}</h2>
        <div class="mb-6 overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
          <table class="w-full border-collapse text-tabella" data-ore-mese>
            <caption class="sr-only">
              {{
                testi.dettaglioDipendente.oreMese
              }}
            </caption>
            <thead>
              <tr class="bg-sfondo-neutro">
                <th scope="col" class="h-riga px-3 text-left font-semibold">
                  {{ testi.dettaglioDipendente.colonne.mese }}
                </th>
                <th scope="col" class="h-riga px-3 text-right font-semibold">
                  {{ testi.dettaglioDipendente.colonne.dovute }}
                </th>
                <th scope="col" class="h-riga px-3 text-right font-semibold">
                  {{ testi.dettaglioDipendente.colonne.lavorate }}
                </th>
                <th scope="col" class="h-riga px-3 text-right font-semibold">
                  {{ testi.dettaglioDipendente.colonne.saldo }}
                </th>
                <th scope="col" class="h-riga px-3 text-left font-semibold">
                  {{ testi.dettaglioDipendente.colonne.stato }}
                </th>
              </tr>
            </thead>
            <tbody>
              @for (r of ore(); track r.chiave) {
                <tr>
                  <th scope="row" class="h-riga border-t border-bordo px-3 text-left font-medium">
                    {{ r.mese }}
                  </th>
                  <td class="h-riga border-t border-bordo px-3 text-right tabular-nums">
                    {{ r.dovute }}
                  </td>
                  <td class="h-riga border-t border-bordo px-3 text-right tabular-nums">
                    {{ r.lavorate }}
                  </td>
                  <td
                    class="h-riga border-t border-bordo px-3 text-right tabular-nums"
                    [class.text-credito]="r.saldo?.segno === 'credito'"
                    [class.text-debito]="r.saldo?.segno === 'debito'"
                    [class.italic]="r.saldo?.provvisorio"
                    [attr.data-saldo]="r.chiave"
                  >
                    {{ r.saldo?.testo ?? '—' }}
                  </td>
                  <td class="h-riga border-t border-bordo px-3">{{ r.stato }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <h2 class="mb-2 text-titolo-sezione">{{ testi.dettaglioDipendente.variazioni }}</h2>
        @if (variazioni().length === 0) {
          <p class="mb-6 text-testo-secondario" data-nessuna-variazione>
            {{ testi.dettaglioDipendente.nessunaVariazione }}
          </p>
        } @else {
          <div class="mb-6 overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
            <table class="w-full border-collapse text-tabella" data-variazioni>
              <caption class="sr-only">
                {{
                  testi.dettaglioDipendente.variazioni
                }}
              </caption>
              <thead>
                <tr class="bg-sfondo-neutro">
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.data }}
                  </th>
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.turno }}
                  </th>
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.previsto }}
                  </th>
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.reale }}
                  </th>
                  <th scope="col" class="h-riga px-3 text-right font-semibold">
                    {{ testi.dettaglioDipendente.colonne.differenza }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (v of variazioni(); track v.chiave) {
                  <tr>
                    <td class="h-riga border-t border-bordo px-3">{{ v.data }}</td>
                    <td class="h-riga border-t border-bordo px-3 font-medium">{{ v.turno }}</td>
                    <td class="h-riga border-t border-bordo px-3">{{ v.previsto }}</td>
                    <td class="h-riga border-t border-bordo px-3">{{ v.reale }}</td>
                    <td class="h-riga border-t border-bordo px-3 text-right tabular-nums">
                      {{ v.differenza }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h2 class="mb-2 text-titolo-sezione">{{ testi.dettaglioDipendente.assenze }}</h2>
        @if (assenze().length === 0) {
          <p class="text-testo-secondario" data-nessuna-assenza>
            {{ testi.dettaglioDipendente.nessunaAssenza }}
          </p>
        } @else {
          <div class="overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
            <table class="w-full border-collapse text-tabella" data-assenze>
              <caption class="sr-only">
                {{
                  testi.dettaglioDipendente.assenze
                }}
              </caption>
              <thead>
                <tr class="bg-sfondo-neutro">
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.codice }}
                  </th>
                  <th scope="col" class="h-riga px-3 text-left font-semibold">
                    {{ testi.dettaglioDipendente.colonne.descrizione }}
                  </th>
                  @for (mese of testi.bancaOre.mesi; track mese) {
                    <th scope="col" class="h-riga px-2 text-right font-semibold">{{ mese }}</th>
                  }
                  <th scope="col" class="h-riga px-3 text-right font-semibold">
                    {{ testi.dettaglioDipendente.colonne.totaleGiorni }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (a of assenze(); track a.codice) {
                  <tr [attr.data-assenza]="a.codice">
                    <th scope="row" class="h-riga border-t border-bordo px-3 text-left font-medium">
                      {{ a.codice }}
                    </th>
                    <td class="h-riga border-t border-bordo px-3">{{ a.descrizione }}</td>
                    @for (n of a.mesi; track $index) {
                      <td class="h-riga border-t border-bordo px-2 text-right tabular-nums">
                        {{ n }}
                      </td>
                    }
                    <td
                      class="h-riga border-t border-bordo px-3 text-right font-semibold tabular-nums"
                      data-totale-giorni
                    >
                      {{ a.totale }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DettaglioDipendente {
  protected readonly testi = testi;
  protected readonly annoMinimo = ANNO_MINIMO;
  private readonly rotta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly oggi = inject(DATA_OGGI);
  private readonly dipendentiRepo = inject(DipendentiRepo);
  private readonly assenzeRepo = inject(AssenzeRepo);
  private readonly bancaOreRepo = inject(BancaOreRepo);
  private readonly riepiloghiRepo = inject(RiepiloghiRepo);

  private readonly parametri = toSignal(this.rotta.paramMap, {
    initialValue: this.rotta.snapshot.paramMap,
  });
  private readonly query = toSignal(this.rotta.queryParamMap, {
    initialValue: this.rotta.snapshot.queryParamMap,
  });

  protected readonly repartoId = computed(() => this.parametri().get('rid') ?? '');
  protected readonly did = computed(() => this.parametri().get('did') ?? '');
  protected readonly annoMassimo = computed(() => Number(this.oggi().slice(0, 4)) + 1);
  protected readonly anno = computed(() => {
    const letto = Number(this.query().get('anno'));
    return Number.isInteger(letto) && letto >= ANNO_MINIMO && letto <= this.annoMassimo()
      ? letto
      : Number(this.oggi().slice(0, 4));
  });

  protected readonly stato = signal<Stato>('caricamento');
  private readonly dipendente = signal<DipendenteSalvato | null>(null);
  protected readonly banca = signal<BancaOreSalvata | null>(null);
  private readonly riepiloghi = signal<readonly RiepilogoDelDipendente[]>([]);
  private readonly elencoAssenze = signal<readonly AssenzaSalvata[]>([]);
  protected readonly variazioni = signal<readonly RigaVariazione[]>([]);
  private richiesta = 0;

  protected readonly nome = computed(() => {
    const d = this.dipendente();
    return d === null ? testi.griglia.riga.rimosso : `${d.cognome} ${d.nome}`;
  });
  protected readonly sottotitolo = computed(() => {
    const d = this.dipendente();
    return d === null
      ? ''
      : testi.dettaglioDipendente.sottotitolo(
          formattaOreSettimanali(d.oreSettimanali),
          d.dataAssunzione === null ? null : formattaData(d.dataAssunzione),
        );
  });
  protected readonly ore = computed(() => oreDeiMesi(this.anno(), this.banca(), this.riepiloghi()));
  protected readonly assenze = computed(() =>
    assenzePerTipologia(this.riepiloghi(), this.elencoAssenze()),
  );

  constructor() {
    effect(() => {
      this.repartoId();
      this.did();
      this.anno();
      untracked(() => void this.carica());
    });
  }

  protected saldo(minuti: number): string {
    return formattaSaldoOre(minuti);
  }

  protected async carica(): Promise<void> {
    const numero = ++this.richiesta;
    const rid = this.repartoId();
    const did = this.did();
    const anno = this.anno();
    this.stato.set('caricamento');
    try {
      const [dipendenti, assenze, banche, riepiloghi] = await Promise.all([
        this.dipendentiRepo.elenco(rid),
        this.assenzeRepo.elenco(rid),
        this.bancaOreRepo.anno(rid, anno),
        this.riepiloghiRepo.delDipendente(rid, did, anno),
      ]);
      const banca = banche.find((b) => b.dipendenteId === did) ?? null;
      const dipendente = dipendenti.find((d) => d.id === did) ?? null;
      if (dipendente === null && banca === null && riepiloghi.length === 0) {
        if (numero === this.richiesta) {
          this.stato.set('nonTrovato');
        }
        return;
      }
      // Le variazioni stanno nelle righe: si leggono solo i mesi che ne hanno, secondo il riepilogo.
      const conVariazioni = riepiloghi.filter((r) => r.variazioni > 0);
      const righe = await Promise.all(
        conVariazioni.map(async (r) => ({
          chiave: r.chiaveMese,
          riga: await this.riepiloghiRepo.rigaDelDipendente(rid, r.chiaveMese, did),
        })),
      );
      if (numero !== this.richiesta) {
        return;
      }
      this.dipendente.set(dipendente);
      this.banca.set(banca);
      this.riepiloghi.set(riepiloghi);
      this.elencoAssenze.set(assenze);
      this.variazioni.set(
        righe.flatMap(({ chiave, riga }) =>
          riga === null || !eChiaveMese(chiave) ? [] : variazioniDellaRiga(chiave, riga),
        ),
      );
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
}
