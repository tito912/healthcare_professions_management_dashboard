import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { coloreTurno, type IdColoreTurno } from '@turni/domain';

/**
 * Chip di un turno o di una fascia di reperibilità (UX §5.1): il codice è sempre scritto, il colore è un
 * aiuto in più (mai solo il colore, UX §1.3). Senza colore (reperibilità o turno non più noto) il chip è
 * neutro con il bordo tratteggiato.
 */
@Component({
  selector: 'app-chip-turno',
  template: `{{ codice() }}`,
  host: {
    class:
      'inline-flex h-5 min-w-8 items-center justify-center rounded-campo border px-1.5 text-nota font-semibold',
    '[class.border-dashed]': '!stile()',
    '[class.border-bordo]': '!stile()',
    '[class.bg-sfondo-neutro]': '!stile()',
    '[class.text-testo-neutro]': '!stile()',
    '[style.background-color]': 'stile()?.sfondo ?? null',
    '[style.color]': 'stile()?.testo ?? null',
    '[style.border-color]': 'stile()?.bordo ?? null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChipTurno {
  readonly codice = input.required<string>();
  /** null per le fasce di reperibilità o per un turno che non esiste più. */
  readonly colore = input<IdColoreTurno | null>(null);

  protected readonly stile = computed(() => {
    const id = this.colore();
    return id === null ? undefined : coloreTurno(id);
  });
}
