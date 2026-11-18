import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Stato «non connesso» (UX §3): segue `navigator.onLine` e gli eventi `online`/`offline`. */
@Injectable({ providedIn: 'root' })
export class Connessione {
  private readonly finestra = inject(DOCUMENT).defaultView;
  private readonly _connesso = signal(this.finestra?.navigator.onLine ?? true);
  readonly connesso = this._connesso.asReadonly();

  constructor() {
    const online = (): void => this._connesso.set(true);
    const offline = (): void => this._connesso.set(false);
    this.finestra?.addEventListener('online', online);
    this.finestra?.addEventListener('offline', offline);
    inject(DestroyRef).onDestroy(() => {
      this.finestra?.removeEventListener('online', online);
      this.finestra?.removeEventListener('offline', offline);
    });
  }
}
