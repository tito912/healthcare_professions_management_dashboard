// «Aggiungi mese» (UX §7.6): calendario dei 12 mesi dell'anno con le frecce per l'anno; i mesi oltre la finestra di
// modifica (D8) sono disabilitati e quelli già creati marcati «Creato».
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { chiaveMeseDa, formattaMese, type ChiaveMese } from '@turni/domain';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';
import { Icona } from '../../ui/icona';

export interface DatiAggiungiMese {
  readonly meseIniziale: ChiaveMese;
  readonly creati: readonly ChiaveMese[];
  readonly creabile: (chiave: ChiaveMese) => boolean;
}

interface CasellaMese {
  readonly chiave: ChiaveMese;
  readonly nome: string;
  readonly creato: boolean;
  readonly oltre: boolean;
}

@Component({
  selector: 'app-dialogo-aggiungi-mese',
  imports: [DialogCornice, Button, Icona],
  template: `
    <app-dialog-cornice [titolo]="t.titolo" (chiudi)="rif.close(undefined)">
      <div class="mb-3 flex items-center justify-between">
        <button
          type="button"
          class="rounded-campo p-1 hover:bg-sfondo-neutro"
          [attr.aria-label]="t.annoPrecedente"
          (click)="anno.set(anno() - 1)"
        >
          <app-icona nome="frecciaSinistra" />
        </button>
        <span class="font-semibold" aria-live="polite">{{ t.anno(anno()) }}</span>
        <button
          type="button"
          class="rounded-campo p-1 hover:bg-sfondo-neutro"
          [attr.aria-label]="t.annoSuccessivo"
          (click)="anno.set(anno() + 1)"
        >
          <app-icona nome="frecciaDestra" />
        </button>
      </div>
      <div class="grid grid-cols-3 gap-2" role="radiogroup" [attr.aria-label]="t.selezione">
        @for (m of caselle(); track m.chiave) {
          <button
            type="button"
            role="radio"
            class="flex h-14 flex-col items-center justify-center rounded-campo border px-1 disabled:cursor-not-allowed disabled:opacity-60"
            [class.border-primario]="scelto() === m.chiave"
            [class.bg-nota-sfondo]="scelto() === m.chiave"
            [class.border-bordo]="scelto() !== m.chiave"
            [attr.aria-checked]="scelto() === m.chiave"
            [disabled]="m.creato || m.oltre"
            [attr.title]="m.creato ? t.creato : m.oltre ? t.oltre : null"
            (click)="scelto.set(m.chiave)"
          >
            <span class="font-medium">{{ m.nome }}</span>
            @if (m.creato) {
              <span class="text-nota text-testo-secondario">{{ t.creato }}</span>
            } @else if (m.oltre) {
              <span class="text-nota text-testo-secondario">{{ t.oltre }}</span>
            }
          </button>
        }
      </div>
      <ng-container azioni>
        <button appButton type="button" (click)="rif.close(undefined)">
          {{ testi.griglia.annulla }}
        </button>
        <button
          appButton
          type="button"
          variante="primario"
          [disabled]="scelto() === null"
          (click)="rif.close(scelto() ?? undefined)"
        >
          {{ scelto() === null ? t.creaTitolo : t.crea(nomeScelto()) }}
        </button>
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoAggiungiMese {
  protected readonly testi = testi;
  protected readonly t = testi.griglia.aggiungiMeseDialogo;
  private readonly dati = inject<DatiAggiungiMese>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<ChiaveMese | undefined>>(DialogRef);
  protected readonly anno = signal(Number(this.dati.meseIniziale.slice(0, 4)));
  protected readonly scelto = signal<ChiaveMese | null>(
    this.dati.creati.includes(this.dati.meseIniziale) || !this.dati.creabile(this.dati.meseIniziale)
      ? null
      : this.dati.meseIniziale,
  );

  protected caselle(): readonly CasellaMese[] {
    return Array.from({ length: 12 }, (_, i) => {
      const chiave = chiaveMeseDa(this.anno(), i + 1);
      return {
        chiave,
        nome: (testi.mesi[i] ?? '').replace(/^./, (c) => c.toUpperCase()),
        creato: this.dati.creati.includes(chiave),
        oltre: !this.dati.creabile(chiave),
      };
    });
  }

  protected nomeScelto(): string {
    const scelto = this.scelto();
    return scelto === null ? '' : formattaMese(scelto);
  }
}
