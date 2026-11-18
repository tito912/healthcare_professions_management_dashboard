import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { eRuolo, type Ruolo } from '@turni/domain';
import { testi } from '../testi/it';
import { codiceAuth, codiceFirestore } from './errori';
import { serviziFirebase } from './firebase';

/** Utente della sessione: il ruolo viene dal custom claim del token e coincide con `utenti/{uid}`. */
export interface UtenteSessione {
  readonly uid: string;
  readonly nome: string;
  readonly cognome: string;
  readonly ruolo: Ruolo;
}

export type StatoSessione = 'caricamento' | 'anonimo' | 'autenticato';

/** Perché la sessione è finita: il testo si mostra nella schermata di accesso. */
export type MotivoUscita = 'inattivita' | 'terminata' | 'disattivato';

export type EsitoAccesso =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: MotivoErroreAccesso };

export type MotivoErroreAccesso =
  | 'credenziali'
  | 'disattivato'
  | 'troppiTentativi'
  | 'rete'
  | 'altro';

export type EsitoRecupero =
  | { readonly ok: true }
  | { readonly ok: false; readonly motivo: 'emailNonValida' | 'troppiTentativi' | 'rete' | 'altro' };

/**
 * Mostra «Account disattivato» all'accesso solo se Firebase Auth risponde `user-disabled` esclusivamente
 * con la password corretta (UX §6). Su un progetto reale non è verificabile (nessun accesso ai progetti
 * veri) e con la protezione dall'enumerazione delle email Auth può rispondere diversamente: finché non è
 * provato, `user-disabled` dà il messaggio generico, per non rivelare che l'account esiste.
 */
export const MOSTRA_ACCOUNT_DISATTIVATO = false;

/** Traduce il codice di un errore di accesso di Firebase Auth. Pura: i test la provano da sola. */
export function motivoDaErroreAccesso(
  codice: string | null,
  mostraDisattivato: boolean = MOSTRA_ACCOUNT_DISATTIVATO,
): MotivoErroreAccesso {
  switch (codice) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
    case 'auth/missing-password':
    case 'auth/missing-email':
    case 'auth/invalid-login-credentials':
      return 'credenziali';
    case 'auth/user-disabled':
      return mostraDisattivato ? 'disattivato' : 'credenziali';
    case 'auth/too-many-requests':
      return 'troppiTentativi';
    case 'auth/network-request-failed':
      return 'rete';
    default:
      return 'altro';
  }
}

/**
 * Sessione dell'utente: stato di Firebase Auth, ruolo dal custom claim e profilo da `utenti/{uid}`,
 * esposti come signal. L'accesso vale per la sola scheda del browser (persistenza di sessione, vedi
 * firebase.ts). Un utente senza ruolo valido, con ruolo diverso dal documento o disattivato non entra.
 */
@Injectable({ providedIn: 'root' })
export class Sessione {
  private readonly router = inject(Router);

  private readonly _utente = signal<UtenteSessione | null>(null);
  private readonly _stato = signal<StatoSessione>('caricamento');
  private readonly _motivoUscita = signal<MotivoUscita | null>(null);

  readonly utente = this._utente.asReadonly();
  readonly stato = this._stato.asReadonly();
  readonly ruolo = computed(() => this._utente()?.ruolo ?? null);
  readonly motivoUscita = this._motivoUscita.asReadonly();
  readonly nomeCompleto = computed(() => {
    const utente = this._utente();
    return utente ? `${utente.nome} ${utente.cognome}` : '';
  });

  private coda: Promise<void> = Promise.resolve();
  private avviata = false;
  private annullaControlloUtente: Unsubscribe | null = null;
  /** Vero dopo `esci()`: la fine della sessione non va trattata come un'uscita imprevista. */
  private uscitaVolontaria = false;

  /** Si abbona a Firebase Auth (una sola volta) e risolve quando lo stato iniziale è noto. */
  async pronta(): Promise<void> {
    this.avvia();
    await this.coda;
  }

  async accedi(email: string, password: string): Promise<EsitoAccesso> {
    this.avvia();
    this._motivoUscita.set(null);
    this.uscitaVolontaria = false;
    try {
      const { auth } = serviziFirebase();
      const credenziali = await signInWithEmailAndPassword(auth, email, password);
      await this.accoda(credenziali.user);
    } catch (errore) {
      return { ok: false, motivo: motivoDaErroreAccesso(codiceAuth(errore)) };
    }
    // Account senza ruolo valido o disattivato: la password era giusta ma non si entra, messaggio generico.
    return this._utente() === null ? { ok: false, motivo: 'credenziali' } : { ok: true };
  }

