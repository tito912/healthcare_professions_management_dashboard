import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { testi } from '../testi/it';
import { DURATE } from './token';

/**
 * Indicatore di attesa. Compare dopo `ritardo` millisecondi (300 di predefinito, UX §6) per evitare
 * lampeggi sui caricamenti brevi. Annuncia `etichetta` agli screen reader con `role="status"`.
 */
@Component({
  selector: 'app-spinner',
  template: `
    <span role="status" class="inline-flex items-center gap-2 text-testo-secondario">
      @if (visibile()) {
        <svg
          class="size-5 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
        </svg>
        <span [class.sr-only]="!conTesto()">{{ etichetta() }}</span>
      }
    </span>
  `,
  host: { class: 'inline-flex' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner implements OnInit {
  readonly etichetta = input<string>(testi.ui.caricamento);
  readonly ritardo = input<number>(DURATE.ritardoSpinner);
  readonly conTesto = input<boolean>(false);
  protected readonly visibile = signal(false);
  private readonly distruzione = inject(DestroyRef);

  ngOnInit(): void {
    const ritardo = this.ritardo();
    if (ritardo <= 0) {
      this.visibile.set(true);
      return;
    }
    const timer = setTimeout(() => this.visibile.set(true), ritardo);
    this.distruzione.onDestroy(() => clearTimeout(timer));
  }
}
