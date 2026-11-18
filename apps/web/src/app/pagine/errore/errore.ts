import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { Icona } from '../../ui/icona';

/** Pagina d'errore (UX §7.13): «Qualcosa non ha funzionato» oppure, per rotte inesistenti, «Pagina non trovata». */
@Component({
  selector: 'app-errore',
  imports: [Button, Icona, RouterLink],
  template: `
    <div class="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <app-icona nome="avviso" class="mb-3 text-avviso" />
      <h1 class="text-titolo-pagina">
        {{ nonTrovata() ? testi.errore.nonTrovataTitolo : testi.errore.titolo }}
      </h1>
      <p class="mt-2 text-testo-secondario">
        {{ nonTrovata() ? testi.errore.nonTrovataTesto : testi.errore.testo }}
      </p>
      <div class="mt-6 flex gap-2">
        <a appButton variante="primario" routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        @if (!nonTrovata()) {
          <button appButton type="button" (click)="ricarica()">{{ testi.errore.riprova }}</button>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Errore {
  protected readonly testi = testi;
  readonly nonTrovata = input<boolean>(false);

  private readonly documento = inject(DOCUMENT);

  protected ricarica(): void {
    this.documento.location.reload();
  }
}

@Component({
  selector: 'app-non-trovata',
  imports: [Errore],
  template: `<app-errore [nonTrovata]="true" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonTrovata {}
