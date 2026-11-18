import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type VarianteBadge = 'neutro' | 'successo' | 'avviso' | 'blocco' | 'nota';

const VARIANTI: Record<VarianteBadge, string> = {
  neutro: 'bg-sfondo-neutro text-testo-neutro border-bordo',
  successo: 'bg-successo-sfondo text-successo border-successo',
  avviso: 'bg-avviso-sfondo text-avviso-testo border-avviso',
  blocco: 'bg-blocco-sfondo text-blocco-testo border-blocco',
  nota: 'bg-nota-sfondo text-nota border-nota',
};

/** Etichetta di stato: porta sempre un testo, mai solo il colore (UX §1.3). */
@Component({
  selector: 'app-badge',
  template: `<ng-content />`,
  host: { '[class]': 'classi()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  readonly variante = input<VarianteBadge>('neutro');
  protected readonly classi = computed(
    () =>
      `inline-flex items-center rounded-campo border px-2 text-nota font-medium ${VARIANTI[this.variante()]}`,
  );
}
