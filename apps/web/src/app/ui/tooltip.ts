import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { idUnivoco } from './id-univoco';
import { DURATE } from './token';

@Component({
  selector: 'app-tooltip-contenuto',
  template: `{{ testo() }}`,
  host: {
    role: 'tooltip',
    '[id]': 'id()',
    class:
      'block max-w-xs rounded-campo bg-testo px-2 py-1 text-nota text-white shadow-lg pointer-events-none',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TooltipContenuto {
  readonly testo = signal('');
  readonly id = signal('');
}

/**
 * Suggerimento su CDK Overlay. Compare al passaggio del mouse (dopo un breve ritardo) e subito con il focus
 * da tastiera, così nulla resta solo al passaggio del mouse (UX §10). `Esc` lo chiude. Mentre è visibile
 * il suo `id` è in `aria-describedby` dell'elemento.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '(mouseenter)': 'programma()',
    '(mouseleave)': 'nascondi()',
    '(focusin)': 'mostra()',
    '(focusout)': 'nascondi()',
    '(keydown.escape)': 'nascondi()',
    '[attr.aria-describedby]': 'visibile() ? id : null',
  },
})
export class Tooltip implements OnDestroy {
  /** Testo del suggerimento; vuoto = nessun suggerimento. */
  readonly appTooltip = input.required<string>();

  protected readonly id = idUnivoco('tooltip');
  protected readonly visibile = signal(false);
  private readonly overlay = inject(Overlay);
  private readonly origine = inject<ElementRef<HTMLElement>>(ElementRef);
  private rif: OverlayRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected programma(): void {
    this.annullaTimer();
    this.timer = setTimeout(() => this.mostra(), DURATE.ritardoTooltip);
  }

  protected mostra(): void {
    this.annullaTimer();
    const testo = this.appTooltip();
    if (!testo || this.visibile()) {
      return;
    }
    this.rif = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.origine)
        .withPositions([
          { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
          { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
          { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center', offsetX: 6 },
        ])
        .withPush(true),
      scrollStrategy: this.overlay.scrollStrategies.close(),
    });
    const componente = this.rif.attach(new ComponentPortal(TooltipContenuto));
    componente.instance.testo.set(testo);
    componente.instance.id.set(this.id);
    this.visibile.set(true);
  }

  protected nascondi(): void {
    this.annullaTimer();
    this.rif?.dispose();
    this.rif = null;
    this.visibile.set(false);
  }

  ngOnDestroy(): void {
    this.nascondi();
  }

  private annullaTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
