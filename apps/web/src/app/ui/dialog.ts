import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  InjectionToken,
  input,
  output,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { testi } from '../testi/it';
import { Button, type VarianteButton } from './button';
import { Icona } from './icona';
import { idUnivoco } from './id-univoco';

/** ID del titolo del dialogo corrente: `aria-labelledby` del contenitore CDK. */
export const ID_TITOLO_DIALOGO = new InjectionToken<string>('ID_TITOLO_DIALOGO');

/**
 * Cornice di ogni dialogo: titolo (`h2` collegato al dialogo), contenuto, azioni e pulsante «Chiudi».
 * Trappola del focus, ritorno del focus all'elemento che ha aperto il dialogo ed `Esc` sono di CDK Dialog.
 * Il pulsante di chiusura sta in fondo al DOM: il primo elemento attivabile resta quello del contenuto.
 */
@Component({
  selector: 'app-dialog-cornice',
  imports: [Icona],
  template: `
    <div
      class="relative w-[min(32rem,calc(100vw-2rem))] rounded-pannello border border-bordo bg-sfondo shadow-xl"
    >
      <h2 [id]="idTitolo" class="px-6 pt-6 pr-12 text-titolo-sezione">{{ titolo() }}</h2>
      <div class="px-6 py-4"><ng-content /></div>
      <div class="flex justify-end gap-2 px-6 pb-6 empty:hidden">
        <ng-content select="[azioni]" />
      </div>
      <button
        type="button"
        class="absolute top-3 right-3 flex size-8 items-center justify-center rounded-campo text-testo-secondario hover:bg-sfondo-neutro"
        [attr.aria-label]="testi.ui.chiudi"
        (click)="chiudi.emit()"
      >
        <app-icona nome="chiudi" />
      </button>
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCornice {
  protected readonly testi = testi;
  protected readonly idTitolo =
    inject(ID_TITOLO_DIALOGO, { optional: true }) ?? idUnivoco('titolo');
  readonly titolo = input.required<string>();
  readonly chiudi = output<void>();
}

export interface DatiConferma {
  readonly titolo: string;
  readonly messaggio: string;
  readonly etichettaConferma: string;
  readonly etichettaAnnulla?: string;
  readonly pericolo?: boolean;
}

/** Dialogo di conferma: il focus iniziale è su «Annulla», l'azione più prudente. */
@Component({
  selector: 'app-dialog-conferma',
  imports: [DialogCornice, Button],
  template: `
    <app-dialog-cornice [titolo]="dati.titolo" (chiudi)="rif.close(false)">
      <p>{{ dati.messaggio }}</p>
      <ng-container azioni>
        <button appButton type="button" cdkFocusInitial (click)="rif.close(false)">
          {{ dati.etichettaAnnulla ?? testi.ui.annulla }}
        </button>
        <button appButton type="button" [variante]="variante" (click)="rif.close(true)">
          {{ dati.etichettaConferma }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogConferma {
  protected readonly testi = testi;
  protected readonly dati = inject<DatiConferma>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<boolean>>(DialogRef);
  protected readonly variante: VarianteButton = this.dati.pericolo ? 'pericolo' : 'primario';
}

/** Apertura di dialoghi su CDK Dialog con le impostazioni comuni (UX §10). */
@Injectable({ providedIn: 'root' })
export class Dialoghi {
  private readonly dialog = inject(Dialog);

  /** Apre un componente come dialogo e restituisce il valore con cui si chiude (undefined se annullato). */
  async apri<D, R>(
    componente: ComponentType<unknown>,
    dati?: D,
    ruolo: 'dialog' | 'alertdialog' = 'dialog',
  ): Promise<R | undefined> {
    const idTitolo = idUnivoco('titolo-dialogo');
    const rif = this.dialog.open<R, D, unknown>(componente, {
      ...(dati !== undefined ? { data: dati } : {}),
      ariaModal: true,
      role: ruolo,
      ariaLabelledBy: idTitolo,
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      closeOnNavigation: true,
      backdropClass: ['bg-black/40'],
      providers: [{ provide: ID_TITOLO_DIALOGO, useValue: idTitolo }],
    });
    return firstValueFrom(rif.closed);
  }

  /** Conferma esplicita: risolve a true solo con il pulsante di conferma. */
  async conferma(dati: DatiConferma): Promise<boolean> {
    const esito = await this.apri<DatiConferma, boolean>(DialogConferma, dati);
    return esito === true;
  }
}
