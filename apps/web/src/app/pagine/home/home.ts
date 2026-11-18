import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formattaMese, meseCorrente } from '@turni/domain';
import { rottaDelReparto } from '../../core/atterraggio';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import type { RepartoSintesi } from '../../dati/reparti.repo';
import { testi } from '../../testi/it';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';

interface GruppoCoordinatore {
  readonly uid: string;
  readonly nome: string;
  readonly attivo: boolean;
  readonly reparti: readonly RepartoSintesi[];
}

/**
 * Home (schermata 2, UX §7.2). Coordinatore: i propri reparti con «Aggiungi reparto» e «Apri»/«Riprendi».
 * ADMIN: tutti i reparti raggruppati per coordinatore, solo «Apri»: nessuna azione di modifica.
 * «Avvisi aperti» è predisposta e vuota: la riempiono gli step 2.3 e 4.1.
 */
@Component({
  selector: 'app-home',
  imports: [Badge, Button, EmptyState, Icona, RouterLink],
  template: `
    <h1 class="mb-6 text-titolo-pagina">{{ testi.home.titolo }}</h1>

    <section aria-labelledby="titolo-avvisi" class="mb-8">
      <h2 id="titolo-avvisi" class="mb-2 text-titolo-sezione">{{ testi.home.avvisiTitolo }}</h2>
      <div class="rounded-pannello border border-bordo bg-sfondo px-4 py-3 text-testo-secondario">
        <p>{{ testi.home.avvisiVuoto }}</p>
      </div>
    </section>

    <section [attr.aria-labelledby]="'titolo-reparti'" [attr.aria-busy]="elenco.stato() === 'caricamento'">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="titolo-reparti" class="text-titolo-sezione">
          {{ eAdmin() ? testi.home.repartiAdmin : testi.home.repartiCoordinatore }}
        </h2>
        @if (!eAdmin() && elenco.stato() === 'pronto' && elenco.reparti().length > 0) {
          <a appButton variante="primario" routerLink="/reparti/nuovo">
            <app-icona nome="piu" /> {{ testi.home.aggiungiReparto }}
          </a>
        }
      </div>

      @switch (elenco.stato()) {
        @case ('errore') {
          <div role="alert" class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo">
            <app-icona nome="avviso" />
            <p class="flex-1">{{ testi.home.errore }}</p>
            <button appButton type="button" (click)="riprova()">{{ testi.ui.riprova }}</button>
          </div>
        }
        @case ('pronto') {
          @if (eAdmin()) {
            @if (gruppi().length === 0) {
              <app-empty-state [titolo]="testi.home.vuotoAdmin" icona="info" />
            } @else {
              <div class="flex flex-col gap-6">
                @for (gruppo of gruppi(); track gruppo.uid) {
                  <section [attr.aria-label]="testi.home.gruppoCoordinatore(gruppo.nome, gruppo.reparti.length)">
                    <h3 class="mb-2 flex items-center gap-2 font-semibold">
                      {{ testi.home.gruppoCoordinatore(gruppo.nome, gruppo.reparti.length) }}
                      @if (!gruppo.attivo) {
                        <app-badge variante="neutro">{{ testi.home.disattivato }}</app-badge>
                      }
                    </h3>
                    <ul class="grid grid-cols-3 gap-4" [attr.aria-label]="testi.home.elencoReparti">
                      @for (reparto of gruppo.reparti; track reparto.id) {
                        <li class="rounded-pannello border border-bordo bg-sfondo p-4">
                          <p class="text-titolo-sezione">{{ reparto.nome }}</p>
                          <div class="mt-4 flex justify-end">
                            <a
                              appButton
                              [routerLink]="['/reparti', reparto.id]"
                              [attr.aria-label]="testi.home.apriReparto(reparto.nome)"
                            >{{ testi.home.apri }}</a>
                          </div>
                        </li>
                      }
                    </ul>
                  </section>
                }
              </div>
            }
          } @else {
            @if (elenco.reparti().length === 0) {
              <app-empty-state
                [titolo]="testi.home.vuotoCoordinatoreTitolo"
                [testo]="testi.home.vuotoCoordinatoreTesto"
                icona="griglia"
              >
                <a appButton variante="primario" routerLink="/reparti/nuovo">
                  {{ testi.home.creaPrimoReparto }}
                </a>
              </app-empty-state>
            } @else {
              <ul class="grid grid-cols-3 gap-4" [attr.aria-label]="testi.home.elencoReparti">
                @for (reparto of elenco.reparti(); track reparto.id) {
                  <li class="flex flex-col rounded-pannello border border-bordo bg-sfondo p-4">
                    <p class="text-titolo-sezione">{{ reparto.nome }}</p>
                    @if (reparto.passo === 'completata') {
                      <p class="mt-1 text-testo-secondario">{{ testi.home.meseCorrente(meseEtichetta) }}</p>
                    } @else {
                      <p class="mt-1 font-medium text-avviso-testo">
                        {{ testi.home.configurazioneDaCompletare }}
                      </p>
                      <p class="text-testo-secondario">{{ testi.home.passo(reparto.passo === 'turni' ? 2 : 3) }}</p>
                    }
                    <div class="mt-4 flex justify-end">
                      <a
                        appButton
                        [routerLink]="rotta(reparto)"
                        [attr.aria-label]="
                          reparto.passo === 'completata'
                            ? testi.home.apriReparto(reparto.nome)
                            : testi.home.riprendiReparto(reparto.nome)
                        "
                      >{{ reparto.passo === 'completata' ? testi.home.apri : testi.home.riprendi }}</a>
                    </div>
                  </li>
                }
              </ul>
            }
          }
        }
        @default {
          <ul class="grid grid-cols-3 gap-4" aria-hidden="true">
            @for (n of [1, 2, 3]; track n) {
              <li class="h-32 animate-pulse rounded-pannello border border-bordo bg-sfondo-neutro motion-reduce:animate-none"></li>
            }
          </ul>
          <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  protected readonly testi = testi;
  protected readonly elenco = inject(ElencoReparti);
  private readonly sessione = inject(Sessione);
  protected readonly meseEtichetta = formattaMese(meseCorrente());

  protected readonly eAdmin = computed(() => this.sessione.ruolo() === 'ADMIN');

  /** Reparti dell'ADMIN raggruppati per coordinatore, in ordine alfabetico. */
  protected readonly gruppi = computed<readonly GruppoCoordinatore[]>(() => {
    const perCoordinatore = new Map<string, RepartoSintesi[]>();
    for (const reparto of this.elenco.reparti()) {
      perCoordinatore.set(reparto.coordinatoreUid, [
        ...(perCoordinatore.get(reparto.coordinatoreUid) ?? []),
        reparto,
      ]);
    }
    const utenti = this.elenco.utentePerUid();
    return [...perCoordinatore.entries()]
      .map(([uid, reparti]) => {
        const utente = utenti.get(uid);
        return {
          uid,
          nome: utente ? `${utente.nome} ${utente.cognome}` : testi.layout.coordinatoreSconosciuto,
          attivo: utente?.attivo ?? true,
          reparti,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  });

  ngOnInit(): void {
    void this.elenco.carica();
  }

  protected rotta(reparto: RepartoSintesi): string {
    return rottaDelReparto(reparto, meseCorrente());
  }

  protected riprova(): void {
    void this.elenco.carica(true);
  }
}
