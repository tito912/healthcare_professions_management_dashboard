import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { adessoMs } from '@turni/domain';
import { Sessione } from './sessione.service';

/** Minuti senza tastiera né mouse dopo i quali si esce (PIANO 1.2). */
export const MINUTI_INATTIVITA = 30;
/** Secondi di preavviso prima dell'uscita: il dialogo compare a `MINUTI_INATTIVITA` meno questi secondi. */
export const SECONDI_PREAVVISO_INATTIVITA = 60;

const EVENTI_ATTIVITA = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'focusin'] as const;

/**
 * Uscita automatica per inattività (UX §3): dopo 29 minuti senza tastiera né mouse compare l'avviso, un
 * minuto dopo l'utente esce. Durante l'avviso solo «Resta connesso» prolunga la sessione: un movimento del
 * mouse non basta.
 *
 * Un controllo al secondo confronta l'ora con l'ultima attività (orologio del dominio): se il computer va in
 * sospensione o il browser rallenta i timer della scheda in secondo piano, al risveglio il tempo trascorso è
 * comunque quello vero e la sessione scade subito invece di prolungarsi.
 *
 * Con modifiche non salvate nella pagina corrente (`modificheNonSalvate`) l'avviso lo dice e offre
 * `salvaBozza`: la griglia (step 2.2) li imposta; le modifiche non si conservano nel browser (L27).
 */
@Injectable({ providedIn: 'root' })
export class Inattivita {
  private readonly sessione = inject(Sessione);
  private readonly finestra = inject(DOCUMENT).defaultView;

  private readonly _preavvisoAttivo = signal(false);
  private readonly _secondiRimasti = signal(SECONDI_PREAVVISO_INATTIVITA);
  readonly preavvisoAttivo = this._preavvisoAttivo.asReadonly();
  readonly secondiRimasti = this._secondiRimasti.asReadonly();

  /** Numero di modifiche non salvate nella pagina corrente (0 se non ce ne sono). */
  readonly modificheNonSalvate = signal(0);
  /** Salvataggio della bozza offerto nell'avviso; null se la pagina non ne ha. */
  readonly salvaBozza = signal<(() => Promise<void>) | null>(null);

  private controllo: ReturnType<typeof setInterval> | null = null;
  private ultimaAttivita = 0;
  private attivo = false;
  private readonly alleAttivita = (): void => {
    if (!this._preavvisoAttivo()) {
      this.ultimaAttivita = adessoMs();
    }
  };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.ferma());
  }

  /** Inizia a contare l'inattività. Idempotente. */
  avvia(): void {
    if (this.attivo) {
      return;
    }
    this.attivo = true;
    for (const evento of EVENTI_ATTIVITA) {
      this.finestra?.addEventListener(evento, this.alleAttivita, { passive: true, capture: true });
    }
    this.ultimaAttivita = adessoMs();
    this.controllo = setInterval(() => this.controlla(), 1000);
  }

  /** Smette di contare (uscita o chiusura del layout). */
  ferma(): void {
    this.attivo = false;
    for (const evento of EVENTI_ATTIVITA) {
      this.finestra?.removeEventListener(evento, this.alleAttivita, { capture: true });
    }
    if (this.controllo !== null) {
      clearInterval(this.controllo);
      this.controllo = null;
    }
    this._preavvisoAttivo.set(false);
    this._secondiRimasti.set(SECONDI_PREAVVISO_INATTIVITA);
    this.modificheNonSalvate.set(0);
    this.salvaBozza.set(null);
  }

  /** «Resta connesso»: chiude l'avviso e riparte da zero. */
  restaConnesso(): void {
    if (this.attivo) {
      this.ultimaAttivita = adessoMs();
      this._preavvisoAttivo.set(false);
      this._secondiRimasti.set(SECONDI_PREAVVISO_INATTIVITA);
    }
  }

  private controlla(): void {
    const limite = MINUTI_INATTIVITA * 60 * 1000;
    const trascorso = adessoMs() - this.ultimaAttivita;
    if (trascorso >= limite) {
      this.scaduto();
    } else if (trascorso >= limite - SECONDI_PREAVVISO_INATTIVITA * 1000) {
      this._secondiRimasti.set(Math.ceil((limite - trascorso) / 1000));
      this._preavvisoAttivo.set(true);
    } else if (this._preavvisoAttivo()) {
      // L'ora è tornata indietro (correzione dell'orologio): niente avviso.
      this._preavvisoAttivo.set(false);
      this._secondiRimasti.set(SECONDI_PREAVVISO_INATTIVITA);
    }
  }

  private scaduto(): void {
    this.ferma();
    void this.sessione.esci('inattivita');
  }
}
