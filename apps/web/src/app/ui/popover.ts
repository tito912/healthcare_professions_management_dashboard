import { A11yModule } from '@angular/cdk/a11y';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  ConnectedPosition,
} from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { idUnivoco } from './id-univoco';

const POSIZIONI: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
];

/**
 * Pannello a comparsa non modale ancorato a un pulsante (CDK Overlay). Il pulsante è il contenuto proiettato
 * nello slot `[popoverPulsante]`, il corpo è il resto. `Esc` o un clic fuori chiudono e il focus torna al pulsante.
 */
@Component({
  selector: 'app-popover',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, A11yModule],
  template: `
    <button
      #pulsante
      type="button"
      cdkOverlayOrigin
      #origine="cdkOverlayOrigin"
      aria-haspopup="dialog"
      [attr.aria-expanded]="aperto()"
      [attr.aria-controls]="aperto() ? idPannello : null"
      class="inline-flex h-controllo items-center gap-1 rounded-campo border border-bordo bg-sfondo px-3 text-pulsante hover:bg-sfondo-neutro"
      (click)="aperto.set(!aperto())"
    >
      <ng-content select="[popoverPulsante]" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origine"
      [cdkConnectedOverlayOpen]="aperto()"
      [cdkConnectedOverlayPositions]="posizioni"
      (overlayOutsideClick)="chiudiDaFuori($event)"
      (overlayKeydown)="alTasto($event)"
      (detach)="aperto.set(false)"
    >
      <div
        [id]="idPannello"
        role="dialog"
        [attr.aria-label]="etichetta()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        class="max-w-sm rounded-pannello border border-bordo bg-sfondo p-3 shadow-lg"
      >
        <ng-content />
      </div>
    </ng-template>
  `,
  host: { class: 'inline-block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Popover {
  readonly etichetta = input.required<string>();
  readonly aperto = model<boolean>(false);
  protected readonly posizioni = POSIZIONI;
  protected readonly idPannello = idUnivoco('popover');
  private readonly pulsante = viewChild.required<ElementRef<HTMLButtonElement>>('pulsante');

  protected alTasto(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      this.chiudi();
    }
  }

  protected chiudiDaFuori(evento: MouseEvent): void {
    if (!this.pulsante().nativeElement.contains(evento.target instanceof Node ? evento.target : null)) {
      this.aperto.set(false);
    }
  }

  private chiudi(): void {
    this.aperto.set(false);
    this.pulsante().nativeElement.focus();
  }
}
