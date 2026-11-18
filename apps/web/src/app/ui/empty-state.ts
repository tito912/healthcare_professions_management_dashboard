import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icona, type NomeIcona } from './icona';

/** Stato vuoto (UX §6): icona, titolo, testo e, proiettata, l'azione. */
@Component({
  selector: 'app-empty-state',
  imports: [Icona],
  template: `
    <div class="mb-2 text-testo-secondario"><app-icona [nome]="icona()" /></div>
    <p class="text-titolo-sezione">{{ titolo() }}</p>
    @if (testo()) {
      <p class="mt-1 max-w-md text-testo-secondario">{{ testo() }}</p>
    }
    <div class="mt-4 empty:hidden"><ng-content /></div>
  `,
  host: {
    class:
      'flex flex-col items-center rounded-pannello border border-dashed border-bordo bg-sfondo px-6 py-8 text-center',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  readonly titolo = input.required<string>();
  readonly testo = input<string>('');
  readonly icona = input<NomeIcona>('info');
}
