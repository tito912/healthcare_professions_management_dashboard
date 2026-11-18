import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { testi } from '../testi/it';
import { Icona } from './icona';
import { idUnivoco } from './id-univoco';

/**
 * Campo di testo con etichetta sempre visibile (niente segnaposto al posto dell'etichetta, UX §10).
 * L'errore sta in una regione `aria-live="assertive"` presente fin dall'inizio, così viene annunciato
 * quando compare, ed è collegato al campo con `aria-describedby`.
 */
@Component({
  selector: 'app-input',
  imports: [Icona],
  template: `
    <label [for]="idCampo" class="mb-1 block text-tabella font-medium text-testo">
      {{ etichetta() }}
      @if (obbligatorio()) {
        <span aria-hidden="true"> *</span>
      }
    </label>
    <div class="relative">
      <input
        #campo
        [id]="idCampo"
        [type]="tipoEffettivo()"
        [value]="valore()"
        [disabled]="disabilitato()"
        [required]="obbligatorio()"
        [attr.autocomplete]="autocomplete()"
        [attr.maxlength]="lunghezzaMassima()"
        [attr.aria-invalid]="errore() ? 'true' : null"
        [attr.aria-describedby]="descrizione()"
        (input)="valore.set(campo.value)"
        class="h-controllo w-full rounded-campo border bg-sfondo px-2 text-testo disabled:bg-sfondo-neutro disabled:text-testo-secondario"
        [class.border-bordo]="!errore()"
        [class.border-blocco]="errore()"
        [class.pr-9]="tipo() === 'password'"
      />
      @if (tipo() === 'password') {
        <button
          type="button"
          class="absolute top-0 right-0 flex h-controllo w-9 items-center justify-center rounded-campo text-testo-secondario"
          [attr.aria-pressed]="mostraPassword()"
          [attr.aria-label]="testi.ui.mostraPassword"
          [disabled]="disabilitato()"
          (click)="mostraPassword.set(!mostraPassword())"
        >
          <app-icona [nome]="mostraPassword() ? 'occhioBarrato' : 'occhio'" />
        </button>
      }
    </div>
    @if (suggerimento()) {
      <p [id]="idSuggerimento" class="mt-1 text-nota text-testo-secondario">{{ suggerimento() }}</p>
    }
    <div [id]="idErrore" aria-live="assertive" class="min-h-0">
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
export class Input {
  protected readonly testi = testi;
  readonly etichetta = input.required<string>();
  readonly tipo = input<'text' | 'email' | 'password' | 'date'>('text');
  readonly valore = model<string>('');
  readonly errore = input<string | null>(null);
  readonly suggerimento = input<string>('');
  readonly autocomplete = input<string>('off');
  readonly obbligatorio = input<boolean>(false);
  readonly disabilitato = input<boolean>(false);
  readonly lunghezzaMassima = input<number | null>(null);

  protected readonly idCampo = idUnivoco('campo');
  protected readonly idErrore = `${this.idCampo}-errore`;
  protected readonly idSuggerimento = `${this.idCampo}-suggerimento`;
  protected readonly mostraPassword = signal(false);
  private readonly elemento = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  protected readonly tipoEffettivo = computed(() =>
    this.tipo() === 'password' && this.mostraPassword() ? 'text' : this.tipo(),
  );

  protected readonly descrizione = computed(() => {
    const id: string[] = [];
    if (this.suggerimento()) {
      id.push(this.idSuggerimento);
    }
    if (this.errore()) {
      id.push(this.idErrore);
    }
    return id.length > 0 ? id.join(' ') : null;
  });

  /** Sposta il focus sul campo (per esempio sul primo campo errato). */
  focalizza(): void {
    this.elemento().nativeElement.focus();
  }
}
