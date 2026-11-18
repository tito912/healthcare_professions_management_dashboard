import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { formattaData, formattaOreSettimanali, type StatoDipendente } from '@turni/domain';
import { ContestoRoute } from '../../core/contesto-route';
import { Sessione } from '../../core/sessione.service';
import { ConfigurazioneRepo } from '../../dati/configurazione.repo';
import { ElencoReparti } from '../../dati/elenco-reparti';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import { testi } from '../../testi/it';
import { Badge, type VarianteBadge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { ChipTurno } from '../../ui/chip-turno';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { Input } from '../../ui/input';
import { Menu, type VoceMenu } from '../../ui/menu';
import { Table, TableScheletro } from '../../ui/table';
import { ToastService } from '../../ui/toast';
import { IndicatorePassi } from '../reparto/indicatore-passi';
import { DipendentiStore, type FiltroDipendenti, type RigaDipendente } from './dipendenti.store';

const FILTRI: readonly FiltroDipendenti[] = ['inServizio', 'cessati', 'tutti'];

/**
 * Reparto · Dipendenti (schermata 4, UX §7.5), anche passo 3 della creazione guidata: elenco con ricerca e
 * filtro, senza dati riservati; la scheda si apre come pannello laterale (rotte figlie `nuovo` e
 * `:did/anagrafica`). L'ADMIN vede lo stesso elenco in sola consultazione.
 */
@Component({
  selector: 'app-dipendenti',
  imports: [
    Badge,
    Button,
    ChipTurno,
    EmptyState,
    IndicatorePassi,
    Icona,
    Input,
    Menu,
    RouterLink,
    RouterOutlet,
    Table,
    TableScheletro,
  ],
  template: `
    @switch (store.stato()) {
      @case ('caricamento') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dipendenti.titolo }}</h1>
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dipendenti.titolo }}</h1>
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testi.dipendenti.errore }}</p>
          <button appButton type="button" (click)="ricarica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonDisponibile') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.dipendenti.titolo }}</h1>
        <app-empty-state [titolo]="testi.dipendenti.nonDisponibile" icona="info">
          <a appButton routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        @if (store.reparto(); as reparto) {
          <div class="mb-2 flex items-center justify-between gap-4">
            <h1 class="text-titolo-pagina">{{ testi.dipendenti.titoloReparto(reparto.nome) }}</h1>
            @if (modificabile()) {
              <a appButton variante="primario" routerLink="nuovo">
                <app-icona nome="piu" /> {{ testi.dipendenti.nuovo }}
              </a>
            }
          </div>

          @if (!modificabile()) {
            <p
              role="status"
              class="mb-4 rounded-campo border border-bordo bg-sfondo-neutro px-3 py-2 text-testo-neutro"
            >
              {{ testi.dipendenti.soloConsultazione }}
            </p>
          }
          @if (reparto.passo !== 'completata') {
            <div class="mb-4"><app-indicatore-passi [corrente]="3" /></div>
          }

          <div class="flex items-start gap-4">
            <div class="min-w-0 flex-1">
              @if (!store.haDipendenti()) {
                <app-empty-state
                  [titolo]="testi.dipendenti.vuotoTitolo"
                  [testo]="modificabile() ? testi.dipendenti.vuotoTesto : ''"
                  icona="dipendenti"
                >
                  @if (modificabile()) {
                    <a appButton variante="primario" routerLink="nuovo">{{
                      testi.dipendenti.aggiungi
                    }}</a>
                  }
                </app-empty-state>
              } @else {
                <div class="mb-3 flex flex-wrap items-end gap-4">
                  <div class="w-64">
                    <app-input
                      [etichetta]="testi.dipendenti.ricerca"
                      [(valore)]="ricerca"
                      autocomplete="off"
                    />
                  </div>
                  <fieldset class="flex items-center gap-3 pb-1">
                    <legend class="sr-only">{{ testi.dipendenti.filtro }}</legend>
                    @for (filtro of filtri; track filtro) {
                      <label class="flex items-center gap-1">
                        <input
                          type="radio"
                          name="filtro-dipendenti"
                          [value]="filtro"
                          [checked]="store.filtro() === filtro"
                          (change)="store.filtro.set(filtro)"
                        />
                        {{ testi.dipendenti.filtri[filtro] }}
                      </label>
                    }
                  </fieldset>
                  <p class="pb-1 text-testo-secondario" role="status">
                    {{
                      testi.dipendenti.conteggio(store.righeVisibili().length, store.righe().length)
                    }}
                  </p>
                </div>

                @if (store.righeVisibili().length === 0) {
                  <app-empty-state [titolo]="testi.dipendenti.nessunRisultato" icona="info" />
                } @else {
                  <app-table [etichetta]="testi.dipendenti.elenco">
                    <thead>
                      <tr>
                        <th scope="col">{{ testi.dipendenti.colonne.cognome }}</th>
                        <th scope="col">{{ testi.dipendenti.colonne.nome }}</th>
                        <th scope="col" class="text-right">{{ testi.dipendenti.colonne.ore }}</th>
                        <th scope="col">{{ testi.dipendenti.colonne.turniEsclusi }}</th>
                        <th scope="col">{{ testi.dipendenti.colonne.stato }}</th>
                        <th scope="col">
                          <span class="sr-only">{{ testi.dipendenti.colonne.azioni }}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (riga of store.righeVisibili(); track riga.dipendente.id) {
                        <tr
                          class="cursor-pointer hover:bg-sfondo-neutro"
                          [class.bg-riga-attiva]="riga.dipendente.id === aperto()"
                          (click)="apri(riga.dipendente)"
                        >
                          <th scope="row" class="font-medium">
                            <a
                              [routerLink]="[riga.dipendente.id, 'anagrafica']"
                              [attr.aria-label]="
                                testi.dipendenti.apri(nomeCompleto(riga.dipendente))
                              "
                              class="text-primario underline-offset-2 hover:underline"
                              (click)="$event.stopPropagation()"
                              >{{ riga.dipendente.cognome }}</a
                            >
                          </th>
                          <td>{{ riga.dipendente.nome }}</td>
                          <td class="text-right">
                            {{ ore(riga.dipendente.oreSettimanali) }}
                          </td>
                          <td>
                            @if (riga.dipendente.turniEsclusi.length === 0) {
                              <span aria-label="nessuno">{{
                                testi.dipendenti.nessunTurnoEscluso
                              }}</span>
                            } @else {
                              <span class="flex flex-wrap gap-1">
                                @for (codice of riga.dipendente.turniEsclusi; track codice) {
                                  <app-chip-turno
                                    [codice]="codice"
                                    [colore]="store.turnoPerCodice().get(codice)?.colore ?? null"
                                  />
                                }
                              </span>
                            }
                          </td>
                          <td>
                            <app-badge [variante]="variante(riga.stato)">{{
                              testoStato(riga)
                            }}</app-badge>
                          </td>
                          <td class="text-right" (click)="$event.stopPropagation()">
                            <app-menu
                              [etichetta]="
                                testi.dipendenti.menu.altreAzioni(nomeCompleto(riga.dipendente))
                              "
                              [voci]="voci()"
                              (scelta)="apri(riga.dipendente)"
                            />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </app-table>
                }
              }

              @if (modificabile() && reparto.passo !== 'completata') {
                <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-bordo pt-4">
                  <a appButton [routerLink]="['/reparti', reparto.id, 'configurazione']">{{
                    testi.dipendenti.passo.indietro
                  }}</a>
                  @if (reparto.passo === 'dipendenti') {
                    <button
                      appButton
                      type="button"
                      variante="primario"
                      [disabled]="!store.haDipendenti()"
                      [caricamento]="inCompletamento()"
                      [attr.aria-describedby]="store.haDipendenti() ? null : 'motivo-fine'"
                      (click)="fine()"
                    >
                      {{ testi.dipendenti.passo.fine }}
                    </button>
                    @if (!store.haDipendenti()) {
                      <p id="motivo-fine" class="text-testo-secondario">
                        {{ testi.dipendenti.passo.serveUnDipendente }}
                      </p>
                    }
                  } @else {
                    <p class="text-testo-secondario">
                      {{ testi.dipendenti.passo.completaPrimaITurni }}
                      <a
                        class="text-primario underline"
                        [routerLink]="['/reparti', reparto.id, 'configurazione']"
                        >{{ testi.dipendenti.passo.vaiAiTurni }}</a
                      >
                    </p>
                  }
                </div>
              }
            </div>
            <router-outlet />
          </div>
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dipendenti {
  protected readonly testi = testi;
  protected readonly store = inject(DipendentiStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly contesto = inject(ContestoRoute);
  private readonly sessione = inject(Sessione);
  private readonly elencoReparti = inject(ElencoReparti);
  private readonly configurazione = inject(ConfigurazioneRepo);
  private readonly toast = inject(ToastService);
  private readonly parametri = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly filtri = FILTRI;
  protected readonly inCompletamento = signal(false);
  /** Solo il coordinatore proprietario modifica: l'ADMIN consulta. Le regole lo impongono comunque. */
  protected readonly modificabile = computed(() => this.sessione.ruolo() === 'COORDINATORE');
  protected readonly ore = formattaOreSettimanali;

  /** Ricerca come proprietà a due vie del campo di testo. */
  protected readonly ricerca = this.store.ricerca;

  /** Dipendente aperto nella scheda (per evidenziare la riga): dall'URL. */
  protected readonly aperto = computed(() => {
    const trovato = /\/dipendenti\/([^/?#]+)\/anagrafica/u.exec(this.contesto.url());
    return trovato?.[1] ?? null;
  });

  protected readonly voci = computed<readonly VoceMenu[]>(() => [
    {
      id: 'apri',
      etichetta: this.modificabile()
        ? testi.dipendenti.menu.modifica
        : testi.dipendenti.menu.visualizza,
    },
  ]);

  constructor() {
    effect(() => {
      const id = this.parametri().get('rid');
      if (id !== null) {
        untracked(() => void this.store.carica(id));
      }
    });
  }

  protected ricarica(): void {
    const id = this.parametri().get('rid');
    if (id !== null) {
      void this.store.carica(id);
    }
  }

  protected nomeCompleto(dipendente: DipendenteSalvato): string {
    return `${dipendente.nome} ${dipendente.cognome}`;
  }

  protected apri(dipendente: DipendenteSalvato): void {
    void this.router.navigate([dipendente.id, 'anagrafica'], { relativeTo: this.route });
  }

  protected variante(stato: StatoDipendente): VarianteBadge {
    switch (stato) {
      case 'inServizio':
        return 'successo';
      case 'cessaIl':
      case 'daAssumere':
        return 'avviso';
      case 'cessato':
        return 'neutro';
    }
  }

  protected testoStato({ dipendente, stato }: RigaDipendente): string {
    switch (stato) {
      case 'inServizio':
        return testi.dipendenti.stato.inServizio;
      case 'cessaIl':
        return testi.dipendenti.stato.cessaIl(formattaData(dipendente.dataCessazione ?? ''));
      case 'daAssumere':
        return testi.dipendenti.stato.daAssumere(formattaData(dipendente.dataAssunzione ?? ''));
      case 'cessato':
        return dipendente.dataCessazione === null
          ? testi.dipendenti.stato.cessato
          : testi.dipendenti.stato.cessatoIl(formattaData(dipendente.dataCessazione));
    }
  }

  /** «Fine: vai alla pianificazione» (UX §7.3): completa la configurazione e apre il mese corrente. */
  protected async fine(): Promise<void> {
    const reparto = this.store.reparto();
    const utente = this.sessione.utente();
    if (reparto === null || utente === null || !this.store.haDipendenti()) {
      return;
    }
    this.inCompletamento.set(true);
    try {
      await this.configurazione.completa(reparto.id, utente.uid);
      await this.elencoReparti.carica(true);
      await this.router.navigate(['/reparti', reparto.id]);
    } catch {
      this.toast.errore(testi.dipendenti.passo.errore);
    } finally {
      this.inCompletamento.set(false);
    }
  }
}
