import { ChangeDetectionStrategy, Component, inject, Injectable, signal } from '@angular/core';
import { testi } from '../testi/it';
import { Icona } from './icona';
import { DURATE } from './token';

export type TipoToast = 'info' | 'successo' | 'errore';

/** Un'azione dentro la notifica (per esempio «Dettagli»): chiude la notifica ed esegue. */
export interface AzioneToast {
  readonly etichetta: string;
  readonly esegui: () => void;
}

export interface MessaggioToast {
  readonly id: number;
  readonly tipo: TipoToast;
  readonly testo: string;
  readonly azione?: AzioneToast;
}

/**
 * Notifiche brevi (UX §3): 5 secondi, chiudibili; quelle di errore restano finché non si chiudono.
 * Il contenitore le annuncia con `aria-live`: «polite» per le normali, «assertive» per gli errori.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _messaggi = signal<readonly MessaggioToast[]>([]);
  readonly messaggi = this._messaggi.asReadonly();
  private prossimoId = 1;
  private readonly timer = new Map<number, ReturnType<typeof setTimeout>>();

  info(testo: string, azione?: AzioneToast): number {
    return this.mostra('info', testo, azione);
  }

  successo(testo: string): number {
    return this.mostra('successo', testo);
  }

  errore(testo: string): number {
    return this.mostra('errore', testo);
  }

  chiudi(id: number): void {
    const timer = this.timer.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timer.delete(id);
    }
    this._messaggi.update((elenco) => elenco.filter((m) => m.id !== id));
  }

  private mostra(tipo: TipoToast, testo: string, azione?: AzioneToast): number {
    const id = this.prossimoId++;
    this._messaggi.update((elenco) => [
      ...elenco,
      azione === undefined ? { id, tipo, testo } : { id, tipo, testo, azione },
    ]);
    if (tipo !== 'errore') {
      this.timer.set(
        id,
        setTimeout(() => this.chiudi(id), DURATE.toast),
      );
    }
    return id;
  }
}

@Component({
  selector: 'app-toast-contenitore',
  imports: [Icona],
  template: `
    <div class="fixed right-4 bottom-4 z-[2000] flex w-96 flex-col gap-2">
      <div aria-live="polite" role="status" class="flex flex-col gap-2">
        @for (m of normali(); track m.id) {
          <div [class]="classi(m.tipo)">
            <app-icona [nome]="m.tipo === 'successo' ? 'spunta' : 'info'" />
            <p class="flex-1">{{ m.testo }}</p>
            @if (m.azione; as azione) {
              <button
                type="button"
                class="rounded-campo px-1 font-semibold underline"
                (click)="eseguiAzione(m.id, azione)"
              >
                {{ azione.etichetta }}
              </button>
            }
            <button
              type="button"
              class="rounded-campo"
              [attr.aria-label]="testi.ui.chiudi"
              (click)="toast.chiudi(m.id)"
            >
              <app-icona nome="chiudi" />
            </button>
          </div>
        }
      </div>
      <div aria-live="assertive" role="alert" class="flex flex-col gap-2">
        @for (m of errori(); track m.id) {
          <div [class]="classi(m.tipo)">
            <app-icona nome="avviso" />
            <p class="flex-1">{{ m.testo }}</p>
            <button
              type="button"
              class="rounded-campo"
              [attr.aria-label]="testi.ui.chiudi"
              (click)="toast.chiudi(m.id)"
            >
              <app-icona nome="chiudi" />
            </button>
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContenitore {
  protected readonly toast = inject(ToastService);
  protected readonly testi = testi;

  protected normali(): readonly MessaggioToast[] {
    return this.toast.messaggi().filter((m) => m.tipo !== 'errore');
  }

  protected eseguiAzione(id: number, azione: AzioneToast): void {
    this.toast.chiudi(id);
    azione.esegui();
  }

  protected errori(): readonly MessaggioToast[] {
    return this.toast.messaggi().filter((m) => m.tipo === 'errore');
  }

  protected classi(tipo: TipoToast): string {
    const base = 'flex items-start gap-2 rounded-pannello border px-3 py-2 shadow-lg ';
    switch (tipo) {
      case 'successo':
        return base + 'border-successo bg-successo-sfondo text-successo';
      case 'errore':
        return base + 'border-blocco bg-blocco-sfondo text-blocco-testo';
      case 'info':
        return base + 'border-nota bg-nota-sfondo text-nota';
    }
  }
}
