// Pannello «Dettaglio reperibilità» (UX §9.11, L21, L38): per ogni reperibilità della cella si indica se è scattata
// la chiamata, la durata in minuti e, facoltativa, l'ora di inizio. «Applica» aggiunge la modifica a quelle non
// salvate (un passo di annulla); con l'ora di inizio l'avviso di riposo si ricalcola dalla fine dell'intervento
// (D8) e l'anteprima lo mostra prima di applicare. In sola lettura (ADMIN, mese convalidato) mostra i dati.
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
import { eOraLocale, type Chiamata } from '@turni/domain';
import { testi } from '../../../testi/it';
import { testiGriglia } from '../../../testi/it-griglia';
import { Icona } from '../../../ui/icona';
import { idUnivoco } from '../../../ui/id-univoco';
import {
  GrigliaStore,
  type DatiDettaglio,
  type DettaglioReperibilita,
  type ModificaChiamata,
} from '../stato/griglia.store';

/** Lo stato dei campi di una reperibilità: testo come lo scrive l'utente. */
interface Modulo {
  readonly scattata: boolean;
  readonly durata: string;
  readonly ora: string;
}

type Moduli = Readonly<Record<string, Modulo>>;

function modulo(r: DettaglioReperibilita): Modulo {
  return {
    scattata: r.chiamata !== null,
    durata: r.chiamata === null ? '' : String(r.chiamata.durataMinuti),
    ora: r.chiamata?.oraInizio ?? '',
  };
}

/** La chiamata descritta dai campi, o null se la casella è spenta. L'ora non valida resta come testo e fallisce nel dominio. */
function chiamataDa(m: Modulo): Chiamata | null | 'oraNonValida' {
  if (!m.scattata) {
    return null;
  }
  if (m.ora !== '' && !eOraLocale(m.ora)) {
    return 'oraNonValida';
  }
  return { durataMinuti: Number(m.durata), oraInizio: m.ora === '' ? null : m.ora };
}

interface ErroriCampo {
  readonly durata: string | null;
  readonly ora: string | null;
}

