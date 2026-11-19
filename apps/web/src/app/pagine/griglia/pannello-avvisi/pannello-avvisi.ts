// Pannello «Avvisi» (U5, UX §9.6): blocchi, avvisi e note in gruppi; un clic porta alla cella e le dà il focus.
// Le note di allineamento hanno «Aggiorna».
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { testi } from '../../../testi/it';
import { testiGriglia } from '../../../testi/it-griglia';
import { Icona, type NomeIcona } from '../../../ui/icona';
import type { Allineamento, RiferimentoCella, VoceAvviso } from '../stato/griglia.store';

type Livello = VoceAvviso['livello'];

interface Gruppo {
  readonly livello: Livello;
  readonly titolo: string;
  readonly icona: NomeIcona;
  readonly classi: string;
  readonly voci: readonly VoceAvviso[];
}

const LIVELLI: readonly Livello[] = ['blocco', 'avviso', 'nota'];

function iconaDi(livello: Livello): NomeIcona {
  return livello === 'blocco' ? 'chiudi' : livello === 'avviso' ? 'avviso' : 'info';
}

@Component({
  selector: 'app-pannello-avvisi',
  imports: [Icona],
  template: `
    <div class="flex items-center justify-between border-b border-bordo px-3 py-2">
      <h2 class="text-titolo-sezione" id="titolo-pannello-avvisi">
        {{ testiGriglia.pannelloAvvisi.titolo }}
      </h2>
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
        [attr.aria-label]="testiGriglia.pannelloAvvisi.chiudi"
        (click)="chiudi.emit()"
      >
        <app-icona nome="chiudi" />
      </button>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      @if (gruppi().length === 0) {
        <p class="text-testo-secondario">{{ testiGriglia.pannelloAvvisi.vuoto }}</p>
      }
      @for (gruppo of gruppi(); track gruppo.livello) {
        <section class="mb-4" [attr.aria-label]="gruppo.titolo">
          <h3
            class="mb-1 flex items-center gap-1 text-tabella font-semibold"
            [class]="gruppo.classi"
          >
            <app-icona [nome]="gruppo.icona" />
            {{ gruppo.titolo }} ({{ gruppo.voci.length }})
          </h3>
          <ul class="flex flex-col gap-1">
            @for (voce of gruppo.voci; track voce.chiave) {
              <li class="flex items-start gap-2 rounded-campo border border-bordo p-2">
                @if (voce.cella; as cella) {
                  <button
                    type="button"
                    class="min-w-0 flex-1 rounded-campo text-left"
                    [attr.aria-label]="
                      testiGriglia.pannelloAvvisi.vai(voce.testo + ' · ' + voce.dettaglio)
                    "
                    (click)="vai.emit(cella)"
                  >
                    <span class="block">{{ voce.testo }}</span>
                    <span class="block text-nota text-testo-secondario">{{ voce.dettaglio }}</span>
                  </button>
                } @else {
                  <div class="min-w-0 flex-1">
                    <span class="block">{{ voce.testo }}</span>
                    @if (voce.dettaglio !== '') {
                      <span class="block text-nota text-testo-secondario">{{
                        voce.dettaglio
                      }}</span>
                    }
                  </div>
                }
                @if (voce.azione; as azione) {
                  <button
                    type="button"
                    class="shrink-0 rounded-campo border border-primario px-2 py-0.5 font-medium text-primario hover:bg-nota-sfondo"
                    [disabled]="soloLettura()"
                    (click)="aggiorna.emit(azione)"
                  >
                    {{
                      azione.tipo === 'dipendente'
                        ? testiGriglia.pannelloAvvisi.aggiungi
                        : testiGriglia.pannelloAvvisi.aggiorna
                    }}
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  host: {
    role: 'complementary',
    'aria-labelledby': 'titolo-pannello-avvisi',
    class:
      'absolute top-0 right-0 bottom-0 z-40 flex w-pannello flex-col border-l border-bordo bg-sfondo shadow-xl',
    '(keydown.escape)': 'chiudi.emit()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PannelloAvvisi {
  protected readonly testi = testi;
  protected readonly testiGriglia = testiGriglia;
  readonly voci = input.required<readonly VoceAvviso[]>();
  readonly soloLettura = input(false);
  readonly vai = output<RiferimentoCella>();
  readonly aggiorna = output<Allineamento>();
  readonly chiudi = output<void>();

  protected readonly gruppi = computed<readonly Gruppo[]>(() =>
    LIVELLI.map((livello) => ({
      livello,
      titolo: testiGriglia.pannelloAvvisi.livelli[livello],
      icona: iconaDi(livello),
      classi:
        livello === 'blocco'
          ? 'text-blocco-testo'
          : livello === 'avviso'
            ? 'text-avviso-testo'
            : 'text-nota',
      voci: this.voci().filter((v) => v.livello === livello),
    })).filter((g) => g.voci.length > 0),
  );
}
