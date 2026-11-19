// Pannello «Dettaglio turno» (UX §9.11, PIANO 3.2 criterio 1): turno previsto, ingresso e uscita reali, differenza
// calcolata mentre si digita (minuti reali, col cambio d'ora), «Applica» e «Annulla». «Applica» aggiunge la
// modifica a quelle non salvate (un passo di annulla) dopo il controllo di `validaModifica()`. Sul mese
// convalidato e per l'ADMIN mostra i dati senza campi (D2). Un turno scoperto o coperto non ha orario reale.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { eOraLocale, type OrarioReale } from '@turni/domain';
import { testi } from '../../../testi/it';
import { Icona } from '../../../ui/icona';
import { idUnivoco } from '../../../ui/id-univoco';
import { GrigliaStore, type DatiTurno } from '../stato/griglia.store';

/** Gli orari come li scrive l'utente (testo dei campi «ora»). */
interface Campi {
  readonly inizio: string;
  readonly fine: string;
}

@Component({
  selector: 'app-pannello-turno',
  imports: [Icona],
  template: `
    <div class="flex items-center justify-between border-b border-bordo px-3 py-2">
      <h2 class="text-titolo-sezione" [id]="idTitolo">{{ testi.griglia.turno.titolo }}</h2>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
        [attr.aria-label]="testi.griglia.turno.chiudi"
        (click)="chiudi.emit()"
      >
        <app-icona nome="chiudi" />
      </button>
    </div>
    <div #corpo class="min-h-0 flex-1 overflow-y-auto p-3">
      <p class="mb-3 font-semibold">{{ dati().titolo }}</p>
      @if (soloLettura()) {
        <p class="mb-3 text-testo-secondario">{{ testi.griglia.turno.soloLettura }}</p>
      }
      <section class="mb-4 rounded-campo border border-bordo p-3">
        <h3 class="mb-1 text-tabella font-semibold text-testo-secondario">
          {{ testi.griglia.turno.previsto }}
        </h3>
        <p class="font-medium" data-previsto>
          {{
            testi.griglia.turno.turnoPrevisto(
              dati().codice,
              dati().nome,
              dati().inizio,
              dati().fine
            )
          }}
        </p>
        <p class="text-testo-secondario">{{ testi.griglia.turno.pausa(dati().pausaMinuti) }}</p>
        @if (dati().sostituisce; as nome) {
          <p class="mt-2 font-medium" data-sostituisce>
            {{ testi.griglia.turno.sostituisce(nome) }}
          </p>
        }
      </section>

      @if (dati().stato === 'scoperto') {
        <p class="rounded-campo border border-avviso bg-avviso-sfondo p-3 text-avviso-testo">
          {{ testi.griglia.turno.scoperto }}
        </p>
      } @else if (dati().stato === 'coperto') {
        <p class="rounded-campo border border-bordo bg-sfondo-neutro p-3">
          {{ testi.griglia.turno.copertoDa(dati().copertoDa ?? '') }}
        </p>
      } @else if (soloLettura()) {
        @let reale = dati().orarioReale;
        <p data-orario-reale>
          @if (reale === null) {
            {{ testi.griglia.turno.senzaOrarioReale }}
          } @else {
            {{ testi.griglia.turno.orarioRealeRegistrato(reale.inizio + '–' + reale.fine) }}
          }
        </p>
        @if (reale !== null && testoDifferenza() !== null) {
          <p class="font-medium">{{ testoDifferenza() }}</p>
        }
      } @else {
        <div class="flex gap-3">
          <div>
            <label class="mb-1 block text-tabella font-medium" [for]="idCampo('inizio')">
              {{ testi.griglia.turno.ingresso }}
            </label>
            <input
              [id]="idCampo('inizio')"
              type="time"
              class="h-controllo w-32 rounded-campo border border-bordo bg-sfondo px-2"
              [value]="campi().inizio"
              (input)="imposta({ inizio: testoCampo($event) })"
            />
          </div>
          <div>
            <label class="mb-1 block text-tabella font-medium" [for]="idCampo('fine')">
              {{ testi.griglia.turno.uscita }}
            </label>
            <input
              [id]="idCampo('fine')"
              type="time"
              class="h-controllo w-32 rounded-campo border border-bordo bg-sfondo px-2"
              [value]="campi().fine"
              (input)="imposta({ fine: testoCampo($event) })"
            />
          </div>
        </div>
        <p class="mt-3 font-medium" aria-live="polite" data-differenza>
          {{ testoDifferenza() ?? testi.griglia.turno.differenzaIncompleta }}
        </p>
        @if (notteDopoMezzanotte()) {
          <p class="mt-2 text-nota text-testo-secondario">
            {{ testi.griglia.turno.notteDopoMezzanotte }}
          </p>
        }
        @if (verifica().blocco; as blocco) {
          <p class="mt-2 text-nota text-blocco-testo" role="alert">
            {{ testi.griglia.turno.respinto(blocco) }}
          </p>
        }
        @if (dati().orarioReale !== null) {
          <button
            type="button"
            class="mt-3 h-controllo rounded-campo border border-bordo px-3 hover:bg-sfondo-neutro"
            (click)="ripristina()"
          >
            {{ testi.griglia.turno.ripristina }}
          </button>
        }
        @if (verifica().avvisi.length > 0) {
          <section
            class="mt-4 rounded-campo border border-avviso bg-avviso-sfondo p-3"
            aria-live="polite"
          >
            <h3 class="mb-1 flex items-center gap-1 text-tabella font-semibold text-avviso-testo">
              <app-icona nome="avviso" /> {{ testi.griglia.turno.avvisiDopo }}
            </h3>
            <ul class="list-disc pl-5">
              @for (testo of verifica().avvisi; track testo) {
                <li>{{ testo }}</li>
              }
            </ul>
          </section>
        }
      }
    </div>
    @if (modificabile()) {
      <div class="flex justify-end gap-2 border-t border-bordo px-3 py-2">
        <button
          type="button"
          class="h-controllo rounded-campo border border-bordo px-3 hover:bg-sfondo-neutro"
          (click)="chiudi.emit()"
        >
          {{ testi.griglia.turno.annulla }}
        </button>
        <button
          type="button"
          class="h-controllo rounded-campo border border-primario bg-primario px-3 text-white hover:bg-primario-hover disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="!puoApplicare()"
          (click)="applica()"
        >
          {{ testi.griglia.turno.applica }}
        </button>
      </div>
    }
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
export class PannelloTurno {
  protected readonly testi = testi;
  private readonly store = inject(GrigliaStore);
  protected readonly idTitolo = idUnivoco('titolo-turno');
  private readonly prefisso = idUnivoco('turno');
  private readonly corpo = viewChild<ElementRef<HTMLElement>>('corpo');

  readonly dati = input.required<DatiTurno>();
  readonly soloLettura = input(false);
  readonly chiudi = output<void>();

  /** Si modifica solo un turno svolto, e solo dal coordinatore su un mese in bozza. */
  protected readonly modificabile = computed(
    () => !this.soloLettura() && this.dati().stato === 'svolto',
  );

  /** I campi, inizializzati dall'orario reale (o dal previsto) e rimessi a posto se la cella cambia sotto il pannello. */
  protected readonly campi = linkedSignal<DatiTurno, Campi>({
    source: this.dati,
    computation: (d) => ({
      inizio: d.orarioReale?.inizio ?? d.inizio,
      fine: d.orarioReale?.fine ?? d.fine,
    }),
  });

  protected idCampo(parte: string): string {
    return `${this.prefisso}-${parte}`;
  }

  protected testoCampo(evento: Event): string {
    return evento.target instanceof HTMLInputElement ? evento.target.value : '';
  }

  protected imposta(cambi: Partial<Campi>): void {
    this.campi.update((c) => ({ ...c, ...cambi }));
  }

  protected ripristina(): void {
    const d = this.dati();
    this.campi.set({ inizio: d.inizio, fine: d.fine });
  }

  /**
   * L'orario descritto dai campi: null se uguale al previsto (si ripristina), `'incompleto'` se un campo manca o
   * non è un'ora.
   */
  private readonly orario = computed<OrarioReale | null | 'incompleto'>(() => {
    const { inizio, fine } = this.campi();
    if (!eOraLocale(inizio) || !eOraLocale(fine)) {
      return 'incompleto';
    }
    const d = this.dati();
    return inizio === d.inizio && fine === d.fine ? null : { inizio, fine };
  });

  /** «Differenza: +30 min», calcolata dal dominio mentre si digita; null se mancano ingresso o uscita. */
  protected readonly testoDifferenza = computed<string | null>(() => {
    const d = this.dati();
    const { inizio, fine } = this.campi();
    // In sola lettura la differenza è quella dell'orario salvato.
    const minuti = this.modificabile()
      ? this.store.differenzaOrario(d.cella, inizio, fine)
      : d.orarioReale === null
        ? null
        : this.store.differenzaOrario(d.cella, d.orarioReale.inizio, d.orarioReale.fine);
    if (minuti === null) {
      return null;
    }
    return minuti === 0
      ? testi.griglia.turno.nessunaDifferenza
      : testi.griglia.turno.differenza(testi.griglia.turno.minuti(minuti));
  });

  /** Un turno notturno con ingresso dopo la mezzanotte non si legge come il turno della cella (limite noto di 3.1a). */
  protected readonly notteDopoMezzanotte = computed(
    () => this.dati().notturno && eOraLocale(this.campi().inizio) && this.campi().inizio < '12:00',
  );

  protected readonly verifica = computed(() => {
    const orario = this.orario();
    return orario === 'incompleto'
      ? { blocco: null, avvisi: [] as readonly string[] }
      : this.store.verificaOrarioReale(this.dati().cella, orario);
  });

  protected readonly puoApplicare = computed(() => {
    const orario = this.orario();
    if (!this.modificabile() || orario === 'incompleto' || this.verifica().blocco !== null) {
      return false;
    }
    const salvato = this.dati().orarioReale;
    return (
      (orario === null) !== (salvato === null) ||
      (orario !== null &&
        salvato !== null &&
        (orario.inizio !== salvato.inizio || orario.fine !== salvato.fine))
    );
  });

  protected applica(): void {
    const orario = this.orario();
    if (orario === 'incompleto' || !this.puoApplicare()) {
      return;
    }
    if (this.store.applicaOrarioReale(this.dati().cella, orario).ok) {
      this.chiudi.emit();
    }
  }

  /** Il primo campo del pannello prende il focus all'apertura (UX §10). */
  focalizza(): void {
    this.corpo()?.nativeElement.querySelector<HTMLElement>('input, button')?.focus();
  }
}