@Component({
  selector: 'app-pannello-dettaglio',
  imports: [Icona],
  template: `
    <div class="flex items-center justify-between border-b border-bordo px-3 py-2">
      <h2 class="text-titolo-sezione" [id]="idTitolo">{{ testiGriglia.dettaglio.titolo }}</h2>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
        [attr.aria-label]="testiGriglia.dettaglio.chiudi"
        (click)="chiudi.emit()"
      >
        <app-icona nome="chiudi" />
      </button>
    </div>
    <div #corpo class="min-h-0 flex-1 overflow-y-auto p-3">
      <p class="mb-3 font-semibold">{{ dati().titolo }}</p>
      @if (soloLettura()) {
        <p class="mb-3 text-testo-secondario">{{ testiGriglia.dettaglio.soloLettura }}</p>
      }
      @for (r of dati().reperibilita; track r.codice) {
        @let m = moduli()[r.codice];
        @let e = errori()[r.codice];
        <fieldset class="mb-4 rounded-campo border border-bordo p-3">
          <legend class="px-1 font-medium">
            {{ testiGriglia.dettaglio.fascia(r.codice, r.nome, r.inizio, r.fine) }}
          </legend>
          @if (r.coperta) {
            <p class="text-testo-secondario">{{ testiGriglia.dettaglio.coperta }}</p>
          } @else if (soloLettura()) {
            <p>
              @if (r.chiamata === null) {
                {{ testiGriglia.dettaglio.nessunaChiamata }}
              } @else if (r.chiamata.oraInizio === null) {
                {{ testiGriglia.dettaglio.chiamataRegistrata(r.chiamata.durataMinuti) }}
              } @else {
                {{
                  testiGriglia.dettaglio.chiamataConOra(
                    r.chiamata.durataMinuti,
                    r.chiamata.oraInizio
                  )
                }}
              }
            </p>
          } @else if (m !== undefined && e !== undefined) {
            <label class="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                class="size-4"
                [checked]="m.scattata"
                (change)="imposta(r.codice, { scattata: casella($event) })"
              />
              {{ testiGriglia.dettaglio.chiamataScattata }}
            </label>
            @if (m.scattata) {
              <div class="mt-3">
                <label class="mb-1 block text-tabella font-medium" [for]="idCampo(r, 'durata')">
                  {{ testiGriglia.dettaglio.durata }}
                </label>
                <input
                  [id]="idCampo(r, 'durata')"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  [max]="r.durataMassima"
                  step="1"
                  class="h-controllo w-32 rounded-campo border bg-sfondo px-2"
                  [class.border-bordo]="e.durata === null"
                  [class.border-blocco]="e.durata !== null"
                  [value]="m.durata"
                  [attr.aria-invalid]="e.durata !== null ? 'true' : null"
                  [attr.aria-describedby]="e.durata !== null ? idCampo(r, 'durata-errore') : null"
                  (input)="imposta(r.codice, { durata: testoCampo($event) })"
                />
                <p
                  [id]="idCampo(r, 'durata-errore')"
                  class="mt-1 text-nota text-blocco-testo"
                  aria-live="polite"
                >
                  {{ e.durata }}
                </p>
              </div>
              <div class="mt-3">
                <label class="mb-1 block text-tabella font-medium" [for]="idCampo(r, 'ora')">
                  {{ testiGriglia.dettaglio.oraInizio }}
                </label>
                <input
                  [id]="idCampo(r, 'ora')"
                  type="time"
                  class="h-controllo w-32 rounded-campo border bg-sfondo px-2"
                  [class.border-bordo]="e.ora === null"
                  [class.border-blocco]="e.ora !== null"
                  [value]="m.ora"
                  [attr.aria-invalid]="e.ora !== null ? 'true' : null"
                  [attr.aria-describedby]="idCampo(r, 'ora-nota')"
                  (input)="imposta(r.codice, { ora: testoCampo($event) })"
                />
                <p
                  [id]="idCampo(r, 'ora-nota')"
                  class="mt-1 text-nota"
                  [class.text-blocco-testo]="e.ora !== null"
                  [class.text-testo-secondario]="e.ora === null"
                  aria-live="polite"
                >
                  {{ e.ora ?? testiGriglia.dettaglio.spiegazioneOra }}
                </p>
              </div>
            }
          }
        </fieldset>
      }
      @if (!soloLettura() && anteprima().length > 0) {
        <section class="rounded-campo border border-avviso bg-avviso-sfondo p-3" aria-live="polite">
          <h3 class="mb-1 flex items-center gap-1 text-tabella font-semibold text-avviso-testo">
            <app-icona nome="avviso" /> {{ testiGriglia.dettaglio.avvisiDopo }}
          </h3>
          <ul class="list-disc pl-5">
            @for (testo of anteprima(); track testo) {
              <li>{{ testo }}</li>
            }
          </ul>
        </section>
      }
    </div>
    @if (!soloLettura()) {
      <div class="flex justify-end gap-2 border-t border-bordo px-3 py-2">
        <button
          type="button"
          class="h-controllo rounded-campo border border-bordo px-3 hover:bg-sfondo-neutro"
          (click)="chiudi.emit()"
        >
          {{ testiGriglia.dettaglio.annulla }}
        </button>
        <button
          type="button"
          class="h-controllo rounded-campo border border-primario bg-primario px-3 text-white hover:bg-primario-hover disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="!puoApplicare()"
          (click)="applica()"
        >
          {{ testiGriglia.dettaglio.applica }}
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
export class PannelloDettaglio {
  protected readonly testi = testi;
  protected readonly testiGriglia = testiGriglia;
  private readonly store = inject(GrigliaStore);
  protected readonly idTitolo = idUnivoco('titolo-dettaglio');
  private readonly prefisso = idUnivoco('dettaglio');
  private readonly corpo = viewChild<ElementRef<HTMLElement>>('corpo');

  readonly dati = input.required<DatiDettaglio>();
  readonly soloLettura = input(false);
  readonly chiudi = output<void>();

  /** I campi, inizializzati dal documento e rimessi a posto ogni volta che la cella cambia sotto il pannello. */
  protected readonly moduli = linkedSignal<DatiDettaglio, Moduli>({
    source: this.dati,
    computation: (dati) => Object.fromEntries(dati.reperibilita.map((r) => [r.codice, modulo(r)])),
  });

  protected idCampo(r: DettaglioReperibilita, parte: string): string {
    return `${this.prefisso}-${r.codice}-${parte}`;
  }

  protected casella(evento: Event): boolean {
    return evento.target instanceof HTMLInputElement && evento.target.checked;
  }

  protected testoCampo(evento: Event): string {
    return evento.target instanceof HTMLInputElement ? evento.target.value : '';
  }

  protected imposta(codice: string, cambi: Partial<Modulo>): void {
    this.moduli.update((tutti) => {
      const corrente = tutti[codice];
      return corrente === undefined ? tutti : { ...tutti, [codice]: { ...corrente, ...cambi } };
    });
  }

  /** Le modifiche che i campi descrivono, solo per le reperibilità a carico del dipendente. */
  private readonly modifiche = computed(() => {
    const elenco: {
      codice: ModificaChiamata['codice'];
      chiamata: Chiamata | null | 'oraNonValida';
    }[] = [];
    for (const r of this.dati().reperibilita) {
      const m = this.moduli()[r.codice];
      if (m !== undefined && !r.coperta) {
        elenco.push({ codice: r.codice, chiamata: chiamataDa(m) });
      }
    }
    return elenco;
  });

  protected readonly errori = computed<Readonly<Record<string, ErroriCampo>>>(() => {
    const t = testiGriglia.dettaglio;
    const risultato: Record<string, ErroriCampo> = {};
    const cella = this.dati().cella;
    for (const r of this.dati().reperibilita) {
      const m = this.modifiche().find((x) => x.codice === r.codice);
      let durata: string | null = null;
      let ora: string | null = null;
      if (m !== undefined && m.chiamata !== null) {
        const fasciaOra = t.oraErrore(r.inizio, r.fine);
        if (m.chiamata === 'oraNonValida') {
          ora = fasciaOra;
        } else {
          const motivo = this.store.verificaChiamate(cella, [
            { codice: m.codice, chiamata: m.chiamata },
          ]);
          durata = motivo === 'durataNonValida' ? t.durataErrore(r.durataMassima) : null;
          ora = motivo === 'oraFuoriFascia' ? fasciaOra : null;
        }
      }
      risultato[r.codice] = { durata, ora };
    }
    return risultato;
  });

  private readonly chiamateValide = computed<readonly ModificaChiamata[] | null>(() => {
    const elenco: ModificaChiamata[] = [];
    for (const m of this.modifiche()) {
      if (m.chiamata === 'oraNonValida') {
        return null;
      }
      elenco.push({ codice: m.codice, chiamata: m.chiamata });
    }
    const errori = this.errori();
    return Object.values(errori).some((e) => e.durata !== null || e.ora !== null) ? null : elenco;
  });

  /** Gli avvisi di riposo e sovrapposizione come sarebbero dopo «Applica». */
  protected readonly anteprima = computed(() => {
    const valide = this.chiamateValide();
    return valide === null ? [] : this.store.anteprimaAvvisiChiamate(this.dati().cella, valide);
  });

  /** Applicabile se i campi sono validi e qualcosa è cambiato rispetto al documento. */
  protected readonly puoApplicare = computed(() => {
    const valide = this.chiamateValide();
    if (valide === null) {
      return false;
    }
    return valide.some((m) => {
      const r = this.dati().reperibilita.find((x) => x.codice === m.codice);
      const prima = r?.chiamata ?? null;
      return (
        (prima === null) !== (m.chiamata === null) ||
        (prima !== null &&
          m.chiamata !== null &&
          (prima.durataMinuti !== m.chiamata.durataMinuti ||
            prima.oraInizio !== m.chiamata.oraInizio))
      );
    });
  });

  protected applica(): void {
    const valide = this.chiamateValide();
    if (valide === null || !this.puoApplicare()) {
      return;
    }
    const motivo = this.store.applicaChiamate(this.dati().cella, valide);
    if (motivo === null) {
      this.chiudi.emit();
    }
  }

  /** Il primo campo del pannello prende il focus all'apertura (UX §10). */
  focalizza(): void {
    this.corpo()?.nativeElement.querySelector<HTMLElement>('input, button')?.focus();
  }
}
