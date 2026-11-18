// Legenda sempre apribile (UX §8.4): turni, fasce, assenze, la grammatica della cella e le scorciatoie da tastiera.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { coloreTurno } from '@turni/domain';
import { testi } from '../../../testi/it';
import type { AssenzaSalvata } from '../../../dati/assenze.repo';
import type { TurnoSalvato } from '../../../dati/turni.repo';
import { Button } from '../../../ui/button';
import { DialogCornice } from '../../../ui/dialog';
import { COLORI } from '../../../ui/token';

export interface DatiLegenda {
  readonly turni: readonly TurnoSalvato[];
  readonly assenze: readonly AssenzaSalvata[];
}

@Component({
  selector: 'app-legenda',
  imports: [DialogCornice, Button],
  template: `
    <app-dialog-cornice [titolo]="testi.griglia.legenda.titolo" (chiudi)="rif.close()">
      <div class="max-h-[60vh] overflow-y-auto pr-2 text-tabella">
        <h3 class="mb-1 font-semibold">{{ testi.griglia.legenda.turni }}</h3>
        <ul class="mb-3 flex flex-col gap-1">
          @for (t of turni(); track t.codice) {
            <li class="flex items-center gap-2">
              <span
                class="inline-flex h-5 min-w-8 items-center justify-center rounded-campo border px-1.5 text-nota font-semibold"
                [style.background]="sfondo(t)"
                [style.color]="testo(t)"
                [style.border-color]="bordo(t)"
                >{{ t.codice }}</span
              >
              <span
                >{{ t.nome }} {{ t.inizio }}–{{ t.fine }}
                @if (t.notturno) {
                  · {{ testi.griglia.menu.notturno }}
                }
              </span>
            </li>
          }
        </ul>
        <h3 class="mb-1 font-semibold">{{ testi.griglia.legenda.fasce }}</h3>
        <ul class="mb-3 flex flex-col gap-1">
          @for (f of fasce(); track f.codice) {
            <li class="flex items-center gap-2">
              <span
                class="inline-flex h-5 min-w-8 items-center justify-center rounded-campo border border-dashed border-testo-neutro bg-sfondo px-1.5 text-nota font-semibold"
                >{{ f.codice }}</span
              >
              <span>{{ f.nome }} {{ f.inizio }}–{{ f.fine }}</span>
            </li>
          }
        </ul>
        <h3 class="mb-1 font-semibold">{{ testi.griglia.legenda.assenze }}</h3>
        <ul class="mb-3 flex flex-col gap-1">
          @for (a of dati.assenze; track a.codice) {
            <li class="flex items-center gap-2">
              <span
                class="inline-flex h-5 min-w-8 items-center justify-center rounded-campo border bg-sfondo-neutro px-1.5 text-nota font-semibold"
                [style.border-color]="
                  a.effetto === 'comeRiposo' ? coloriUi.sfondoNeutro : coloriUi.bordoNeutro
                "
                >{{ a.codice }}</span
              >
              <span>{{ a.descrizione }}</span>
            </li>
          }
        </ul>
        <h3 class="mb-1 font-semibold">{{ testi.griglia.legenda.segni }}</h3>
        <ul class="mb-3 list-disc pl-5">
          <li>{{ testi.griglia.legenda.angoloAltoSinistra }}</li>
          <li>{{ testi.griglia.legenda.angoloAltoDestra }}</li>
          <li>{{ testi.griglia.legenda.angoloBassoDestra }}</li>
          <li>{{ testi.griglia.legenda.avviso }}</li>
          <li>{{ testi.griglia.legenda.scoperto }}</li>
          <li>{{ testi.griglia.legenda.fuoriServizio }}</li>
          <li>{{ testi.griglia.legenda.sfondi }}</li>
        </ul>
        <h3 class="mb-1 font-semibold">{{ testi.griglia.legenda.scorciatoie }}</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          @for (voce of scorciatoie; track voce[0]) {
            <dt class="font-medium">{{ voce[0] }}</dt>
            <dd>{{ voce[1] }}</dd>
          }
        </dl>
      </div>
      <ng-container azioni>
        <button appButton type="button" variante="primario" cdkFocusInitial (click)="rif.close()">
          {{ testi.ui.chiudi }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Legenda {
  protected readonly testi = testi;
  protected readonly coloriUi = COLORI;
  protected readonly dati = inject<DatiLegenda>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<void>>(DialogRef);
  protected readonly scorciatoie = testi.griglia.legenda.scorciatoieElenco;

  protected turni(): readonly TurnoSalvato[] {
    return this.dati.turni.filter((t) => t.tipo === 'turno');
  }

  protected fasce(): readonly TurnoSalvato[] {
    return this.dati.turni.filter((t) => t.tipo === 'reperibilita');
  }

  protected sfondo(t: TurnoSalvato): string {
    return (t.colore === null ? undefined : coloreTurno(t.colore))?.sfondo ?? COLORI.sfondoNeutro;
  }

  protected testo(t: TurnoSalvato): string {
    return (t.colore === null ? undefined : coloreTurno(t.colore))?.testo ?? COLORI.testoNeutro;
  }

  protected bordo(t: TurnoSalvato): string {
    return (t.colore === null ? undefined : coloreTurno(t.colore))?.bordo ?? COLORI.bordo;
  }
}
