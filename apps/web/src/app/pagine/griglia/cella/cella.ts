// Una cella della griglia (UX §8.2, §8.3): codice del turno al centro sul suo colore, striscia delle
// reperibilità sotto, angoli per i segni, bordo d'avviso con icona (mai solo il colore). Presentazionale:
// riceve il modello già pronto dalla riga e non conosce lo store.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { testi } from '../../../testi/it';
import { COLORI } from '../../../ui/token';
import { idUnivoco } from '../../../ui/id-univoco';
import type { CellaVista } from '../modello';
import type { ConfigurazioneVista } from '../vista';

/** Quali lati del rettangolo selezionato passano per questa cella. */
export interface BordiSelezione {
  readonly sopra: boolean;
  readonly sotto: boolean;
  readonly sinistra: boolean;
  readonly destra: boolean;
}

/** Dove porta la conferma dell'inserimento veloce (UX §9.2). */
export type Direzione = 'giu' | 'su' | 'destra' | 'sinistra' | null;

export interface ConfermaInserimento {
  readonly testo: string;
  readonly direzione: Direzione;
  /** `Ctrl+Invio`: applica a tutto l'intervallo selezionato. */
  readonly suTutto: boolean;
}

const COLORE_OGGI = '#93C5FD';

@Component({
  selector: 'app-cella',
  template: `
    @let m = modello();
    @if (m.livello !== null) {
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-[1]"
        [style.border]="
          '2px ' + (m.livello === 'blocco' ? 'dashed ' + colori.blocco : 'solid ' + colori.avviso)
        "
      ></span>
      <span
        aria-hidden="true"
        class="pointer-events-none absolute z-[2] flex items-center justify-center rounded-full leading-none font-bold text-white ring-1 ring-white"
        [style]="stileIcona()"
        [style.background]="m.livello === 'blocco' ? colori.blocco : colori.avviso"
        >{{ m.livello === 'blocco' ? '×' : '!' }}</span
      >
    }
    @if (selezionata() !== null) {
      <span aria-hidden="true" class="pointer-events-none absolute inset-0 bg-selezione"></span>
    }
    @if (m.segni.chiamata && m.chip === null) {
      <!-- Solo reperibilità: il segno di chiamata sta nell'angolo in alto a sinistra della cella (UX §8.2). -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-0 left-0 z-[2]"
        [style]="angolo('altoSinistra', colori.testo)"
      ></span>
    }
    @if (m.chip; as chip) {
      <span
        class="relative mx-[3px] mt-[3px] flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-campo leading-none"
        [attr.data-chip]="chip.categoria"
        [style.height.px]="configurazione().altezzaChip"
        [style.background]="chip.sfondo"
        [style.color]="chip.testo"
        [style.border]="
          chip.bordo === null
            ? 'none'
            : '1px ' + (chip.bordoTratteggiato ? 'dashed ' : 'solid ') + chip.bordo
        "
        [style.font-weight]="chip.grassetto ? 600 : 400"
        [style.font-size.px]="configurazione().orarioSottoCodice ? 15 : 13"
      >
        @if (m.segni.chiamata) {
          <span
            aria-hidden="true"
            class="absolute top-0 left-0"
            [style]="angolo('altoSinistra', chip.testo)"
          ></span>
        }
        @if (m.segni.sostituzione) {
          <span
            aria-hidden="true"
            class="absolute top-0 right-0"
            [style]="angolo('altoDestra', chip.testo)"
          ></span>
        }
        @if (m.segni.orarioVariato) {
          <span
            aria-hidden="true"
            class="absolute right-0 bottom-0"
            [style]="angolo('bassoDestra', chip.testo)"
          ></span>
        }
        <span
          class="font-[inherit]"
          [class.rounded-[3px]]="chip.pastiglia"
          [class.px-1]="chip.pastiglia"
          [style.background]="chip.pastiglia ? '#FFFFFF' : null"
          >{{ chip.codice }}</span
        >
        @if (chip.orario !== null) {
          <span class="text-[11px] font-normal">{{ chip.orario }}</span>
        }
        @if (chip.nota !== null) {
          <span class="text-[11px] font-normal">{{ chip.nota }}</span>
        }
      </span>
    }
    @if (m.striscia.length > 0) {
      <span
        class="mx-px flex min-w-0 justify-center gap-[3px] font-semibold text-testo"
        [class.flex-col]="configurazione().striscia !== 'ore'"
        [class.items-center]="configurazione().striscia !== 'ore'"
        [style.font-size.px]="configurazione().fontStriscia"
        [style.line-height.px]="12"
        [style.margin-top.px]="stileStriscia()"
      >
        @for (voce of m.striscia; track voce.codice) {
          <span class="max-w-full truncate whitespace-nowrap" [attr.data-reperibilita]="voce.codice"
            >{{ voce.testo }}
            @if (voce.chiamata !== null) {
              <span class="ml-1 font-normal"> {{ voce.chiamata }}</span>
            }
          </span>
        }
      </span>
    }
    @if (inserimento(); as ins) {
      <input
        #campo
        type="text"
        maxlength="2"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        class="absolute top-[3px] right-[2px] left-[2px] z-10 rounded-campo border-2 border-focus bg-sfondo text-center text-[13px] font-semibold uppercase outline-none"
        [style.height.px]="configurazione().altezzaChip"
        [value]="ins.iniziale"
        [attr.aria-label]="testi.griglia.cella.inserimento"
        [attr.aria-describedby]="messaggio() === null ? null : idMessaggio"
        (input)="maiuscolo($event)"
        (keydown)="aTasto($event)"
        (blur)="annullato.emit()"
      />
    }
    @if (messaggio(); as testoMessaggio) {
      <div
        role="alert"
        [id]="idMessaggio"
        class="absolute top-full left-0 z-30 mt-1 w-max max-w-64 rounded-campo border border-blocco bg-blocco-sfondo px-2 py-1 text-nota font-medium text-blocco-testo shadow-lg"
      >
        {{ testoMessaggio }}
      </div>
    }
    @if (m.avvisi !== '') {
      <span class="sr-only" [id]="idAvviso">{{ m.avvisi }}</span>
    }
  `,
  host: {
    role: 'gridcell',
    class:
      'relative flex flex-col overflow-visible border-r border-b border-r-[#E5E7EB] border-b-[#E5E7EB] [scroll-margin-left:152px] [scroll-margin-top:40px] [scroll-margin-right:176px]',
    '[class.bg-sfondo]': "modello().sfondo === 'feriale'",
    '[class.bg-sfondo-weekend]': "modello().sfondo === 'weekend'",
    '[class.bg-sfondo-festivo]': "modello().sfondo === 'festivo'",
    '[class.cella-attiva]': 'attiva()',
    '[style.height.px]': 'configurazione().altezzaRiga',
    '[style.background-image]': 'sfondoFuoriServizio()',
    '[style.box-shadow]': 'ombra()',
    '[attr.data-r]': 'dipendenteId()',
    '[attr.data-g]': 'modello().giorno',
    '[attr.tabindex]': 'attiva() ? 0 : -1',
    '[attr.aria-label]': 'modello().etichetta',
    '[attr.aria-selected]': 'selezionata() !== null ? "true" : null',
    '[attr.data-evidenza]': 'evidenziata() !== null ? "true" : null',
    '[attr.aria-describedby]': "modello().avvisi !== '' ? idAvviso : null",
    '[attr.aria-readonly]': 'soloLettura() ? "true" : null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Cella {
  protected readonly testi = testi;
  protected readonly colori = COLORI;
  protected readonly idAvviso = idUnivoco('avviso-cella');
  protected readonly idMessaggio = idUnivoco('messaggio-cella');

  readonly modello = input.required<CellaVista>();
  readonly configurazione = input.required<ConfigurazioneVista>();
  readonly dipendenteId = input.required<string>();
  readonly attiva = input(false);
  readonly selezionata = input<BordiSelezione | null>(null);
  /** La settimana del candidato su cui si passa in «Trova sostituto» (UX §9.11): bordo azzurro. */
  readonly evidenziata = input<BordiSelezione | null>(null);
  readonly soloLettura = input(false);
  /** Inserimento veloce in questa cella: il testo iniziale (il primo carattere digitato). */
  readonly inserimento = input<{ readonly iniziale: string } | null>(null);
  readonly messaggio = input<string | null>(null);

  readonly confermato = output<ConfermaInserimento>();
  readonly annullato = output<void>();

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected readonly conChip = computed(() => this.modello().chip !== null);

  /**
   * Nella vista mese stretta (giorno sotto i 40 px) l'icona è più piccola (7 px) e sta al centro del bordo
   * superiore: in basso coprirebbe la striscia e negli angoli i segni del chip (UX §8.2).
   */
  protected readonly iconaInAlto = computed(
    () => this.configurazione().striscia === 'ore' && this.configurazione().larghezzaGiorno < 40,
  );

  /**
   * L'icona sta nell'angolo in basso a sinistra del chip; senza chip, o nella vista mese stretta, al centro del
   * bordo superiore: gli angoli in alto restano alla chiamata e alla sostituzione.
   */
  protected readonly stileIcona = computed<Record<string, string>>(() => {
    if (this.iconaInAlto() || !this.conChip()) {
      const lato = this.iconaInAlto() ? 7 : 9;
      return {
        top: '1px',
        left: `calc(50% - ${lato / 2}px)`,
        width: `${lato}px`,
        height: `${lato}px`,
        'font-size': this.iconaInAlto() ? '6px' : '8px',
      };
    }
    return {
      top: `${3 + this.configurazione().altezzaChip - 9}px`,
      left: '4px',
      width: '9px',
      height: '9px',
      'font-size': '8px',
    };
  });

  /** Senza chip la striscia sale in alto: con l'icona d'avviso (sempre in alto al centro, senza chip) scende sotto di essa. */
  protected readonly stileStriscia = computed(() =>
    this.modello().chip !== null ? 0 : this.modello().livello !== null ? 11 : 3,
  );

  protected readonly sfondoFuoriServizio = computed(() =>
    this.modello().fuoriServizio === null
      ? null
      : `repeating-linear-gradient(45deg, ${COLORI.sfondoPagina} 0 5px, ${COLORI.bordoNeutro} 5px 6px)`,
  );

  protected readonly ombra = computed(() => {
    const parti: string[] = [];
    if (this.modello().oggi) {
      parti.push(`inset 1px 0 0 ${COLORE_OGGI}`, `inset -1px 0 0 ${COLORE_OGGI}`);
    }
    const s = this.selezionata();
    if (s !== null) {
      const c = COLORI.selezioneBordo;
      if (s.sopra) {
        parti.push(`inset 0 2px 0 ${c}`);
      }
      if (s.sotto) {
        parti.push(`inset 0 -2px 0 ${c}`);
      }
      if (s.sinistra) {
        parti.push(`inset 2px 0 0 ${c}`);
      }
      if (s.destra) {
        parti.push(`inset -2px 0 0 ${c}`);
      }
    }
    const e = this.evidenziata();
    if (e !== null) {
      // Bordo di 2 px `#2563EB` attorno alla settimana del candidato: sopra e sotto sulla sua riga, ai lati sui bordi.
      const c = COLORI.selezioneBordo;
      parti.push(`inset 0 2px 0 ${c}`, `inset 0 -2px 0 ${c}`);
      if (e.sinistra) {
        parti.push(`inset 2px 0 0 ${c}`);
      }
      if (e.destra) {
        parti.push(`inset -2px 0 0 ${c}`);
      }
    }
    return parti.length === 0 ? null : parti.join(', ');
  });

  constructor() {
    effect(() => {
      const campo = this.campo()?.nativeElement;
      if (campo !== undefined) {
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }
    });
  }

  /** Triangolo rettangolo pieno nell'angolo, nel colore del testo del chip (UX §8.2). */
  protected angolo(
    posizione: 'altoSinistra' | 'altoDestra' | 'bassoDestra',
    colore: string,
  ): Record<string, string> {
    const lato = `${this.configurazione().angolo}px`;
    const trasparente = `${lato} solid transparent`;
    const pieno = `${lato} solid ${colore}`;
    const base = { width: '0', height: '0' };
    switch (posizione) {
      case 'altoSinistra':
        return { ...base, 'border-top': pieno, 'border-right': trasparente };
      case 'altoDestra':
        return { ...base, 'border-top': pieno, 'border-left': trasparente };
      case 'bassoDestra':
        return { ...base, 'border-bottom': pieno, 'border-left': trasparente };
    }
  }

  protected maiuscolo(evento: Event): void {
    const campo = evento.target;
    if (campo instanceof HTMLInputElement) {
      campo.value = campo.value.toUpperCase();
    }
  }

  protected aTasto(evento: KeyboardEvent): void {
    const campo = evento.target;
    if (!(campo instanceof HTMLInputElement)) {
      return;
    }
    const conferma = (direzione: Direzione, suTutto = false): void => {
      evento.preventDefault();
      evento.stopPropagation();
      this.confermato.emit({ testo: campo.value, direzione, suTutto });
    };
    switch (evento.key) {
      case 'Enter':
        conferma(evento.shiftKey ? 'su' : 'giu', evento.ctrlKey || evento.metaKey);
        return;
      case 'Tab':
        conferma(evento.shiftKey ? 'sinistra' : 'destra');
        return;
      case 'ArrowDown':
        conferma('giu');
        return;
      case 'ArrowUp':
        conferma('su');
        return;
      case 'ArrowLeft':
        conferma('sinistra');
        return;
      case 'ArrowRight':
        conferma('destra');
        return;
      case 'Escape':
        evento.preventDefault();
        evento.stopPropagation();
        this.annullato.emit();
        return;
      default:
        // Gli altri tasti restano al campo; nessuno raggiunge la griglia.
        evento.stopPropagation();
    }
  }
}
