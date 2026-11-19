// Intestazione dei giorni (UX §8.1, §8.3): numero e iniziale (vista mese) o «lun 9» (viste a settimane); sabati,
// domeniche e festivi con il loro fondo; oggi in un cerchio blu. Fissa in alto durante lo scorrimento.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { testi } from '../../../testi/it';
import { sfondoDiColonna, type ColonnaGiorno } from '../modello';
import type { ConfigurazioneVista } from '../vista';

@Component({
  selector: 'app-intestazione',
  template: `
    <div
      role="columnheader"
      class="sticky left-0 z-30 flex items-center border-r border-b border-r-bordo border-b-bordo bg-sfondo-neutro pl-4 text-tabella font-semibold"
    >
      {{ testi.griglia.colonne.dipendente }}
    </div>
    @for (c of colonne(); track c.giorno) {
      <div
        role="columnheader"
        class="intestazione-giorno flex flex-col items-center justify-center border-r border-b border-r-[#E5E7EB] border-b-bordo leading-tight"
        [class.bg-sfondo-weekend]="sfondo(c) === 'weekend'"
        [class.bg-sfondo-festivo]="sfondo(c) === 'festivo'"
        [class.bg-sfondo]="sfondo(c) === 'feriale'"
        [attr.data-g]="c.giorno"
        [attr.title]="titolo(c)"
        [attr.aria-label]="
          c.etichetta +
          (c.festivita ? ', ' + c.festivita.nome : '') +
          (c.oggi ? ', ' + testi.griglia.colonne.oggi : '')
        "
        [style.box-shadow]="c.oggi ? 'inset 1px 0 0 #93C5FD, inset -1px 0 0 #93C5FD' : null"
      >
        @if (configurazione().intestazioneCompatta) {
          <span class="flex items-center text-[13px] font-semibold">
            <span
              [class.bg-primario]="c.oggi"
              [class.text-white]="c.oggi"
              [class.rounded-full]="c.oggi"
              [class.px-1]="c.oggi"
              >{{ c.numero }}</span
            >
            @if (c.festivita) {
              <span aria-hidden="true">✱</span>
            }
          </span>
          <span class="text-nota text-testo-secondario" aria-hidden="true">{{ iniziale(c) }}</span>
        } @else {
          <span class="flex items-center gap-1 text-[13px] font-semibold">
            <span class="text-testo-secondario font-normal">{{ giornoBreve(c) }}</span>
            <span
              [class.bg-primario]="c.oggi"
              [class.text-white]="c.oggi"
              [class.rounded-full]="c.oggi"
              [class.px-1.5]="c.oggi"
              >{{ c.numero }}</span
            >
            @if (c.festivita) {
              <span aria-hidden="true">✱</span>
            }
          </span>
        }
      </div>
    }
    <div
      role="columnheader"
      class="sticky z-30 flex items-center justify-end border-b border-b-bordo bg-sfondo-neutro px-1 text-nota font-semibold"
      style="right: 132px"
      [attr.title]="testi.griglia.colonne.pianificateEsteso"
    >
      {{ testi.griglia.colonne.pianificate }}
    </div>
    <div
      role="columnheader"
      class="sticky z-30 flex items-center justify-end border-b border-b-bordo bg-sfondo-neutro px-1 text-nota font-semibold"
      style="right: 88px"
      [attr.title]="testi.griglia.colonne.dovuteEsteso"
    >
      {{ testi.griglia.colonne.dovute }}
    </div>
    <div
      role="columnheader"
      class="sticky z-30 flex items-center justify-end border-b border-b-bordo bg-sfondo-neutro px-1 text-nota font-semibold"
      style="right: 44px"
      [attr.title]="testi.griglia.colonne.differenzaEsteso"
    >
      {{ testi.griglia.colonne.differenza }}
    </div>
    <div
      role="columnheader"
      class="sticky right-0 z-30 flex items-center justify-end gap-0.5 border-b border-b-bordo bg-sfondo-neutro px-1 text-nota font-semibold"
      [attr.title]="testi.griglia.colonne.reperibilitaEsteso"
    >
      {{ testi.griglia.colonne.reperibilita }}
    </div>
  `,
  host: {
    role: 'row',
    class: 'sticky top-0 z-20 grid h-10',
    '[style.grid-template-columns]': '"var(--colonne)"',
    'aria-rowindex': '1',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Intestazione {
  protected readonly testi = testi;
  readonly colonne = input.required<readonly ColonnaGiorno[]>();
  readonly configurazione = input.required<ConfigurazioneVista>();

  protected sfondo(c: ColonnaGiorno): 'feriale' | 'weekend' | 'festivo' {
    return sfondoDiColonna(c);
  }

  protected iniziale(c: ColonnaGiorno): string {
    return testi.griglia.iniziali[c.giornoSettimana - 1] ?? '';
  }

  protected giornoBreve(c: ColonnaGiorno): string {
    return testi.griglia.giorniBrevi[c.giornoSettimana - 1] ?? '';
  }

  protected titolo(c: ColonnaGiorno): string {
    return c.festivita === null
      ? c.etichetta
      : `${c.etichetta} · ${testi.griglia.colonne.festivo(c.festivita.nome)}`;
  }
}
