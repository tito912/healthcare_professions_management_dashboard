// Pannello «Trova sostituto» (UX §9.11, U8, PIANO 3.2 criterio 3): la classifica di `classificaSostituti()` letta
// dalla griglia. Laterale, la griglia resta visibile; passando su un candidato (mouse o focus) si evidenzia la sua
// settimana. Per ogni disponibile: nome, volte, saldo definitivo, «Reperibile», avviso con testo per chi non avrebbe
// le 11 ore. In fondo «Non disponibili» con il motivo di ciascuno. «Assegna» crea la sostituzione come modifica
// non salvata. Non si apre in sola lettura (D2): la griglia non offre la voce.
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
  afterNextRender,
  effect,
  inject,
  Injector,
} from '@angular/core';
import { testi } from '../../../testi/it';
import { Badge } from '../../../ui/badge';
import { Icona } from '../../../ui/icona';
import { idUnivoco } from '../../../ui/id-univoco';
import type { DatiSostituti } from '../stato/griglia.store';

@Component({
  selector: 'app-pannello-sostituti',
  imports: [Badge, Icona],
  template: `
    <div class="flex items-center justify-between border-b border-bordo px-3 py-2">
      <h2 #titolo class="text-titolo-sezione" tabindex="-1" [id]="idTitolo">
        {{ testi.griglia.sostituti.titoloPannello }}
      </h2>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
        [attr.aria-label]="testi.griglia.sostituti.chiudi"
        (click)="chiudi.emit()"
      >
        <app-icona nome="chiudi" />
      </button>
    </div>
    <div #corpo class="min-h-0 flex-1 overflow-y-auto p-3" (pointerleave)="evidenzia.emit(null)">
      <p class="mb-3 font-semibold" data-titolo (pointerenter)="evidenzia.emit(null)">
        {{ dati().titolo }}
      </p>
      @let d = dati();
      @switch (d.stato) {
        @case ('caricamento') {
          <p role="status" class="text-testo-secondario">
            {{ testi.griglia.sostituti.caricamento }}
          </p>
        }
        @case ('errore') {
          <div
            role="alert"
            class="flex items-center gap-3 rounded-campo border border-blocco bg-blocco-sfondo p-3 text-blocco-testo"
          >
            <p class="flex-1">{{ testi.griglia.sostituti.errore }}</p>
            <button
              type="button"
              class="h-controllo rounded-campo border border-bordo bg-sfondo px-3 text-testo hover:bg-sfondo-neutro"
              (click)="riprova.emit()"
            >
              {{ testi.griglia.sostituti.riprova }}
            </button>
          </div>
        }
        @case ('nonScoperto') {
          <p class="text-testo-secondario">{{ testi.griglia.sostituti.nonScoperto }}</p>
        }
        @case ('pronto') {
          <h3 class="mb-1 text-tabella font-semibold text-testo-secondario">
            {{ testi.griglia.sostituti.disponibili }}
          </h3>
          @if (d.disponibili.length === 0) {
            <p class="mb-3 text-testo-secondario" data-nessun-disponibile>
              {{ testi.griglia.sostituti.nessunDisponibile }}
            </p>
          }
          <ul class="mb-4 divide-y divide-bordo rounded-campo border border-bordo" data-disponibili>
            @for (c of d.disponibili; track c.id) {
              <li
                class="px-3 py-2 hover:bg-sfondo-neutro focus-within:bg-sfondo-neutro"
                [attr.data-candidato]="c.id"
                (pointerenter)="evidenzia.emit(c.id)"
                (focusin)="evidenzia.emit(c.id)"
                (focusout)="uscitoDalCandidato($event)"
              >
                <div class="flex items-center gap-2">
                  <span class="min-w-0 flex-1 truncate font-medium">
                    @if (c.riposo.length > 0) {
                      <app-icona nome="avviso" class="text-avviso-testo" />
                    }
                    {{ c.nome }}
                  </span>
                  @if (c.reperibile) {
                    <app-badge variante="nota">{{ testi.griglia.sostituti.reperibile }}</app-badge>
                  }
                  <button
                    type="button"
                    class="h-compatto shrink-0 rounded-campo border border-primario bg-primario px-2 text-white hover:bg-primario-hover"
                    [attr.aria-label]="testi.griglia.sostituti.assegnaA(c.nome)"
                    (click)="assegna.emit(c.id)"
                  >
                    {{ testi.griglia.sostituti.assegna }}
                  </button>
                </div>
                <p class="text-tabella text-testo-secondario">
                  <span data-volte>{{ testi.griglia.sostituti.volte(c.volte) }}</span>
                  ·
                  @if (c.saldo === null) {
                    <span data-saldo>{{ testi.griglia.sostituti.saldoSconosciuto }}</span>
                  } @else {
                    <span
                      data-saldo
                      [class.text-debito]="c.saldoNegativo"
                      [class.text-credito]="!c.saldoNegativo"
                      >{{ testi.griglia.sostituti.saldo(c.saldo) }}</span
                    >
                  }
                </p>
                @for (frase of c.riposo; track frase) {
                  <p class="mt-1 text-tabella text-avviso-testo" data-riposo>
                    {{ testi.griglia.sostituti.avvisoRiposo }}: {{ frase }}
                  </p>
                }
              </li>
            }
          </ul>
          <h3
            class="mb-1 text-tabella font-semibold text-testo-secondario"
            (pointerenter)="evidenzia.emit(null)"
          >
            {{ testi.griglia.sostituti.nonDisponibili }}
          </h3>
          @if (d.nonDisponibili.length === 0) {
            <p class="mb-3 text-testo-secondario">
              {{ testi.griglia.sostituti.nessunNonDisponibile }}
            </p>
          }
          <ul
            class="mb-4 divide-y divide-bordo rounded-campo border border-bordo"
            data-non-disponibili
            (pointerenter)="evidenzia.emit(null)"
          >
            @for (c of d.nonDisponibili; track c.id) {
              <li class="px-3 py-2" [attr.data-escluso]="c.id">
                <span class="font-medium">{{ c.nome }}</span>
                <span class="text-testo-secondario"> · {{ c.motivo }}</span>
              </li>
            }
          </ul>
          <p class="text-nota text-testo-secondario" (pointerenter)="evidenzia.emit(null)">
            {{ testi.griglia.sostituti.criterio }}
          </p>
          <p class="text-nota text-testo-secondario">
            {{ testi.griglia.sostituti.saldoDefinitivo }}
          </p>
        }
      }
    </div>
  `,
  host: {
    role: 'complementary',
    '[attr.aria-labelledby]': 'idTitolo',
    class:
      'absolute top-0 right-0 bottom-0 z-40 flex w-pannello flex-col border-l border-bordo bg-sfondo shadow-xl',
    '(keydown.escape)': 'chiudi.emit()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PannelloSostituti {
  protected readonly testi = testi;
  protected readonly idTitolo = idUnivoco('titolo-sostituti');
  private readonly corpo = viewChild<ElementRef<HTMLElement>>('corpo');
  private readonly titolo = viewChild<ElementRef<HTMLElement>>('titolo');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly dati = input.required<DatiSostituti>();
  readonly chiudi = output<void>();
  readonly assegna = output<string>();
  /** L'ID del candidato su cui si passa (la sua settimana si evidenzia nella griglia), o null. */
  readonly evidenzia = output<string | null>();
  readonly riprova = output<void>();

  constructor() {
    // La classifica arriva dopo l'apertura (lettura su Firestore): se il focus è ancora nel pannello, passa al primo
    // «Assegna»; se l'utente è andato altrove, non lo si sposta.
    effect(() => {
      if (this.dati().stato !== 'pronto') {
        return;
      }
      afterNextRender(
        () => {
          const attivo = this.host.nativeElement.ownerDocument.activeElement;
          if (attivo !== null && this.host.nativeElement.contains(attivo)) {
            this.corpo()?.nativeElement.querySelector<HTMLElement>('button')?.focus();
          }
        },
        { injector: this.injector },
      );
    });
  }

  /** Il focus esce dalla riga del candidato verso un punto fuori da essa: l'evidenza sparisce. */
  protected uscitoDalCandidato(evento: FocusEvent): void {
    const riga = evento.currentTarget;
    const verso = evento.relatedTarget;
    if (!(riga instanceof HTMLElement) || !(verso instanceof Node) || !riga.contains(verso)) {
      this.evidenzia.emit(null);
    }
  }

  /**
   * All'apertura il focus va al titolo del pannello (UX §10); a classifica pronta passa al primo «Assegna»
   * (vedi il costruttore). Se la classifica è già pronta, subito al primo pulsante.
   */
  focalizza(): void {
    const pulsante = this.corpo()?.nativeElement.querySelector<HTMLElement>('button');
    (pulsante ?? this.titolo()?.nativeElement)?.focus();
  }
}
