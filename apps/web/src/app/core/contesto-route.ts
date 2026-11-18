import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

export type SezioneReparto = 'mesi' | 'banca-ore' | 'report' | 'dipendenti' | 'configurazione';

const SEZIONI: readonly SezioneReparto[] = [
  'mesi',
  'banca-ore',
  'report',
  'dipendenti',
  'configurazione',
];

function eSezione(valore: string | undefined): valore is SezioneReparto {
  return SEZIONI.some((sezione) => sezione === valore);
}

/** Che cosa dice l'URL corrente: quale reparto, quale sezione, quale mese. Alimenta percorso e menu. */
@Injectable({ providedIn: 'root' })
export class ContestoRoute {
  private readonly router = inject(Router);

  readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly segmenti = computed(() => {
    const percorso = this.url().split(/[?#]/, 1)[0] ?? '';
    return percorso.split('/').filter((s) => s !== '');
  });

  /** ID del reparto nell'URL (`/reparti/:rid/…`); null altrove e per `/reparti/nuovo`. */
  readonly repartoId = computed(() => {
    const [radice, id] = this.segmenti();
    return radice === 'reparti' && id !== undefined && id !== 'nuovo' ? decodeURIComponent(id) : null;
  });

  readonly sezione = computed<SezioneReparto | null>(() => {
    if (this.repartoId() === null) {
      return null;
    }
    const sezione = this.segmenti()[2];
    return eSezione(sezione) ? sezione : null;
  });

  /** 'AAAA-MM' quando l'URL è la griglia di un mese. */
  readonly chiaveMese = computed(() => {
    const [, , sezione, chiave] = this.segmenti();
    return sezione === 'mesi' && chiave !== undefined ? chiave : null;
  });

  /** Primo segmento dell'URL ('home', 'utenti', 'reparti', …). */
  readonly radice = computed(() => this.segmenti()[0] ?? '');
  readonly eNuovoReparto = computed(() => this.segmenti()[0] === 'reparti' && this.segmenti()[1] === 'nuovo');
}
