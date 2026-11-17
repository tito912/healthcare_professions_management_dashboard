import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import { serviziFirebase } from '../../core/firebase';
import { testi } from '../../testi/it';

interface RispostaPing {
  readonly esito: string;
  readonly regione: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly testi = testi.home;
  protected readonly inCorso = signal(false);
  protected readonly esito = signal<string | null>(null);
  protected readonly errore = signal<string | null>(null);

  // Segnaposto: chiama la callable "ping" (europe-west12). Sull'emulatore la risposta è di prova.
  protected async verifica(): Promise<void> {
    this.inCorso.set(true);
    this.esito.set(null);
    this.errore.set(null);
    try {
      const ping = httpsCallable<void, RispostaPing>(serviziFirebase().funzioni, 'ping');
      await ping();
      this.esito.set(testi.home.esitoOk);
    } catch {
      this.errore.set(testi.home.erroreVerifica);
    } finally {
      this.inCorso.set(false);
    }
  }
}
