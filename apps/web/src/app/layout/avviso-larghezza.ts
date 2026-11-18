import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { testi } from '../testi/it';
import { LARGHEZZE } from '../ui/token';
import { Icona } from '../ui/icona';

/** Fascia gialla sotto i 1280 px (UX §3): nessun layout per telefono, la pagina scorre in orizzontale. */
@Component({
  selector: 'app-avviso-larghezza',
  imports: [Icona],
  template: `
    @if (stretta()) {
      <div
        role="status"
        class="flex items-center gap-2 border-b border-avviso bg-avviso-sfondo px-4 py-2 text-avviso-testo"
      >
        <app-icona nome="avviso" />
        <p>{{ testi.layout.avvisoLarghezza }}</p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvvisoLarghezza {
  protected readonly testi = testi;
  protected readonly stretta = signal(false);

  constructor() {
    const finestra = inject(DOCUMENT).defaultView;
    const query = finestra?.matchMedia?.(`(max-width: ${LARGHEZZE.minima - 0.02}px)`);
    if (query) {
      this.stretta.set(query.matches);
      const alCambio = (evento: MediaQueryListEvent): void => this.stretta.set(evento.matches);
      query.addEventListener('change', alCambio);
      inject(DestroyRef).onDestroy(() => query.removeEventListener('change', alCambio));
    }
  }
}
