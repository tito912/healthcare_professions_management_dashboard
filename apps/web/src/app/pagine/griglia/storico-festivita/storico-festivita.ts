// Dettaglio dello storico di una festività (U6, UX §9.10): popover «Natale · ultimi 5 anni» con una riga per anno
// («2025: Rossi M. (M1), Neri G. (N1)»), aperto dall'intestazione del giorno festivo con clic, `Invio` o `Spazio`.
// Non modale: `Esc` o un clic fuori lo chiudono e il focus torna all'intestazione. I dati sono in memoria per la
// sessione (store): qui si mostrano soltanto, anche mentre si caricano.
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  type Signal,
} from '@angular/core';
import { testi } from '../../../testi/it';
import { idUnivoco } from '../../../ui/id-univoco';
import type { DatiStoricoVista } from '../stato/griglia.store';

export interface DatiPopoverStorico {
  /** Nome della festività («Natale»). */
  readonly festivita: string;
  readonly storico: Signal<DatiStoricoVista>;
  /** Richiede di nuovo i dati dopo un errore. */
  readonly riprova: () => void;
}

const DATI_STORICO = new InjectionToken<DatiPopoverStorico>('DATI_STORICO');
const CHIUDI_STORICO = new InjectionToken<() => void>('CHIUDI_STORICO');

@Component({
  selector: 'app-popover-storico',
  imports: [A11yModule],
  template: `
    @let s = dati.storico();
    <div
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      role="dialog"
      [attr.aria-labelledby]="idTitolo"
      class="w-96 rounded-pannello border border-bordo bg-sfondo p-4 shadow-lg"
      (keydown.escape)="chiudi()"
    >
      <div class="mb-2 flex items-start justify-between gap-2">
        <h2 [id]="idTitolo" class="text-titolo-sezione">
          {{ testi.griglia.storico.titolo(dati.festivita) }}
        </h2>
        <button
          type="button"
          class="rounded-campo border border-bordo px-2 hover:bg-sfondo-neutro"
          cdkFocusInitial
          (click)="chiudi()"
        >
          {{ testi.ui.chiudi }}
        </button>
      </div>
      @switch (s.stato) {
        @case ('caricamento') {
          <p class="text-testo-secondario" role="status">
            {{ testi.griglia.storico.caricamento }}
          </p>
        }
        @case ('errore') {
          <p role="alert" class="text-blocco-testo">{{ testi.griglia.storico.errore }}</p>
          <button
            type="button"
            class="mt-2 rounded-campo border border-bordo px-2 py-1 hover:bg-sfondo-neutro"
            (click)="dati.riprova()"
          >
            {{ testi.ui.riprova }}
          </button>
        }
        @default {
          <ul class="flex flex-col gap-1">
            @for (anno of s.anni; track anno.anno) {
              <li>
                <span class="font-semibold">{{ testi.griglia.storico.riga(anno.anno) }}</span>
                @if (anno.voci.length === 0) {
                  <span class="text-testo-secondario"> {{ testi.griglia.storico.nessuno }}</span>
                } @else {
                  @for (voce of anno.voci; track $index; let ultimo = $last) {
                    <span> {{ voce.nome }} ({{ voce.codice }}){{ ultimo ? '' : ',' }}</span>
                  }
                }
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverStorico {
  protected readonly testi = testi;
  protected readonly dati = inject(DATI_STORICO);
  protected readonly chiudi = inject(CHIUDI_STORICO);
  protected readonly idTitolo = idUnivoco('titolo-storico');
}

/** Apre il popover ancorato all'intestazione del giorno; il focus torna all'origine alla chiusura. */
@Injectable({ providedIn: 'root' })
export class StoricoFestivita {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private aperto: OverlayRef | null = null;

  apri(origine: HTMLElement, dati: DatiPopoverStorico): void {
    this.chiudiAperto();
    const rif = this.overlay.create({
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(origine)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
          { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
        ])
        .withPush(true),
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
    });
    this.aperto = rif;
    let finito = false;
    const chiudi = (): void => {
      if (finito) {
        return;
      }
      finito = true;
      rif.dispose();
      if (this.aperto === rif) {
        this.aperto = null;
      }
      origine.focus();
    };
    rif.backdropClick().subscribe(chiudi);
    rif.detachments().subscribe(chiudi);
    rif.attach(
      new ComponentPortal(
        PopoverStorico,
        null,
        Injector.create({
          parent: this.injector,
          providers: [
            { provide: DATI_STORICO, useValue: dati },
            { provide: CHIUDI_STORICO, useValue: chiudi },
          ],
        }),
      ),
    );
  }

  private chiudiAperto(): void {
    this.aperto?.dispose();
    this.aperto = null;
  }
}
