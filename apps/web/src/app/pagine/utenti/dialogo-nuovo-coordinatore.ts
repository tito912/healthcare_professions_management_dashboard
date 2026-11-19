import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { analizzaInput, schemaCreaCoordinatoreInput } from '@turni/domain';
import { codiceErroreFunzione, eErroreDiRete, testoErroreFunzione } from '../../core/errori';
import { Sessione } from '../../core/sessione.service';
import { FunzioniUtenti } from '../../funzioni/utenti';
import { testi } from '../../testi/it';
import { testiUtenti } from '../../testi/it-utenti';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';
import { Icona } from '../../ui/icona';
import { Input } from '../../ui/input';

export interface EsitoNuovoCoordinatore {
  /** L'email per impostare la password è partita. */
  readonly emailInviata: boolean;
}

/** Dialogo «Nuovo coordinatore»: `creaCoordinatore`, poi `sendPasswordResetEmail` dal browser (UX §7.11). */
@Component({
  selector: 'app-dialogo-nuovo-coordinatore',
  imports: [Button, DialogCornice, Icona, Input],
  template: `
    <app-dialog-cornice [titolo]="testiUtenti.nuovo.titolo" (chiudi)="rif.close()">
      <form
        id="modulo-nuovo-coordinatore"
        class="flex flex-col gap-3"
        novalidate
        (submit)="crea($event)"
      >
        <app-input
          #campoNome
          [etichetta]="testiUtenti.nuovo.nome"
          autocomplete="off"
          [obbligatorio]="true"
          [(valore)]="nome"
          [errore]="erroreNome()"
          [disabilitato]="inCorso()"
        />
        <app-input
          #campoCognome
          [etichetta]="testiUtenti.nuovo.cognome"
          autocomplete="off"
          [obbligatorio]="true"
          [(valore)]="cognome"
          [errore]="erroreCognome()"
          [disabilitato]="inCorso()"
        />
        <app-input
          #campoEmail
          [etichetta]="testiUtenti.nuovo.email"
          tipo="email"
          autocomplete="off"
          [obbligatorio]="true"
          [(valore)]="email"
          [errore]="erroreEmail()"
          [disabilitato]="inCorso()"
        />
        <div aria-live="assertive">
          @if (erroreGenerale(); as testo) {
            <p class="flex items-start gap-1 text-blocco-testo">
              <app-icona nome="avviso" class="mt-px" /> <span>{{ testo }}</span>
            </p>
          }
        </div>
      </form>
      <ng-container azioni>
        <button appButton type="button" [disabled]="inCorso()" (click)="rif.close()">
          {{ testi.ui.annulla }}
        </button>
        <button
          appButton
          type="submit"
          form="modulo-nuovo-coordinatore"
          variante="primario"
          [caricamento]="inCorso()"
        >
          {{ testiUtenti.nuovo.crea }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoNuovoCoordinatore {
  protected readonly testi = testi;
  protected readonly testiUtenti = testiUtenti;
  protected readonly rif = inject<DialogRef<EsitoNuovoCoordinatore>>(DialogRef);
  private readonly funzioni = inject(FunzioniUtenti);
  private readonly sessione = inject(Sessione);

  protected readonly nome = signal('');
  protected readonly cognome = signal('');
  protected readonly email = signal('');
  protected readonly erroreNome = signal<string | null>(null);
  protected readonly erroreCognome = signal<string | null>(null);
  protected readonly erroreEmail = signal<string | null>(null);
  protected readonly erroreGenerale = signal<string | null>(null);
  protected readonly inCorso = signal(false);

  private readonly campoNome = viewChild.required<Input>('campoNome');
  private readonly campoCognome = viewChild.required<Input>('campoCognome');
  private readonly campoEmail = viewChild.required<Input>('campoEmail');

  protected async crea(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.inCorso()) {
      return;
    }
    this.erroreGenerale.set(null);
    const dati = { nome: this.nome(), cognome: this.cognome(), email: this.email() };
    const analisi = analizzaInput(schemaCreaCoordinatoreInput, dati);
    if (!analisi.valido) {
      this.erroreNome.set(analisi.campi.includes('nome') ? testiUtenti.nuovo.nomeNonValido : null);
      this.erroreCognome.set(
        analisi.campi.includes('cognome') ? testiUtenti.nuovo.cognomeNonValido : null,
      );
      this.erroreEmail.set(
        analisi.campi.includes('email') ? testiUtenti.nuovo.emailNonValida : null,
      );
      await Promise.resolve();
      if (analisi.campi.includes('nome')) {
        this.campoNome().focalizza();
      } else if (analisi.campi.includes('cognome')) {
        this.campoCognome().focalizza();
      } else {
        this.campoEmail().focalizza();
      }
      return;
    }
    this.erroreNome.set(null);
    this.erroreCognome.set(null);
    this.erroreEmail.set(null);

    this.inCorso.set(true);
    try {
      await this.funzioni.creaCoordinatore(analisi.valore);
    } catch (errore) {
      this.inCorso.set(false);
      if (codiceErroreFunzione(errore) === 'EMAIL_GIA_USATA') {
        this.erroreEmail.set(testiUtenti.nuovo.emailGiaUsata);
        await Promise.resolve();
        this.campoEmail().focalizza();
      } else {
        this.erroreGenerale.set(
          eErroreDiRete(errore) ? testi.erroreRete : testoErroreFunzione(errore),
        );
      }
      return;
    }
    // Coordinatore creato: il browser chiede a Firebase Auth l'email per scegliere la password.
    const invio = await this.sessione.inviaLinkReimpostazione(analisi.valore.email);
    this.inCorso.set(false);
    this.rif.close({ emailInviata: invio.ok });
  }
}
