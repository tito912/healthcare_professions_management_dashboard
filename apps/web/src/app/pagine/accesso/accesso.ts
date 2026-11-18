import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { meseCorrente } from '@turni/domain';
import { rottaDiAtterraggio, rottaRichiestaValida } from '../../core/atterraggio';
import { Preferenze } from '../../core/preferenze.service';
import {
  Sessione,
  type EsitoRecupero,
  type MotivoErroreAccesso,
} from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { Icona } from '../../ui/icona';
import { Input } from '../../ui/input';

const ESPRESSIONE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Testo da mostrare per un errore di accesso: sempre generico sulle credenziali (UX §6). */
export function testoErroreAccesso(motivo: MotivoErroreAccesso): string {
  switch (motivo) {
    case 'credenziali':
      return testi.accesso.credenzialiErrate;
    case 'disattivato':
      return testi.accesso.accountDisattivato;
    case 'troppiTentativi':
      return testi.accesso.troppiTentativi;
    case 'rete':
      return testi.accesso.connessioneAssente;
    case 'altro':
      return testi.accesso.erroreGenerico;
  }
}

export function testoErroreRecupero(
  motivo: Extract<EsitoRecupero, { ok: false }>['motivo'],
): string {
  switch (motivo) {
    case 'emailNonValida':
      return testi.accesso.emailNonValida;
    case 'troppiTentativi':
      return testi.accesso.troppiTentativi;
    case 'rete':
      return testi.accesso.connessioneAssente;
    case 'altro':
      return testi.accesso.erroreGenerico;
  }
}

