import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { testoErroreFunzione } from '../../core/errori';
import { nomeCompletoDi, type UtenteElenco } from '../../dati/utenti.repo';
import { FunzioniUtenti } from '../../funzioni/utenti';
import { testi } from '../../testi/it';
import { testiUtenti } from '../../testi/it-utenti';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';
import { Icona } from '../../ui/icona';
import { Select } from '../../ui/select';

export interface DatiRiassegna {
  readonly repartoId: string;
  readonly repartoNome: string;
  /** Coordinatori attivi tra cui scegliere (il coordinatore attuale è già escluso). */
  readonly coordinatori: readonly UtenteElenco[];
}

export interface EsitoRiassegna {
  readonly coordinatoreNome: string;
}

/**
 * Dialogo «Riassegna…»: l'ADMIN sceglie il coordinatore e legge la frase di conferma prima di
 * confermare con un pulsante esplicito (UX §7.11).
 */
@Component({
  selector: 'app-dialogo-riassegna',
  imports: [Button, DialogCornice, Icona, Select],
  template: `
    <app-dialog-cornice
      [titolo]="testiUtenti.riassegnaReparto(dati.repartoNome)"
      (chiudi)="rif.close()"
    >
      @if (dati.coordinatori.length === 0) {
        <p>{{ testiUtenti.conferma.riassegnaNessuno }}</p>
      } @else {
        <app-select
          [etichetta]="testiUtenti.conferma.riassegnaScegli"
          [segnaposto]="testiUtenti.conferma.riassegnaSegnaposto"
          [opzioni]="opzioni()"
          [(valore)]="scelto"
          [errore]="errore()"
          [disabilitato]="inCorso()"
        />
        <div aria-live="polite" class="mt-3">
          @if (scelta(); as coordinatore) {
            <p class="font-medium">
              {{
                testiUtenti.conferma.riassegnaMessaggio(
                  dati.repartoNome,
                  nomeCompletoDi(coordinatore)
                )
              }}
            </p>
          }
        </div>
        <div aria-live="assertive">
          @if (erroreGenerale(); as testo) {
            <p class="mt-3 flex items-start gap-1 text-blocco-testo">
              <app-icona nome="avviso" class="mt-px" /> <span>{{ testo }}</span>
            </p>
          }
        </div>
      }
      <ng-container azioni>
        <button appButton type="button" [disabled]="inCorso()" (click)="rif.close()">
          {{ testi.ui.annulla }}
        </button>
        @if (dati.coordinatori.length > 0) {
          <button
            appButton
            type="button"
            variante="primario"
            [caricamento]="inCorso()"
            (click)="conferma()"
          >
            {{ testiUtenti.conferma.riassegnaConferma }}
          </button>
        }
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoRiassegna {
  protected readonly testi = testi;
  protected readonly testiUtenti = testiUtenti;
  protected readonly dati = inject<DatiRiassegna>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<EsitoRiassegna>>(DialogRef);
  private readonly funzioni = inject(FunzioniUtenti);

  protected readonly scelto = signal('');
  protected readonly errore = signal<string | null>(null);
  protected readonly erroreGenerale = signal<string | null>(null);
  protected readonly inCorso = signal(false);
  protected readonly nomeCompletoDi = nomeCompletoDi;

  protected readonly opzioni = computed(() =>
    this.dati.coordinatori.map((c) => ({ valore: c.uid, etichetta: nomeCompletoDi(c) })),
  );
  protected readonly scelta = computed(
    () => this.dati.coordinatori.find((c) => c.uid === this.scelto()) ?? null,
  );

  protected async conferma(): Promise<void> {
    const coordinatore = this.scelta();
    if (coordinatore === null) {
      this.errore.set(testiUtenti.conferma.riassegnaDaScegliere);
      return;
    }
    this.errore.set(null);
    this.erroreGenerale.set(null);
    this.inCorso.set(true);
    try {
      await this.funzioni.assegnaReparto({
        repartoId: this.dati.repartoId,
        coordinatoreUid: coordinatore.uid,
      });
      this.rif.close({ coordinatoreNome: nomeCompletoDi(coordinatore) });
    } catch (errore) {
      this.inCorso.set(false);
      this.erroreGenerale.set(testoErroreFunzione(errore));
    }
  }
}
