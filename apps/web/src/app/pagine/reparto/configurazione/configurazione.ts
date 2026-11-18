import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { ConModificheNonSalvate } from '../../../core/guardie';
import { Inattivita } from '../../../core/inattivita.service';
import { testi } from '../../../testi/it';
import { Button } from '../../../ui/button';
import { Dialoghi } from '../../../ui/dialog';
import { EmptyState } from '../../../ui/empty-state';
import { Input } from '../../../ui/input';
import { TableScheletro } from '../../../ui/table';
import { ToastService } from '../../../ui/toast';
import { IndicatorePassi } from '../indicatore-passi';
import { ConfigurazioneStore } from './configurazione.store';
import { SezioneAssenze } from './sezione-assenze';
import { SezioneFestivita } from './sezione-festivita';
import { SezioneTurni } from './sezione-turni';

/**
 * Schermata 3 (UX §7.4), anche passo 2 della creazione guidata: nome, turni, fasce di reperibilità,
 * tipologie di assenza, festività e impostazioni. Le modifiche sono locali fino a «Salva modifiche» (un batch).
 * L'ADMIN vede la stessa pagina in sola consultazione.
 */
@Component({
  selector: 'app-configurazione',
  imports: [
    Button,
    EmptyState,
    IndicatorePassi,
    Input,
    RouterLink,
    SezioneAssenze,
    SezioneFestivita,
    SezioneTurni,
    TableScheletro,
  ],
  providers: [ConfigurazioneStore],
  template: `
    @switch (store.stato()) {
      @case ('caricamento') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.configurazione.titolo }}</h1>
        <app-table-scheletro [righe]="5" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.configurazione.titolo }}</h1>
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <p class="flex-1">{{ testi.configurazione.errore }}</p>
          <button appButton type="button" (click)="ricarica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonDisponibile') {
        <h1 class="mb-4 text-titolo-pagina">{{ testi.configurazione.titolo }}</h1>
        <app-empty-state [titolo]="testi.configurazione.nonDisponibile" icona="info">
          <a appButton routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        @if (store.reparto(); as reparto) {
          <div class="mb-2 flex items-center justify-between gap-4">
            <h1 id="titolo-configurazione" class="text-titolo-pagina">
              {{ testi.configurazione.titoloReparto(reparto.nome) }}
            </h1>
            @if (store.modificabile()) {
              <button
                appButton
                type="button"
                variante="primario"
                [caricamento]="store.inSalvataggio()"
                (click)="salva(false)"
              >
                {{ testi.configurazione.salvaModifiche }}
              </button>
            }
          </div>

          @if (!store.modificabile()) {
            <p
              role="status"
              class="mb-4 rounded-campo border border-bordo bg-sfondo-neutro px-3 py-2 text-testo-neutro"
            >
              {{ testi.configurazione.soloConsultazione }}
            </p>
          }

          @if (!store.completata()) {
            <div class="mb-4">
              <app-indicatore-passi [corrente]="reparto.passo === 'turni' ? 2 : 3" />
            </div>
          }

          <div class="mb-4 min-h-6 text-corpo" aria-live="polite" role="status">
            @if (store.modificabile()) {
              @if (store.sporca()) {
                <span class="font-medium text-bozza" data-stato="non-salvato">{{
                  testi.configurazione.modificheNonSalvate
                }}</span>
              } @else {
                <span class="text-testo-secondario" data-stato="salvato">{{
                  testi.configurazione.tuttoSalvato
                }}</span>
              }
            }
          </div>
          @if (store.tentato() && !(store.errori()?.valida ?? true)) {
            <p role="alert" class="mb-4 text-blocco-testo">
              {{ testi.configurazione.correggiGliErrori }}
            </p>
          }

          <div class="mb-6 max-w-lg">
            @if (store.modificabile()) {
              <app-input
                [etichetta]="testi.configurazione.nomeReparto"
                [obbligatorio]="true"
                [lunghezzaMassima]="60"
                [valore]="store.bozza()?.nome ?? ''"
                (valoreChange)="store.impostaNome($event)"
                [errore]="store.tentato() ? (store.errori()?.nome ?? null) : null"
              />
            } @else {
              <p class="text-tabella font-medium">{{ testi.configurazione.nomeReparto }}</p>
              <p>{{ store.bozza()?.nome }}</p>
            }
          </div>

          <app-sezione-turni tipo="turno" />
          <app-sezione-turni tipo="reperibilita" />
          <app-sezione-assenze />
          <app-sezione-festivita />

          <section aria-labelledby="titolo-impostazioni" class="mb-8">
            <h2 id="titolo-impostazioni" class="mb-2 text-titolo-sezione">
              {{ testi.configurazione.impostazioni.titolo }}
            </h2>
            <fieldset [disabled]="!store.modificabile()" class="flex flex-col gap-1">
              <legend class="mb-1">{{ testi.configurazione.impostazioni.notte }}</legend>
              <label class="flex items-center gap-2">
                <input
                  type="radio"
                  name="attribuzione-notte"
                  value="inizio"
                  [checked]="store.bozza()?.attribuzioneNotte === 'inizio'"
                  (change)="store.impostaAttribuzioneNotte('inizio')"
                />
                {{ testi.configurazione.impostazioni.inizio }}
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="radio"
                  name="attribuzione-notte"
                  value="fine"
                  [checked]="store.bozza()?.attribuzioneNotte === 'fine'"
                  (change)="store.impostaAttribuzioneNotte('fine')"
                />
                {{ testi.configurazione.impostazioni.fine }}
              </label>
            </fieldset>
          </section>

          @if (store.modificabile()) {
            <div class="flex items-center gap-2 border-t border-bordo pt-4">
              @if (reparto.passo === 'turni') {
                <a appButton routerLink="/home">{{ testi.configurazione.indietro }}</a>
                <button
                  appButton
                  type="button"
                  variante="primario"
                  [caricamento]="store.inSalvataggio()"
                  (click)="salva(true)"
                >
                  {{ testi.configurazione.salvaEContinua }}
                </button>
                @if (store.tentato() && store.errori()?.nessunTurno) {
                  <p role="alert" class="text-blocco-testo">
                    {{ testi.configurazione.serveUnTurno }}
                  </p>
                }
              } @else if (reparto.passo === 'dipendenti') {
                <a
                  appButton
                  variante="primario"
                  [routerLink]="['/reparti', reparto.id, 'dipendenti']"
                  >{{ testi.configurazione.vaiAiDipendenti }}</a
                >
              }
            </div>
          }
        }
      }
    }
  `,
  host: {
    '(window:beforeunload)': 'primaDiChiudere($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configurazione implements ConModificheNonSalvate {
  protected readonly testi = testi;
  protected readonly store = inject(ConfigurazioneStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inattivita = inject(Inattivita);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly parametri = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  constructor() {
    effect(() => {
      const id = this.parametri().get('rid');
      if (id !== null) {
        untracked(() => void this.store.carica(id));
      }
    });
    // L'avviso di inattività dice quante modifiche andrebbero perse (L27).
    effect(() => this.inattivita.modificheNonSalvate.set(this.store.modificheNonSalvate()));
    inject(DestroyRef).onDestroy(() => this.inattivita.modificheNonSalvate.set(0));
  }

  protected ricarica(): void {
    const id = this.parametri().get('rid');
    if (id !== null) {
      void this.store.carica(id);
    }
  }

  protected async salva(avanza: boolean): Promise<void> {
    const esito = await this.store.salva(avanza);
    switch (esito) {
      case 'salvato': {
        const reparto = this.store.reparto();
        if (avanza && reparto !== null) {
          await this.router.navigate(['/reparti', reparto.id, 'dipendenti']);
        } else {
          this.toast.successo(testi.configurazione.salvato);
        }
        break;
      }
      case 'invalido':
        // Dopo il rendering degli errori il focus va al primo campo da correggere.
        afterNextRender(
          () =>
            this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
          { injector: this.injector },
        );
        break;
      case 'annullato':
      case 'errore':
        break;
    }
  }

  haModificheNonSalvate(): boolean {
    return this.store.modificabile() && this.store.sporca();
  }

  confermaUscita(): Promise<boolean> {
    return this.dialoghi.conferma({
      titolo: testi.configurazione.uscita.titolo,
      messaggio: testi.configurazione.uscita.messaggio,
      etichettaConferma: testi.configurazione.uscita.esci,
      etichettaAnnulla: testi.configurazione.uscita.resta,
      pericolo: true,
    });
  }

  protected primaDiChiudere(evento: BeforeUnloadEvent): void {
    if (this.haModificheNonSalvate()) {
      evento.preventDefault();
    }
  }
}
