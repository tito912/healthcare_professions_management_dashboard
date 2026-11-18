import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { testi } from '../../testi/it';
import { Icona } from '../../ui/icona';

type StatoPasso = 'fatto' | 'inCorso' | 'daFare';

/**
 * Indicatore della creazione guidata (UX §7.3): ① Nome, ② Turni e reperibilità, ③ Dipendenti.
 * Si mostra finché `configurazione.passo != 'completata'`; `corrente` è il passo (1-3) della pagina.
 */
@Component({
  selector: 'app-indicatore-passi',
  imports: [Icona],
  template: `
    <ol class="flex items-center gap-4" [attr.aria-label]="testi.passi.elenco">
      @for (passo of passi(); track passo.numero) {
        <li
          class="flex items-center gap-2"
          [attr.aria-current]="passo.stato === 'inCorso' ? 'step' : null"
        >
          <span
            class="flex size-6 items-center justify-center rounded-full border text-nota font-semibold"
            [class.border-primario]="passo.stato === 'inCorso'"
            [class.bg-primario]="passo.stato === 'inCorso'"
            [class.text-white]="passo.stato === 'inCorso'"
            [class.border-successo]="passo.stato === 'fatto'"
            [class.bg-successo-sfondo]="passo.stato === 'fatto'"
            [class.text-successo]="passo.stato === 'fatto'"
            [class.border-bordo]="passo.stato === 'daFare'"
            [class.text-testo-secondario]="passo.stato === 'daFare'"
            aria-hidden="true"
          >
            @if (passo.stato === 'fatto') {
              <app-icona nome="spunta" class="size-4 [&_svg]:size-4" />
            } @else {
              {{ passo.numero }}
            }
          </span>
          <span [class.font-semibold]="passo.stato === 'inCorso'">{{ passo.etichetta }}</span>
          <span class="text-nota text-testo-secondario">({{ passo.testoStato }})</span>
          @if (!$last) {
            <span class="ml-2 h-px w-8 bg-bordo" aria-hidden="true"></span>
          }
        </li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicatorePassi {
  protected readonly testi = testi;
  readonly corrente = input.required<1 | 2 | 3>();

  protected readonly passi = computed(() => {
    const etichette = [testi.passi.nome, testi.passi.turni, testi.passi.dipendenti];
    const testiStato: Record<StatoPasso, string> = {
      fatto: testi.passi.fatto,
      inCorso: testi.passi.inCorso,
      daFare: testi.passi.daFare,
    };
    return etichette.map((etichetta, indice) => {
      const numero = indice + 1;
      const stato: StatoPasso =
        numero < this.corrente() ? 'fatto' : numero === this.corrente() ? 'inCorso' : 'daFare';
      return { numero, etichetta, stato, testoStato: testiStato[stato] };
    });
  });
}
