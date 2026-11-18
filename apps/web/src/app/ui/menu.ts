import { CdkMenu, CdkMenuGroup, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icona, type NomeIcona } from './icona';
import { idUnivoco } from './id-univoco';

export interface VoceMenu {
  /** Identificativo restituito da `scelta`. */
  readonly id: string;
  readonly etichetta: string;
  readonly disabilitata?: boolean;
  /** Voce corrente (per esempio il reparto aperto): segnata con una spunta e in grassetto. */
  readonly selezionata?: boolean;
  /** Titolo del gruppo: le voci consecutive con lo stesso titolo formano un gruppo con intestazione. */
  readonly gruppo?: string;
}

interface GruppoVoci {
  readonly chiave: string;
  readonly titolo: string | null;
  readonly idTitolo: string;
  readonly voci: readonly VoceMenu[];
}

/**
 * Menu a comparsa su CDK Menu: frecce per muoversi, `Invio`/`Spazio` per scegliere, `Esc` per chiudere e
 * ritorno del focus al pulsante. Le voci arrivano come dati (non come contenuto proiettato, perché CDK
 * ha bisogno che stiano dentro il menu nell'albero degli elementi). Il pulsante porta `etichetta` come
 * `aria-label` quando non ha testo visibile.
 */
@Component({
  selector: 'app-menu',
  imports: [CdkMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuGroup, Icona],
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="pannello"
      [attr.aria-label]="testo() ? null : etichetta()"
      class="inline-flex h-controllo items-center gap-1 rounded-campo border px-2 text-pulsante text-testo hover:bg-sfondo-neutro"
      [class.border-bordo]="bordo()"
      [class.bg-sfondo]="bordo()"
      [class.border-transparent]="!bordo()"
    >
      @if (testo()) {
        <span>{{ testo() }}</span>
      }
      <app-icona [nome]="icona()" />
    </button>
    <ng-template #pannello>
      <div
        cdkMenu
        [attr.aria-label]="etichetta()"
        class="min-w-48 rounded-pannello border border-bordo bg-sfondo py-1 shadow-lg"
      >
        @for (gruppo of gruppi(); track gruppo.chiave) {
          <div
            cdkMenuGroup
            [attr.aria-labelledby]="gruppo.titolo !== null ? gruppo.idTitolo : null"
          >
            @if (gruppo.titolo !== null) {
              <div
                [id]="gruppo.idTitolo"
                class="px-3 pt-2 pb-1 text-nota font-semibold text-testo-secondario"
              >
                {{ gruppo.titolo }}
              </div>
            }
            @for (voce of gruppo.voci; track voce.id) {
              <button
                type="button"
                cdkMenuItem
                [cdkMenuItemDisabled]="voce.disabilitata === true"
                (cdkMenuItemTriggered)="scelta.emit(voce.id)"
                class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-corpo text-testo hover:bg-sfondo-neutro aria-disabled:cursor-not-allowed aria-disabled:text-testo-secondario"
                [class.font-semibold]="voce.selezionata === true"
              >
                @if (voce.selezionata === true) {
                  <app-icona nome="spunta" />
                }
                {{ voce.etichetta }}
              </button>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {
  readonly etichetta = input.required<string>();
  readonly voci = input.required<readonly VoceMenu[]>();
  /** Testo visibile del pulsante; vuoto per il solo «⋯». */
  readonly testo = input<string>('');
  readonly icona = input<NomeIcona>('altro');
  readonly bordo = input<boolean>(false);
  readonly scelta = output<string>();

  private readonly idBase = idUnivoco('menu');

  protected readonly gruppi = computed<readonly GruppoVoci[]>(() => {
    const gruppi: { titolo: string | null; voci: VoceMenu[] }[] = [];
    for (const voce of this.voci()) {
      const titolo = voce.gruppo ?? null;
      const ultimo = gruppi[gruppi.length - 1];
      if (ultimo !== undefined && ultimo.titolo === titolo) {
        ultimo.voci.push(voce);
      } else {
        gruppi.push({ titolo, voci: [voce] });
      }
    }
    return gruppi.map((gruppo, indice) => ({
      chiave: `${indice}-${gruppo.titolo ?? ''}`,
      titolo: gruppo.titolo,
      idTitolo: `${this.idBase}-gruppo-${indice}`,
      voci: gruppo.voci,
    }));
  });
}
