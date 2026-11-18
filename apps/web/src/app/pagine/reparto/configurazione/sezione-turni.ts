import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
} from '@angular/core';
import { coloreTurno, formattaDurata, PALETTE_TURNI } from '@turni/domain';
import { testi } from '../../../testi/it';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { EmptyState } from '../../../ui/empty-state';
import { Icona } from '../../../ui/icona';
import { Menu, type VoceMenu } from '../../../ui/menu';
import { Table } from '../../../ui/table';
import { calcoliRiga, type RigaTurno } from './bozza';
import { ConfigurazioneStore, type CampoRigaTurno, type TipoRiga } from './configurazione.store';
import { CLASSE_CAMPO, CLASSE_CAMPO_BORDO, CLASSE_CAMPO_ERRORE } from './stili';

/** Tabella dei turni (con colore e pausa) o delle fasce di reperibilità (UX §7.4). */
@Component({
  selector: 'app-sezione-turni',
  imports: [Badge, Button, EmptyState, Icona, Menu, Table],
  template: `
    <section [attr.aria-labelledby]="idTitolo()" class="mb-8">
      <h2 [id]="idTitolo()" class="mb-2 text-titolo-sezione">{{ t().titolo }}</h2>
      @if (righe().length === 0) {
        <app-empty-state [titolo]="t().vuoto" icona="info" />
      } @else {
        <app-table [etichetta]="t().etichetta">
          <thead>
            <tr>
              <th scope="col">{{ col.codice }}</th>
              <th scope="col">{{ col.nome }}</th>
              @if (eTurno()) {
                <th scope="col">{{ col.colore }}</th>
              }
              <th scope="col">{{ col.inizio }}</th>
              <th scope="col">{{ col.fine }}</th>
              @if (eTurno()) {
                <th scope="col">{{ col.pausa }}</th>
              }
              <th scope="col">{{ col.durata }}</th>
              @if (eTurno()) {
                <th scope="col">{{ col.notturno }}</th>
              }
              <th scope="col">{{ col.stato }}</th>
              @if (store.modificabile()) {
                <th scope="col">
                  <span class="sr-only">{{ col.azioni }}</span>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (riga of righe(); track riga.chiave) {
              @let calcoli = calcoliDi(riga);
              @let etichetta = riga.codice || testi.configurazione.riga.nuovaRiga;
              <tr [attr.data-codice]="riga.codice">
                <td class="min-w-24 align-top">
                  @if (store.modificabile() && !riga.salvato) {
                    <input
                      #codice
                      [class]="classeCampo(erroreCodice(riga))"
                      [attr.data-campo-codice]="riga.chiave"
                      [attr.aria-label]="testi.configurazione.riga.codiceDi(etichetta)"
                      [attr.aria-invalid]="erroreCodice(riga) ? 'true' : null"
                      [attr.aria-describedby]="
                        erroreCodice(riga) ? 'errore-codice-' + riga.chiave : null
                      "
                      [value]="riga.codice"
                      maxlength="2"
                      autocomplete="off"
                      (input)="imposta(riga, 'codice', codice.value)"
                    />
                    @if (erroreCodice(riga); as testo) {
                      <p
                        [id]="'errore-codice-' + riga.chiave"
                        class="mt-1 w-56 text-nota text-blocco-testo"
                      >
                        {{ testo }}
                      </p>
                    }
                  } @else {
                    <span class="font-semibold">{{ riga.codice }}</span>
                  }
                </td>
                <td class="min-w-44 align-top">
                  @if (store.modificabile()) {
                    <input
                      #nome
                      [class]="classeCampo(erroreCampo(riga, 'nome'))"
                      [attr.aria-label]="testi.configurazione.riga.nomeDi(etichetta)"
                      [attr.aria-invalid]="erroreCampo(riga, 'nome') ? 'true' : null"
                      [value]="riga.nome"
                      maxlength="40"
                      autocomplete="off"
                      (input)="imposta(riga, 'nome', nome.value)"
                    />
                    @if (erroreCampo(riga, 'nome'); as testo) {
                      <p class="mt-1 text-nota text-blocco-testo">{{ testo }}</p>
                    }
                  } @else {
                    {{ riga.nome }}
                  }
                </td>
                @if (eTurno()) {
                  <td class="min-w-36 align-top">
                    @if (store.modificabile()) {
                      <div class="flex items-center gap-1">
                        <span
                          class="size-5 shrink-0 rounded-campo border"
                          aria-hidden="true"
                          [style.background-color]="sfondo(riga.colore)"
                          [style.border-color]="bordo(riga.colore)"
                        ></span>
                        <select
                          #colore
                          [class]="classeCampo(erroreCampo(riga, 'colore'))"
                          [attr.aria-label]="testi.configurazione.riga.coloreDi(etichetta)"
                          [attr.aria-invalid]="erroreCampo(riga, 'colore') ? 'true' : null"
                          (change)="imposta(riga, 'colore', colore.value)"
                        >
                          @if (riga.colore === '') {
                            <option value="" selected></option>
                          }
                          @for (c of palette; track c.id) {
                            <option [value]="c.id" [selected]="c.id === riga.colore">
                              {{ c.nome }}
                            </option>
                          }
                        </select>
                      </div>
                      @if (erroreCampo(riga, 'colore'); as testo) {
                        <p class="mt-1 text-nota text-blocco-testo">{{ testo }}</p>
                      }
                    } @else {
                      <span class="inline-flex items-center gap-2">
                        <span
                          class="size-5 rounded-campo border"
                          aria-hidden="true"
                          [style.background-color]="sfondo(riga.colore)"
                          [style.border-color]="bordo(riga.colore)"
                        ></span>
                        {{ nomeColore(riga.colore) }}
                      </span>
                    }
                  </td>
                }
                <td class="min-w-28 align-top">
                  @if (store.modificabile()) {
                    <input
                      #inizio
                      type="time"
                      [class]="classeCampo(erroreCampo(riga, 'inizio'))"
                      [attr.aria-label]="testi.configurazione.riga.inizioDi(etichetta)"
                      [attr.aria-invalid]="erroreCampo(riga, 'inizio') ? 'true' : null"
                      [value]="riga.inizio"
                      (input)="imposta(riga, 'inizio', inizio.value)"
                    />
                    @if (erroreCampo(riga, 'inizio'); as testo) {
                      <p class="mt-1 w-40 text-nota text-blocco-testo">{{ testo }}</p>
                    }
                  } @else {
                    {{ riga.inizio }}
                  }
                </td>
                <td class="min-w-28 align-top">
                  @if (store.modificabile()) {
                    <input
                      #fine
                      type="time"
                      [class]="classeCampo(erroreCampo(riga, 'fine'))"
                      [attr.aria-label]="testi.configurazione.riga.fineDi(etichetta)"
                      [attr.aria-invalid]="erroreCampo(riga, 'fine') ? 'true' : null"
                      [value]="riga.fine"
                      (input)="imposta(riga, 'fine', fine.value)"
                    />
                    @if (erroreCampo(riga, 'fine'); as testo) {
                      <p class="mt-1 w-40 text-nota text-blocco-testo">{{ testo }}</p>
                    }
                  } @else {
                    {{ riga.fine }}
                  }
                </td>
                @if (eTurno()) {
                  <td class="min-w-20 align-top">
                    @if (store.modificabile()) {
                      <input
                        #pausa
                        inputmode="numeric"
                        [class]="classeCampo(erroreCampo(riga, 'pausa'))"
                        [attr.aria-label]="testi.configurazione.riga.pausaDi(etichetta)"
                        [attr.aria-invalid]="erroreCampo(riga, 'pausa') ? 'true' : null"
                        [value]="riga.pausa"
                        (input)="imposta(riga, 'pausa', pausa.value)"
                      />
                      @if (erroreCampo(riga, 'pausa'); as testo) {
                        <p class="mt-1 w-48 text-nota text-blocco-testo">{{ testo }}</p>
                      }
                    } @else {
                      {{ riga.pausa }}′
                    }
                  </td>
                }
                <td class="align-top whitespace-nowrap" data-calcolo="durata">
                  {{ calcoli ? durata(calcoli.durataMinuti) : testi.configurazione.nessunDato }}
                </td>
                @if (eTurno()) {
                  <td class="align-top" data-calcolo="notturno">
                    {{
                      calcoli
                        ? calcoli.notturno
                          ? testi.configurazione.si
                          : testi.configurazione.no
                        : testi.configurazione.nessunDato
                    }}
                  </td>
                }
                <td class="align-top whitespace-nowrap">
                  @if (!riga.salvato) {
                    <app-badge variante="nota">{{ testi.configurazione.nuovo }}</app-badge>
                  } @else if (riga.attivo) {
                    <app-badge variante="successo">{{ testi.configurazione.attivo }}</app-badge>
                  } @else {
                    <app-badge variante="neutro">{{ testi.configurazione.disattivato }}</app-badge>
                  }
                </td>
                @if (store.modificabile()) {
                  <td class="align-top">
                    <app-menu
                      [etichetta]="testi.configurazione.riga.altreAzioni(etichetta)"
                      [voci]="voci(riga)"
                      (scelta)="scegli(riga, $event)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </app-table>
      }
      @if (store.modificabile()) {
        <div class="mt-2">
          <button appButton type="button" (click)="aggiungi()">
            <app-icona nome="piu" /> {{ t().aggiungi }}
          </button>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SezioneTurni {
  protected readonly testi = testi;
  protected readonly col = testi.configurazione.colonne;
  protected readonly palette = PALETTE_TURNI;
  protected readonly store = inject(ConfigurazioneStore);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tipo = input.required<TipoRiga>();

  protected readonly eTurno = computed(() => this.tipo() === 'turno');
  protected readonly t = computed(() =>
    this.tipo() === 'turno' ? testi.configurazione.turni : testi.configurazione.fasce,
  );
  protected readonly idTitolo = computed(() => `titolo-sezione-${this.tipo()}`);
  protected readonly righe = computed<readonly RigaTurno[]>(() => {
    const bozza = this.store.bozza();
    if (bozza === null) {
      return [];
    }
    return this.tipo() === 'turno' ? bozza.turni : bozza.fasce;
  });

  protected calcoliDi(riga: RigaTurno): ReturnType<typeof calcoliRiga> {
    return calcoliRiga(riga);
  }

  protected durata(minuti: number): string {
    return formattaDurata(minuti);
  }

  protected sfondo(colore: string): string {
    return coloreTurno(colore)?.sfondo ?? 'transparent';
  }

  protected bordo(colore: string): string {
    return coloreTurno(colore)?.bordo ?? 'transparent';
  }

  protected nomeColore(colore: string): string {
    return coloreTurno(colore)?.nome ?? testi.configurazione.nessunDato;
  }

  protected classeCampo(errore: string | null): string {
    return `${CLASSE_CAMPO} ${errore ? CLASSE_CAMPO_ERRORE : CLASSE_CAMPO_BORDO}`;
  }

  private errori(riga: RigaTurno): Record<string, string | undefined> {
    const errori = this.store.errori();
    const mappa = this.tipo() === 'turno' ? errori?.turni : errori?.fasce;
    return { ...mappa?.get(riga.chiave) };
  }

  /** Il codice si valida mentre si digita (D9); gli altri campi dopo il primo tentativo di salvataggio. */
  protected erroreCodice(riga: RigaTurno): string | null {
    const errore = this.errori(riga)['codice'];
    return errore !== undefined && (this.store.tentato() || riga.codice !== '') ? errore : null;
  }

  protected erroreCampo(riga: RigaTurno, campo: Exclude<CampoRigaTurno, 'codice'>): string | null {
    const errore = this.errori(riga)[campo];
    return errore !== undefined && this.store.tentato() ? errore : null;
  }

  protected imposta(riga: RigaTurno, campo: CampoRigaTurno, valore: string): void {
    this.store.impostaCampo(this.tipo(), riga.chiave, campo, valore);
  }

  protected voci(riga: RigaTurno): readonly VoceMenu[] {
    if (!riga.salvato) {
      return [{ id: 'rimuovi', etichetta: testi.configurazione.riga.rimuovi }];
    }
    const voci: VoceMenu[] = [
      {
        id: 'alterna',
        etichetta: riga.attivo
          ? testi.configurazione.riga.disattiva
          : testi.configurazione.riga.riattiva,
      },
    ];
    if (this.store.puoEliminare()) {
      voci.push({ id: 'rimuovi', etichetta: testi.configurazione.riga.elimina });
    }
    return voci;
  }

  protected scegli(riga: RigaTurno, voce: string): void {
    if (voce === 'alterna') {
      this.store.alternaAttivo(this.tipo(), riga.chiave);
    } else if (voce === 'rimuovi') {
      this.store.rimuoviRiga(this.tipo(), riga.chiave);
    }
  }

  protected aggiungi(): void {
    const chiave = this.store.aggiungiRiga(this.tipo());
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLInputElement>(`[data-campo-codice="${chiave}"]`)
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
