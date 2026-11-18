import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Connessione } from '../core/connessione.service';
import { Inattivita } from '../core/inattivita.service';
import { Preferenze } from '../core/preferenze.service';
import { RepartoCorrente } from '../core/reparto-corrente';
import { Sessione } from '../core/sessione.service';
import { ElencoReparti } from '../dati/elenco-reparti';
import { testi } from '../testi/it';
import { Dialoghi } from '../ui/dialog';
import { AvvisoLarghezza } from './avviso-larghezza';
import { BarraSuperiore } from './barra-superiore';
import { DialogoPreavviso } from './dialogo-preavviso';
import { Navigazione } from './navigazione';

/** Ossatura delle pagine protette (UX §3): barra superiore, menu laterale, contenuto, fasce di stato. */
@Component({
  selector: 'app-shell',
  imports: [AvvisoLarghezza, BarraSuperiore, Navigazione, RouterOutlet],
  template: `
    <a
      href="#contenuto"
      class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-sfondo focus:p-2"
      (click)="vaiAlContenuto($event)"
    >
      {{ testi.layout.saltaAlContenuto }}
    </a>
    <app-avviso-larghezza />
    <app-barra-superiore [menuEsteso]="menuEsteso()" (alternaMenu)="alternaMenu()" />
    @if (!connessione.connesso()) {
      <div role="status" class="border-b border-bordo bg-sfondo-neutro px-4 py-1 text-testo-neutro">
        {{ testi.layout.connessioneAssente }}
      </div>
    }
    <div class="flex min-h-[calc(100vh-var(--t-h-barra-superiore))]">
      <app-navigazione [esteso]="menuEsteso()" />
      <main id="contenuto" tabindex="-1" class="min-w-0 flex-1 px-6 py-6 focus:outline-none">
        <div class="mx-auto max-w-contenuto">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell implements OnInit {
  protected readonly testi = testi;
  protected readonly connessione = inject(Connessione);
  private readonly sessione = inject(Sessione);
  private readonly elenco = inject(ElencoReparti);
  private readonly inattivita = inject(Inattivita);
  private readonly preferenze = inject(Preferenze);
  private readonly dialoghi = inject(Dialoghi);
  private readonly dialog = inject(Dialog);
  private readonly documento = inject(DOCUMENT);
  protected readonly menuEsteso = signal(true);
  private preavvisoAperto = false;

  constructor() {
    // Istanzia il servizio che ricorda l'ultimo reparto usato.
    inject(RepartoCorrente);
    effect(() => {
      if (this.inattivita.preavvisoAttivo() && !this.preavvisoAperto) {
        this.preavvisoAperto = true;
        void this.dialoghi.apri(DialogoPreavviso, undefined, 'alertdialog').then(() => {
          this.preavvisoAperto = false;
          // Chiuso con Esc o con la X: l'utente è presente, la sessione continua.
          if (this.inattivita.preavvisoAttivo()) {
            this.inattivita.restaConnesso();
          }
        });
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.inattivita.ferma();
      this.elenco.azzera();
      // I dialoghi dipendono dal servizio radice: la navigazione non li chiude (es. avviso di inattività).
      this.dialog.closeAll();
    });
  }

  ngOnInit(): void {
    const utente = this.sessione.utente();
    if (utente !== null) {
      this.menuEsteso.set(this.preferenze.leggi(utente.uid).menuEsteso);
    }
    void this.elenco.carica();
    this.inattivita.avvia();
  }

  protected alternaMenu(): void {
    const esteso = !this.menuEsteso();
    this.menuEsteso.set(esteso);
    const utente = this.sessione.utente();
    if (utente !== null) {
      this.preferenze.imposta(utente.uid, { menuEsteso: esteso });
    }
  }

  protected vaiAlContenuto(evento: Event): void {
    evento.preventDefault();
    this.documento.getElementById('contenuto')?.focus();
  }
}