/** Accesso (schermata 1, UX §7.1): scheda di 400 px con email e password, oppure recupero della password. */
@Component({
  selector: 'app-accesso',
  imports: [Button, Icona, Input],
  template: `
    <main class="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-8">
      <p class="text-titolo-pagina">{{ testi.app.nomeBreve }}</p>
      <section
        class="w-scheda max-w-full rounded-pannello border border-bordo bg-sfondo p-6 shadow-sm"
        [attr.aria-labelledby]="'titolo-accesso'"
      >
        @if (!recupero()) {
          <h1 id="titolo-accesso" class="mb-4 text-titolo-sezione">{{ testi.accesso.titolo }}</h1>
          <form class="flex flex-col gap-3" novalidate (submit)="entra($event)">
            <app-input
              #campoEmail
              [etichetta]="testi.accesso.email"
              tipo="email"
              autocomplete="username"
              [(valore)]="email"
              [errore]="erroreEmail()"
              [disabilitato]="inCorso()"
            />
            <app-input
              #campoPassword
              [etichetta]="testi.accesso.password"
              tipo="password"
              autocomplete="current-password"
              [(valore)]="password"
              [errore]="errorePassword()"
              [disabilitato]="inCorso()"
            />
            <div aria-live="assertive">
              @if (erroreGenerale(); as testo) {
                <p class="flex items-start gap-1 text-blocco-testo">
                  <app-icona nome="avviso" class="mt-px" /> <span>{{ testo }}</span>
                </p>
              }
            </div>
            <div aria-live="polite">
              @if (avviso(); as testo) {
                <p class="flex items-start gap-1 text-nota">
                  <app-icona nome="info" class="mt-px" /> <span>{{ testo }}</span>
                </p>
              }
            </div>
            <button appButton type="submit" variante="primario" [caricamento]="inCorso()">
              {{ testi.accesso.entra }}
            </button>
            <button
              appButton
              type="button"
              variante="testo"
              [disabled]="inCorso()"
              (click)="apriRecupero()"
            >
              {{ testi.accesso.passwordDimenticata }}
            </button>
          </form>
        } @else {
          <h1 id="titolo-accesso" class="mb-2 text-titolo-sezione">
            {{ testi.accesso.titoloRecupero }}
          </h1>
          <p class="mb-4 text-testo-secondario">{{ testi.accesso.istruzioniRecupero }}</p>
          <form class="flex flex-col gap-3" novalidate (submit)="inviaLink($event)">
            <app-input
              #campoEmailRecupero
              [etichetta]="testi.accesso.email"
              tipo="email"
              autocomplete="username"
              [(valore)]="email"
              [errore]="erroreEmail()"
              [disabilitato]="inCorso()"
            />
            <div aria-live="polite">
              @if (rispostaRecupero(); as testo) {
                <p class="flex items-start gap-1 text-successo">
                  <app-icona nome="spunta" class="mt-px" /> <span>{{ testo }}</span>
                </p>
              }
            </div>
            <div aria-live="assertive">
              @if (erroreGenerale(); as testo) {
                <p class="flex items-start gap-1 text-blocco-testo">
                  <app-icona nome="avviso" class="mt-px" /> <span>{{ testo }}</span>
                </p>
              }
            </div>
            <button appButton type="submit" variante="primario" [caricamento]="inCorso()">
              {{ testi.accesso.inviaLink }}
            </button>
            <button appButton type="button" variante="testo" (click)="chiudiRecupero()">
              {{ testi.accesso.tornaAllAccesso }}
            </button>
          </form>
        }
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accesso {
  protected readonly testi = testi;
  private readonly sessione = inject(Sessione);
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly elenco = inject(ElencoReparti);
  private readonly preferenze = inject(Preferenze);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly erroreEmail = signal<string | null>(null);
  protected readonly errorePassword = signal<string | null>(null);
  protected readonly erroreGenerale = signal<string | null>(null);
  protected readonly rispostaRecupero = signal<string | null>(null);
  protected readonly inCorso = signal(false);
  protected readonly recupero = signal(false);

  private readonly campoEmail = viewChild<Input>('campoEmail');
  private readonly campoPassword = viewChild<Input>('campoPassword');
  private readonly campoEmailRecupero = viewChild<Input>('campoEmailRecupero');

  /** Messaggio informativo se si arriva da un'uscita (per inattività, account disattivato…). */
  protected readonly avviso = computed(() => {
    const motivo = this.sessione.motivoUscita();
    return motivo === null ? null : Sessione.testoUscita(motivo);
  });

  protected apriRecupero(): void {
    this.erroreGenerale.set(null);
    this.erroreEmail.set(null);
    this.errorePassword.set(null);
    this.rispostaRecupero.set(null);
    this.recupero.set(true);
    queueMicrotask(() => this.campoEmailRecupero()?.focalizza());
  }

  protected chiudiRecupero(): void {
    this.erroreGenerale.set(null);
    this.erroreEmail.set(null);
    this.rispostaRecupero.set(null);
    this.recupero.set(false);
    queueMicrotask(() => this.campoEmail()?.focalizza());
  }

  protected async entra(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.inCorso()) {
      return;
    }
    const email = this.email().trim();
    this.erroreEmail.set(email === '' ? testi.accesso.emailMancante : null);
    this.errorePassword.set(this.password() === '' ? testi.accesso.passwordMancante : null);
    this.erroreGenerale.set(null);
    if (email === '') {
      await this.focalizza(this.campoEmail());
      return;
    }
    if (this.password() === '') {
      await this.focalizza(this.campoPassword());
      return;
    }

    this.inCorso.set(true);
    const esito = await this.sessione.accedi(email, this.password());
    if (!esito.ok) {
      this.inCorso.set(false);
      this.erroreGenerale.set(testoErroreAccesso(esito.motivo));
      // Messaggio generico: non dice quale campo è sbagliato. Si riparte dal primo campo.
      this.password.set('');
      await this.focalizza(this.campoEmail());
      return;
    }
    try {
      await this.atterra();
    } finally {
      this.inCorso.set(false);
    }
  }

  protected async inviaLink(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.inCorso()) {
      return;
    }
    const email = this.email().trim();
    this.rispostaRecupero.set(null);
    this.erroreGenerale.set(null);
    if (email === '') {
      this.erroreEmail.set(testi.accesso.emailMancante);
      await this.focalizza(this.campoEmailRecupero());
      return;
    }
    if (!ESPRESSIONE_EMAIL.test(email)) {
      this.erroreEmail.set(testi.accesso.emailNonValida);
      await this.focalizza(this.campoEmailRecupero());
      return;
    }
    this.erroreEmail.set(null);
    this.inCorso.set(true);
    const esito = await this.sessione.inviaLinkReimpostazione(email);
    this.inCorso.set(false);
    if (esito.ok) {
      this.rispostaRecupero.set(testi.accesso.rispostaRecupero);
    } else if (esito.motivo === 'emailNonValida') {
      this.erroreEmail.set(testoErroreRecupero(esito.motivo));
      await this.focalizza(this.campoEmailRecupero());
    } else {
      this.erroreGenerale.set(testoErroreRecupero(esito.motivo));
    }
  }

  /** Dopo l'accesso: rotta richiesta, oppure atterraggio secondo UX §2 (U1). */
  private async atterra(): Promise<void> {
    const utente = this.sessione.utente();
    if (utente === null) {
      return;
    }
    if (utente.ruolo === 'COORDINATORE') {
      await this.elenco.carica();
    }
    const rotta = rottaDiAtterraggio({
      ruolo: utente.ruolo,
      rottaRichiesta: rottaRichiestaValida(this.rotta.snapshot.queryParamMap.get('ritorno')),
      reparti: this.elenco.reparti().map((reparto) => ({ id: reparto.id, passo: reparto.passo })),
      ultimoRepartoId: this.preferenze.leggi(utente.uid).ultimoRepartoId,
      meseCorrente: meseCorrente(),
    });
    await this.router.navigateByUrl(rotta);
  }

  private async focalizza(campo: Input | undefined): Promise<void> {
    await Promise.resolve();
    campo?.focalizza();
  }
}
