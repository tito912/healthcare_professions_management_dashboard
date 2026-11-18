import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Spinner } from './spinner';

export type VarianteButton = 'primario' | 'secondario' | 'pericolo' | 'testo';

const BASE =
  'inline-flex h-controllo items-center justify-center gap-2 rounded-campo px-3 text-pulsante whitespace-nowrap border disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

const VARIANTI: Record<VarianteButton, string> = {
  primario: 'border-primario bg-primario text-white hover:bg-primario-hover',
  secondario: 'border-bordo bg-sfondo text-testo hover:bg-sfondo-neutro',
  pericolo: 'border-blocco bg-blocco text-white hover:bg-blocco-testo',
  testo: 'border-transparent bg-transparent text-primario hover:bg-sfondo-neutro',
};

/**
 * Pulsante o link con l'aspetto dei token: `<button appButton>` o `<a appButton>`.
 * Con `caricamento` mostra lo spinner, blocca il clic e dichiara `aria-busy`.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  imports: [Spinner],
  template: `
    @if (caricamento()) {
      <app-spinner [ritardo]="0" etichetta="" />
    }
    <ng-content />
  `,
  host: {
    '[class]': 'classi()',
    '[attr.aria-busy]': 'caricamento() ? "true" : null',
    '[attr.aria-disabled]': 'caricamento() ? "true" : null',
    '(click)': 'bloccaSeInCorso($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  readonly variante = input<VarianteButton>('secondario');
  readonly caricamento = input<boolean>(false);
  protected readonly classi = computed(() => `${BASE} ${VARIANTI[this.variante()]}`);

  protected bloccaSeInCorso(evento: Event): void {
    if (this.caricamento()) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
    }
  }
}
