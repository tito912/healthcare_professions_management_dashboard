import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Icone a tratto (viewBox 24). Decorative: il significato è sempre nel testo o nell'`aria-label` vicino. */
const PERCORSI = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  griglia: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16M15 4v16',
  banca: 'M12 3v18M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H7',
  report: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7',
  dipendenti:
    'M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 010 5.5M18 14.3c1.8.8 3 2.6 3 4.7',
  configurazione:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  registro: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  utenti: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
  chiudi: 'M6 6l12 12M18 6L6 18',
  freccia: 'M6 9l6 6 6-6',
  spunta: 'M5 12l5 5 9-10',
  avviso: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
  occhio: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  occhioBarrato:
    'M3 3l18 18M10.6 6.2A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.7M6.6 7.6A17 17 0 002 12s4 7 10 7a9.7 9.7 0 004.2-1M9.9 9.9a3 3 0 004.2 4.2',
  piu: 'M12 5v14M5 12h14',
  altro: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;

export type NomeIcona = keyof typeof PERCORSI;

@Component({
  selector: 'app-icona',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    [attr.stroke-width]="spessore()"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="size-5 shrink-0"
  >
    <path [attr.d]="percorso()" />
  </svg>`,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icona {
  readonly nome = input.required<NomeIcona>();
  protected readonly percorso = computed(() => PERCORSI[this.nome()]);
  /** I puntini di «altro» hanno bisogno di un tratto più spesso per vedersi. */
  protected readonly spessore = computed(() => (this.nome() === 'altro' ? 4 : 2));
}