  /** Link per reimpostare la password. La risposta non dice mai se l'indirizzo è registrato. */
  async inviaLinkReimpostazione(email: string): Promise<EsitoRecupero> {
    try {
      await sendPasswordResetEmail(serviziFirebase().auth, email);
      return { ok: true };
    } catch (errore) {
      switch (codiceAuth(errore)) {
        case 'auth/user-not-found':
          return { ok: true };
        case 'auth/invalid-email':
        case 'auth/missing-email':
          return { ok: false, motivo: 'emailNonValida' };
        case 'auth/too-many-requests':
          return { ok: false, motivo: 'troppiTentativi' };
        case 'auth/network-request-failed':
          return { ok: false, motivo: 'rete' };
        default:
          return { ok: false, motivo: 'altro' };
      }
    }
  }

  /** Esce e porta alla schermata di accesso; `motivo` decide il messaggio mostrato lì. */
  async esci(motivo: MotivoUscita | null = null): Promise<void> {
    this._motivoUscita.set(motivo);
    this.uscitaVolontaria = true;
    this.fermaControlloUtente();
    await signOut(serviziFirebase().auth);
    await this.accoda(null);
    await this.router.navigateByUrl('/accesso');
  }

  private avvia(): void {
    if (this.avviata) {
      return;
    }
    this.avviata = true;
    onAuthStateChanged(serviziFirebase().auth, (utente) => {
      void this.accoda(utente);
    });
  }

  /** Applica lo stato di Auth in ordine: due notifiche ravvicinate non si sovrappongono. */
  private accoda(utente: User | null): Promise<void> {
    this.coda = this.coda.then(() => this.applica(utente));
    return this.coda;
  }

  private async applica(utente: User | null): Promise<void> {
    if (utente === null) {
      const eraAutenticato = this._utente() !== null;
      this.fermaControlloUtente();
      this._utente.set(null);
      this._stato.set('anonimo');
      // Sessione finita senza `esci()` (token revocato o utente disabilitato): ritorno all'accesso.
      if (eraAutenticato && !this.uscitaVolontaria) {
        this._motivoUscita.set(this._motivoUscita() ?? 'terminata');
        await this.router.navigateByUrl('/accesso');
      }
      return;
    }
    const profilo = await this.leggiProfilo(utente);
    if (profilo === 'riprova') {
      this._utente.set(null);
      this._stato.set('anonimo');
      return;
    }
    if (profilo === null) {
      await signOut(serviziFirebase().auth);
      this.fermaControlloUtente();
      this._utente.set(null);
      this._stato.set('anonimo');
      return;
    }
    this.uscitaVolontaria = false;
    this._utente.set(profilo);
    this._stato.set('autenticato');
    this.controllaUtente(utente.uid);
  }

  /**
   * Profilo valido, oppure `null` (non abilitato: si esce) o 'riprova' (errore transitorio, per esempio
   * di rete: non si esce da Auth, ma la sessione non è usabile).
   */
  private async leggiProfilo(utente: User): Promise<UtenteSessione | null | 'riprova'> {
    try {
      const token = await utente.getIdTokenResult();
      const ruoloClaim: unknown = token.claims['ruolo'];
      if (!eRuolo(ruoloClaim)) {
        return null;
      }
      const documento = await getDoc(doc(serviziFirebase().db, 'utenti', utente.uid));
      if (!documento.exists() || documento.get('attivo') !== true) {
        return null;
      }
      const nome: unknown = documento.get('nome');
      const cognome: unknown = documento.get('cognome');
      if (documento.get('ruolo') !== ruoloClaim || typeof nome !== 'string' || typeof cognome !== 'string') {
        return null;
      }
      return { uid: utente.uid, nome, cognome, ruolo: ruoloClaim };
    } catch (errore) {
      return codiceFirestore(errore) === 'permission-denied' ? null : 'riprova';
    }
  }

  /**
   * Durante la sessione ascolta il proprio documento: se l'ADMIN disattiva l'account (o le regole
   * iniziano a negare la lettura) l'uscita è immediata, senza aspettare il rinnovo del token.
   */
  private controllaUtente(uid: string): void {
    this.fermaControlloUtente();
    this.annullaControlloUtente = onSnapshot(
      doc(serviziFirebase().db, 'utenti', uid),
      (documento) => {
        if (!documento.exists() || documento.get('attivo') !== true) {
          void this.esci('disattivato');
        }
      },
      (errore) => {
        if (codiceFirestore(errore) === 'permission-denied') {
          void this.esci('disattivato');
        }
      },
    );
  }

  private fermaControlloUtente(): void {
    this.annullaControlloUtente?.();
    this.annullaControlloUtente = null;
  }

  /** Testo da mostrare in Accesso per il motivo dell'uscita. */
  static testoUscita(motivo: MotivoUscita): string {
    switch (motivo) {
      case 'inattivita':
        return testi.accesso.usciPerInattivita;
      case 'disattivato':
        return testi.accesso.utenteDisattivato;
      case 'terminata':
        return testi.accesso.sessioneTerminata;
    }
  }
}
