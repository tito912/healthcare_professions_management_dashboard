import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Inattivita } from '../core/inattivita.service';
import { testi } from '../testi/it';
import { Button } from '../ui/button';
import { DialogCornice } from '../ui/dialog';

/** Avviso un minuto prima dell'uscita per inattività (UX §3). */
@Component({
  selector: 'app-dialogo-preavviso',
  imports: [DialogCornice, Button],
  template: `
    <app-dialog-cornice [titolo]="testi.inattivita.titolo" (chiudi)="restaConnesso()">
      <p>{{ testi.inattivita.messaggio(inattivita.secondiRimasti()) }}</p>
      @if (inattivita.modificheNonSalvate() > 0) {
        <p class="mt-2 font-medium text-bozza">
          {{ testi.inattivita.modificheNonSalvate(inattivita.modificheNonSalvate()) }}
        </p>
      }
      <ng-container azioni>
        @if (inattivita.salvaBozza(); as salva) {
          <button appButton type="button" (click)="salvaERimani(salva)">
            {{ testi.inattivita.salvaBozza }}
          </button>
        }
        <button
          appButton
          type="button"
          variante="primario"
          cdkFocusInitial
          (click)="restaConnesso()"
        >
          {{ testi.inattivita.restaConnesso }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoPreavviso {
  protected readonly testi = testi;
  protected readonly inattivita = inject(Inattivita);
  private readonly rif = inject<DialogRef<void>>(DialogRef);

  protected restaConnesso(): void {
    this.inattivita.restaConnesso();
    this.rif.close();
  }

  protected async salvaERimani(salva: () => Promise<void>): Promise<void> {
    await salva();
    this.restaConnesso();
  }
}
