import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { eDataISO } from '@turni/domain';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';
import { Input } from '../../ui/input';

export interface DatiDisattiva {
  /** Data proposta: oggi. */
  readonly dataIniziale: string;
  /** Data di assunzione 'AAAA-MM-GG' o vuota: la cessazione non può precederla. */
  readonly dataAssunzione: string;
}

/**
 * «Disattiva…» (UX §7.5, L35): chiede la data di cessazione, predefinita oggi, e spiega la conservazione di
 * 5 anni. Restituisce la data scelta; la scheda la applica al form e il salvataggio resta esplicito (D1).
 */
@Component({
  selector: 'app-dialogo-disattiva',
  imports: [Button, DialogCornice, Input],
  template: `
    <app-dialog-cornice [titolo]="testi.dipendenti.disattivazione.titolo" (chiudi)="rif.close()">
      <!-- Il form racchiude anche i pulsanti (attributo form) così Invio nel campo data conferma. -->
      <form id="form-disattiva" novalidate (submit)="conferma($event)">
        <p class="mb-3">{{ testi.dipendenti.disattivazione.testo }}</p>
        <app-input
          tipo="date"
          [etichetta]="testi.dipendenti.disattivazione.data"
          [obbligatorio]="true"
          [(valore)]="data"
          [errore]="errore()"
        />
      </form>
      <ng-container azioni>
        <button appButton type="button" (click)="rif.close()">{{ testi.ui.annulla }}</button>
        <button appButton type="submit" form="form-disattiva" variante="pericolo">
          {{ testi.dipendenti.disattivazione.conferma }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoDisattiva {
  protected readonly testi = testi;
  private readonly dati = inject<DatiDisattiva>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<string>>(DialogRef);

  protected readonly data = signal(this.dati.dataIniziale);
  protected readonly errore = signal<string | null>(null);

  protected conferma(evento: Event): void {
    evento.preventDefault();
    const data = this.data();
    if (!eDataISO(data)) {
      this.errore.set(testi.dipendenti.errori.data);
      return;
    }
    if (this.dati.dataAssunzione !== '' && data < this.dati.dataAssunzione) {
      this.errore.set(testi.dipendenti.errori.cessazionePrimaAssunzione);
      return;
    }
    this.rif.close(data);
  }
}
