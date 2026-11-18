import { computed, inject, Injectable, signal } from '@angular/core';
import { Sessione } from '../core/sessione.service';
import { RepartiRepo, type RepartoSintesi } from './reparti.repo';
import { UtentiRepo, type UtenteElenco } from './utenti.repo';

export type StatoElenco = 'inattivo' | 'caricamento' | 'pronto' | 'errore';

/**
 * Reparti visibili all'utente della sessione, condivisi da Home, selettore del reparto e menu:
 * il coordinatore vede i propri, l'ADMIN tutti (con l'elenco degli utenti per raggrupparli).
 */
@Injectable({ providedIn: 'root' })
export class ElencoReparti {
  private readonly sessione = inject(Sessione);
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly utentiRepo = inject(UtentiRepo);

  private readonly _reparti = signal<readonly RepartoSintesi[]>([]);
  private readonly _utenti = signal<readonly UtenteElenco[]>([]);
  private readonly _stato = signal<StatoElenco>('inattivo');
  private uidCaricato: string | null = null;
  private inCorso: Promise<void> | null = null;

  readonly reparti = this._reparti.asReadonly();
  /** Utenti noti all'ADMIN (vuoto per il coordinatore). */
  readonly utenti = this._utenti.asReadonly();
  readonly stato = this._stato.asReadonly();

  /** Nome di un coordinatore dato l'uid (solo ADMIN); undefined se sconosciuto. */
  readonly utentePerUid = computed(() => new Map(this._utenti().map((u) => [u.uid, u])));

  /** Carica l'elenco se non è già stato caricato per questo utente; `forza` lo rilegge. */
  carica(forza = false): Promise<void> {
    const utente = this.sessione.utente();
    if (utente === null) {
      this.azzera();
      return Promise.resolve();
    }
    if (!forza && this.uidCaricato === utente.uid && this._stato() === 'pronto') {
      return Promise.resolve();
    }
    if (this.inCorso !== null && this.uidCaricato === utente.uid) {
      return this.inCorso;
    }
    if (this.uidCaricato !== utente.uid) {
      this._reparti.set([]);
      this._utenti.set([]);
    }
    this.uidCaricato = utente.uid;
    this._stato.set('caricamento');
    const operazione = this.leggi(utente.uid, utente.ruolo === 'ADMIN').finally(() => {
      if (this.inCorso === operazione) {
        this.inCorso = null;
      }
    });
    this.inCorso = operazione;
    return operazione;
  }

  /** Dimentica tutto (all'uscita: nessun dato resta tra un utente e l'altro). */
  azzera(): void {
    this.uidCaricato = null;
    this.inCorso = null;
    this._reparti.set([]);
    this._utenti.set([]);
    this._stato.set('inattivo');
  }

  private async leggi(uid: string, admin: boolean): Promise<void> {
    try {
      if (admin) {
        const [reparti, utenti] = await Promise.all([this.repartiRepo.tutti(), this.utentiRepo.tutti()]);
        if (this.uidCaricato !== uid) {
          return;
        }
        this._reparti.set(reparti);
        this._utenti.set(utenti);
      } else {
        const reparti = await this.repartiRepo.delCoordinatore(uid);
        if (this.uidCaricato !== uid) {
          return;
        }
        this._reparti.set(reparti);
        this._utenti.set([]);
      }
      this._stato.set('pronto');
    } catch {
      if (this.uidCaricato === uid) {
        this._stato.set('errore');
      }
    }
  }
}
