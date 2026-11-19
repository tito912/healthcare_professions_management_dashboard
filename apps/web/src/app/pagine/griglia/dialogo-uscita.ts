// Uscita con modifiche non salvate (D1, UX §9.7): cambio di pagina, di mese o di reparto.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { testi } from '../../testi/it';
import { testiGriglia } from '../../testi/it-griglia';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';

export type SceltaUscita = 'salva' | 'esci';

@Component({
  selector: 'app-dialogo-uscita',
  imports: [DialogCornice, Button],
  template: `
    <app-dialog-cornice
      [titolo]="testiGriglia.uscita.titolo(modifiche)"
      (chiudi)="rif.close(undefined)"
    >
      <p>{{ testiGriglia.uscita.testo }}</p>
      <ng-container azioni>
        <button appButton type="button" cdkFocusInitial (click)="rif.close(undefined)">
          {{ testiGriglia.uscita.annulla }}
        </button>
        <button appButton type="button" variante="pericolo" (click)="rif.close('esci')">
          {{ testiGriglia.uscita.esciSenzaSalvare }}
        </button>
        <button appButton type="button" variante="primario" (click)="rif.close('salva')">
          {{ testiGriglia.uscita.salvaEdEsci }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoUscita {
  protected readonly testi = testi;
  protected readonly testiGriglia = testiGriglia;
  protected readonly modifiche = inject<number>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<SceltaUscita | undefined>>(DialogRef);
}
