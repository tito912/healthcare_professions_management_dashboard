import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChild,
} from '@angular/core';
import { Icona } from './icona';
import { idUnivoco } from './id-univoco';

export interface OpzioneSelect {
  readonly valore: string;
  readonly etichetta: string;
}

/**
 * Selezione con l'elemento nativo `<select>`: tastiera, annuncio dello screen reader e focus sono quelli
 * del browser, quindi accessibili per costruzione. Stile dai token; stessa etichetta e stesso errore di `Input`.
 */
@Component({
  selector: 'app-select',
  imports: [Icona],
  template: `
    <label [for]="idCampo" class="mb-1 block text-tabella font-medium text-testo">
      {{ etichetta() }}
    </label>
    <select
      #campo
      [id]="idCampo"
      [disabled]="disabilitato()"
      [attr.aria-invalid]="errore() ? 'true' : null"
      [attr.aria-describedby]="errore() ? idErrore : null"
      (change)="valore.set(campo.value)"
      class="h-controllo w-full rounded-campo border bg-sfondo px-2 text-testo disabled:bg-sfondo-neutro disabled:text-testo-secondario"
      [class.border-bordo]="!errore()"
      [class.border-blocco]="errore()"
    >
      @if (segnaposto()) {
        <option value="" [selected]="valore() === ''">{{ segnaposto() }}</option>
      }
      @for (opzione of opzioni(); track opzione.valore) {
        <option [value]="opzione.valore" [selected]="opzione.valore === valore()">
          {{ opzione.etichetta }}
        </option>
      }
    </select>
    <div [id]="idErrore" aria-live="assertive">
      @if (errore()) {
        <p class="mt-1 flex items-start gap-1 text-tabella text-blocco-testo">
          <app-icona nome="avviso" class="mt-px" />
          <span>{{ errore() }}</span>
        </p>
      }
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Select {
  readonly etichetta = input.required<string>();
  readonly opzioni = input.required<readonly OpzioneSelect[]>();
  readonly valore = model<string>('');
  /** Prima voce vuota (per esempio «Scegli un coordinatore»); assente se non serve. */
  readonly segnaposto = input<string>('');
  readonly errore = input<string | null>(null);
  readonly disabilitato = input<boolean>(false);

  protected readonly idCampo = idUnivoco('selezione');
  protected readonly idErrore = `${this.idCampo}-errore`;
  private readonly elemento = viewChild.required<ElementRef<HTMLSelectElement>>('campo');

  focalizza(): void {
    this.elemento().nativeElement.focus();
  }
}
