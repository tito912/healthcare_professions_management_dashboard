import { CdkMenu, CdkMenuGroup, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, Directive, input } from '@angular/core';
import { Icona, type NomeIcona } from './icona';
import { idUnivoco } from './id-univoco';

/**
 * Menu a comparsa su CDK Menu: frecce per muoversi, `Invio`/`Spazio` per scegliere, `Esc` per chiudere
 * e ritorno del focus al pulsante. Le voci sono `<button appMenuVoce (click)="…">` proiettate.
 * Il pulsante porta `etichetta` come `aria-label` quando non ha testo visibile.
 */
@Component({
  selector: 'app-menu',
  imports: [CdkMenuTrigger, CdkMenu, Icona],
  template: `
    <button
      type="button"
      [cdkMenuTriggerFor]="pannello"
      [attr.aria-label]="testo() ? null : etichetta()"
      class="inline-flex h-controllo items-center gap-1 rounded-campo border border-transparent px-2 text-pulsante text-testo hover:bg-sfondo-neutro"
      [class.border-bordo]="bordo()"
      [class.bg-sfondo]="bordo()"
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
        <ng-content />
      </div>
    </ng-template>
  `,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {
  readonly etichetta = input.required<string>();
  /** Testo visibile del pulsante; vuoto per il solo «⋯». */
  readonly testo = input<string>('');
  readonly icona = input<NomeIcona>('altro');
  readonly bordo = input<boolean>(false);
}

/** Voce di menu: pulsante nativo reso voce CDK (`role="menuitem"`, navigazione con le frecce). */
@Component({
  selector: 'button[appMenuVoce]',
  template: `<ng-content />`,
  hostDirectives: [{ directive: CdkMenuItem, inputs: ['cdkMenuItemDisabled: disabilitata'] }],
  host: {
    type: 'button',
    class:
      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-testo text-corpo hover:bg-sfondo-neutro aria-disabled:cursor-not-allowed aria-disabled:text-testo-secondario',
    '[class.font-semibold]': 'selezionata()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuVoce {
  readonly selezionata = input<boolean>(false);
}

/** Gruppo di voci con titolo visibile (per esempio i reparti di un coordinatore). */
@Component({
  selector: 'app-menu-gruppo',
  template: `
    <div [id]="idTitolo" class="px-3 pt-2 pb-1 text-nota font-semibold text-testo-secondario">
      {{ etichetta() }}
    </div>
    <ng-content />
  `,
  hostDirectives: [CdkMenuGroup],
  host: { role: 'group', '[attr.aria-labelledby]': 'idTitolo', class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuGruppo {
  readonly etichetta = input.required<string>();
  protected readonly idTitolo = idUnivoco('gruppo-menu');
}
