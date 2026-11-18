import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { testoErroreFunzione } from '../../core/errori';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { RepartiRepo, type RepartoSintesi } from '../../dati/reparti.repo';
import { nomeCompletoDi, UtentiRepo, type UtenteElenco } from '../../dati/utenti.repo';
import { FunzioniUtenti } from '../../funzioni/utenti';
import { testi } from '../../testi/it';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialoghi } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { Menu, type VoceMenu } from '../../ui/menu';
import { Table, TableScheletro } from '../../ui/table';
import { ToastService } from '../../ui/toast';
import {
  DialogoNuovoCoordinatore,
  type EsitoNuovoCoordinatore,
} from './dialogo-nuovo-coordinatore';
import { DialogoRiassegna, type DatiRiassegna, type EsitoRiassegna } from './dialogo-riassegna';

type Stato = 'caricamento' | 'pronto' | 'errore';

/**
 * Utenti (schermata 8, UX §7.11, solo ADMIN): coordinatori con i reparti assegnati, creazione, disattivazione
 * e riattivazione, riassegnazione dei reparti, reimpostazione della password.
 */
@Component({
  selector: 'app-utenti',
  imports: [Badge, Button, EmptyState, Icona, Menu, Table, TableScheletro],
  template: `
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-titolo-pagina">{{ testi.utenti.titolo }}</h1>
      <button appButton type="button" variante="primario" (click)="nuovoCoordinatore()">
        <app-icona nome="piu" /> {{ testi.utenti.nuovoCoordinatore }}
      </button>
    </div>

    @switch (stato()) {
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testi.utenti.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('caricamento') {
        <div [attr.aria-busy]="true">
          <app-table-scheletro [righe]="4" />
          <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
        </div>
      }
      @default {
        <section aria-labelledby="titolo-coordinatori" class="mb-8">
          <h2 id="titolo-coordinatori" class="mb-2 text-titolo-sezione">
            {{ testi.utenti.coordinatori }}
          </h2>
          @if (coordinatori().length === 0) {
            <app-empty-state [titolo]="testi.utenti.vuotoTitolo" icona="utenti">
              <button appButton type="button" variante="primario" (click)="nuovoCoordinatore()">
                {{ testi.utenti.nuovoCoordinatore }}
              </button>
            </app-empty-state>
          } @else {
            <app-table [etichetta]="testi.utenti.coordinatori">
              <thead>
                <tr>
                  <th scope="col">{{ testi.utenti.colonne.nome }}</th>
                  <th scope="col">{{ testi.utenti.colonne.email }}</th>
                  <th scope="col">{{ testi.utenti.colonne.stato }}</th>
                  <th scope="col">{{ testi.utenti.colonne.reparti }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ testi.utenti.colonne.azioni }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (c of coordinatori(); track c.uid) {
                  <tr>
                    <th scope="row" class="font-medium">{{ nomeCompleto(c) }}</th>
                    <td>{{ c.email }}</td>
                    <td>
                      <app-badge [variante]="c.attivo ? 'successo' : 'neutro'">
                        {{ c.attivo ? testi.utenti.attivo : testi.utenti.disattivato }}
                      </app-badge>
                    </td>
                    <td>{{ repartiDi(c.uid) }}</td>
                    <td class="text-right whitespace-nowrap">
                      @if (c.attivo) {
                        <button appButton type="button" class="mr-1" (click)="reimpostaPassword(c)">
                          {{ testi.utenti.reimpostaPassword }}
                        </button>
                      }
                      <app-menu
                        [etichetta]="testi.utenti.altreAzioni(nomeCompleto(c))"
                        [voci]="vociMenu(c)"
                        (scelta)="azioneMenu(c, $event)"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </app-table>
          }
        </section>

        <section aria-labelledby="titolo-reparti">
          <h2 id="titolo-reparti" class="mb-2 text-titolo-sezione">{{ testi.utenti.reparti }}</h2>
          @if (reparti().length === 0) {
            <app-empty-state [titolo]="testi.utenti.nessunRepartoCreato" icona="griglia" />
          } @else {
            <app-table [etichetta]="testi.utenti.reparti">
              <thead>
                <tr>
                  <th scope="col">{{ testi.utenti.colonne.reparto }}</th>
                  <th scope="col">{{ testi.utenti.colonne.coordinatore }}</th>
                  <th scope="col">
                    <span class="sr-only">{{ testi.utenti.colonne.azioni }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (r of reparti(); track r.id) {
                  <tr>
                    <th scope="row" class="font-medium">{{ r.nome }}</th>
                    <td>
                      {{ nomeCoordinatoreDi(r) }}
                      @if (coordinatoreDisattivato(r)) {
                        {{ testi.utenti.coordinatoreDisattivatoSuffisso }}
                      }
                    </td>
                    <td class="text-right whitespace-nowrap">
                      @if (coordinatoreDisattivato(r)) {
                        <span class="mr-2 inline-flex items-center gap-1 text-avviso-testo">
                          <app-icona nome="avviso" />
                          {{ testi.utenti.coordinatoreDisattivatoAvviso }}
                        </span>
                      }
                      <button appButton type="button" (click)="riassegna(r)">
                        {{ testi.utenti.riassegna }}
                        <span class="sr-only">{{ r.nome }}</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </app-table>
          }
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Utenti implements OnInit {
  protected readonly testi = testi;
  private readonly utentiRepo = inject(UtentiRepo);
  private readonly repartiRepo = inject(RepartiRepo);
  private readonly funzioni = inject(FunzioniUtenti);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);
  private readonly sessione = inject(Sessione);
  private readonly elencoReparti = inject(ElencoReparti);

  protected readonly stato = signal<Stato>('caricamento');
  private readonly utenti = signal<readonly UtenteElenco[]>([]);
  protected readonly reparti = signal<readonly RepartoSintesi[]>([]);
  protected readonly nomeCompleto = nomeCompletoDi;

  protected readonly coordinatori = computed(() =>
    this.utenti().filter((utente) => utente.ruolo === 'COORDINATORE'),
  );
  private readonly perUid = computed(() => new Map(this.utenti().map((u) => [u.uid, u])));

  ngOnInit(): void {
    void this.carica();
  }

  /** `silenziosa`: rilettura dopo un'azione, senza scheletro, così il focus resta sulla tabella. */
  protected async carica(silenziosa = false): Promise<void> {
    if (!silenziosa) {
      this.stato.set('caricamento');
    }
    try {
      const [utenti, reparti] = await Promise.all([
        this.utentiRepo.tutti(),
        this.repartiRepo.tutti(),
      ]);
      this.utenti.set(utenti);
      this.reparti.set(reparti);
      this.stato.set('pronto');
    } catch {
      this.stato.set('errore');
    }
  }

  protected vociMenu(coordinatore: UtenteElenco): readonly VoceMenu[] {
    return coordinatore.attivo
      ? [{ id: 'disattiva', etichetta: testi.utenti.disattiva }]
      : [{ id: 'riattiva', etichetta: testi.utenti.riattiva }];
  }

  protected azioneMenu(coordinatore: UtenteElenco, id: string): void {
    if (id === 'disattiva') {
      void this.disattiva(coordinatore);
    } else if (id === 'riattiva') {
      void this.riattiva(coordinatore);
    }
  }

  protected repartiDi(uid: string): string {
    const nomi = this.reparti()
      .filter((reparto) => reparto.coordinatoreUid === uid)
      .map((reparto) => reparto.nome);
    return nomi.length > 0 ? nomi.join(', ') : testi.utenti.nessunReparto;
  }

  protected nomeCoordinatoreDi(reparto: RepartoSintesi): string {
    const utente = this.perUid().get(reparto.coordinatoreUid);
    return utente ? nomeCompletoDi(utente) : testi.layout.coordinatoreSconosciuto;
  }

  protected coordinatoreDisattivato(reparto: RepartoSintesi): boolean {
    return this.perUid().get(reparto.coordinatoreUid)?.attivo === false;
  }

  protected async nuovoCoordinatore(): Promise<void> {
    const esito = await this.dialoghi.apri<undefined, EsitoNuovoCoordinatore>(
      DialogoNuovoCoordinatore,
    );
    if (esito === undefined) {
      return;
    }
    if (esito.emailInviata) {
      this.toast.successo(testi.utenti.nuovo.creato);
    } else {
      this.toast.errore(testi.utenti.nuovo.creatoSenzaEmail);
    }
    await this.carica(true);
  }

  protected async disattiva(coordinatore: UtenteElenco): Promise<void> {
    const nome = nomeCompletoDi(coordinatore);
    const confermato = await this.dialoghi.conferma({
      titolo: testi.utenti.conferma.disattivaTitolo,
      messaggio: testi.utenti.conferma.disattivaMessaggio(nome),
      etichettaConferma: testi.utenti.conferma.disattivaConferma,
      pericolo: true,
    });
    if (!confermato) {
      return;
    }
    await this.impostaStato(coordinatore, false);
  }

  protected async riattiva(coordinatore: UtenteElenco): Promise<void> {
    await this.impostaStato(coordinatore, true);
  }

  private async impostaStato(coordinatore: UtenteElenco, attivo: boolean): Promise<void> {
    const nome = nomeCompletoDi(coordinatore);
    try {
      await this.funzioni.impostaStatoUtente({ uid: coordinatore.uid, attivo });
      this.toast.successo(
        attivo ? testi.utenti.esiti.riattivato(nome) : testi.utenti.esiti.disattivato(nome),
      );
    } catch (errore) {
      this.toast.errore(testoErroreFunzione(errore));
    }
    await this.carica(true);
  }

  protected async riassegna(reparto: RepartoSintesi): Promise<void> {
    const dati: DatiRiassegna = {
      repartoId: reparto.id,
      repartoNome: reparto.nome,
      coordinatori: this.coordinatori().filter(
        (c) => c.attivo && c.uid !== reparto.coordinatoreUid,
      ),
    };
    const esito = await this.dialoghi.apri<DatiRiassegna, EsitoRiassegna>(DialogoRiassegna, dati);
    if (esito === undefined) {
      return;
    }
    this.toast.successo(testi.utenti.esiti.riassegnato(reparto.nome, esito.coordinatoreNome));
    await this.carica(true);
    void this.elencoReparti.carica(true);
  }

  protected async reimpostaPassword(coordinatore: UtenteElenco): Promise<void> {
    const esito = await this.sessione.inviaLinkReimpostazione(coordinatore.email);
    if (esito.ok) {
      this.toast.successo(testi.utenti.esiti.passwordInviata);
    } else {
      this.toast.errore(testi.utenti.esiti.passwordNonInviata);
    }
  }
}
