import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { testi } from '../../testi/it';

/** Pagina segnaposto per le schermate che arrivano con gli step successivi (nuovo reparto, configurazione…). */
@Component({
  selector: 'app-segnaposto',
  template: `
    <h1 class="mb-2 text-titolo-pagina">{{ titolo() }}</h1>
    <p class="text-testo-secondario">{{ testi.segnaposto.testo }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Segnaposto {
  protected readonly testi = testi;
  readonly titolo = input.required<string>();
}
