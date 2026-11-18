import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
} from '@angular/core';
import { testi } from '../../../testi/it';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Icona } from '../../../ui/icona';
import { Menu, type VoceMenu } from '../../../ui/menu';
import { Table } from '../../../ui/table';
import type { RigaAssenza } from './bozza';
import { ConfigurazioneStore } from './configurazione.store';
import { CLASSE_CAMPO, CLASSE_CAMPO_BORDO, CLASSE_CAMPO_ERRORE } from './stili';

/** Tipologie di assenza (UX §7.4): R e MA predefinite e fisse, le altre modificabili e disattivabili. */
@Component({
  selector: 'app-sezione-assenze',
  imports: [Badge, Button, Icona, Menu, Table],
  template: `
    <section aria-labelledby="titolo-sezione-assenze" class="mb-8">
      <h2 id="titolo-sezione-assenze" class="mb-2 text-titolo-sezione">
        {{ testi.configurazione.assenze.titolo }}
      </h2>
      <app-table [etichetta]="testi.configurazione.assenze.etichetta">
        <thead>
          <tr>
            <th scope="col">{{ col.codice }}</th>
            <th scope="col">{{ col.descrizione }}</th>
            <th scope="col">{{ col.effetto }}</th>
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
                      erroreCodice(riga) ? 'errore-codice-assenza-' + riga.chiave : null
                    "
                    [value]="riga.codice"
                    maxlength="2"
                    autocomplete="off"
                    (input)="store.impostaCodiceAssenza(riga.chiave, codice.value)"
                  />
                  @if (erroreCodice(riga); as testo) {
                    <p
                      [id]="'errore-codice-assenza-' + riga.chiave"
                      class="mt-1 w-56 text-nota text-blocco-testo"
                    >
                      {{ testo }}
                    </p>
                  }
                } @else {
                  <span class="font-semibold">{{ riga.codice }}</span>
                }
              </td>
              <td class="min-w-52 align-top">
                @if (store.modificabile() && !riga.predefinita) {
                  <input
                    #descrizione
                    [class]="classeCampo(erroreDescrizione(riga))"
                    [attr.aria-label]="testi.configurazione.riga.descrizioneDi(etichetta)"
                    [attr.aria-invalid]="erroreDescrizione(riga) ? 'true' : null"
                    [value]="riga.descrizione"
                    maxlength="40"
                    autocomplete="off"
                    (input)="store.impostaDescrizioneAssenza(riga.chiave, descrizione.value)"
                  />
                  @if (erroreDescrizione(riga); as testo) {
                    <p class="mt-1 text-nota text-blocco-testo">{{ testo }}</p>
                  }
                } @else {
                  {{ riga.descrizione }}
                }
              </td>
              <td class="min-w-60 align-top">
                @if (store.modificabile() && !riga.predefinita) {
                  <select
                    #effetto
                    [class]="classeCampo(null)"
                    [attr.aria-label]="testi.configurazione.riga.effettoDi(etichetta)"
                    (change)="cambiaEffetto(riga, effetto.value)"
                  >
                    <option value="neutra" [selected]="riga.effetto === 'neutra'">
                      {{ testi.configurazione.assenze.neutra }}
                    </option>
                    <option value="comeRiposo" [selected]="riga.effetto === 'comeRiposo'">
                      {{ testi.configurazione.assenze.comeRiposo }}
                    </option>
                  </select>
                } @else {
                  {{
                    riga.effetto === 'comeRiposo'
                      ? testi.configurazione.assenze.comeRiposo
                      : testi.configurazione.assenze.neutra
                  }}
                }
              </td>
              <td class="align-top whitespace-nowrap">
                @if (riga.predefinita) {
                  <app-badge variante="neutro">{{ testi.configurazione.predefinita }}</app-badge>
                } @else if (!riga.salvato) {
                  <app-badge variante="nota">{{ testi.configurazione.nuovo }}</app-badge>
                } @else if (riga.attivo) {
                  <app-badge variante="successo">{{ testi.configurazione.attivo }}</app-badge>
                } @else {
                  <app-badge variante="neutro">{{ testi.configurazione.disattivato }}</app-badge>
                }
              </td>
              @if (store.modificabile()) {
                <td class="align-top">
                  @if (!riga.predefinita) {
                    <app-menu
                      [etichetta]="testi.configurazione.riga.altreAzioni(etichetta)"
                      [voci]="voci(riga)"
                      (scelta)="scegli(riga, $event)"
                    />
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </app-table>
      @if (store.modificabile()) {
        <div class="mt-2">
          <button appButton type="button" (click)="aggiungi()">
            <app-icona nome="piu" /> {{ testi.configurazione.assenze.aggiungi }}
          </button>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SezioneAssenze {
  protected readonly testi = testi;
  protected readonly col = testi.configurazione.colonne;
  protected readonly store = inject(ConfigurazioneStore);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly righe = computed<readonly RigaAssenza[]>(
    () => this.store.bozza()?.assenze ?? [],
  );

  protected classeCampo(errore: string | null): string {
    return `${CLASSE_CAMPO} ${errore ? CLASSE_CAMPO_ERRORE : CLASSE_CAMPO_BORDO}`;
  }

  protected erroreCodice(riga: RigaAssenza): string | null {
    const errore = this.store.errori()?.assenze.get(riga.chiave)?.codice;
    return errore !== undefined && (this.store.tentato() || riga.codice !== '') ? errore : null;
  }

  protected erroreDescrizione(riga: RigaAssenza): string | null {
    const errore = this.store.errori()?.assenze.get(riga.chiave)?.descrizione;
    return errore !== undefined && this.store.tentato() ? errore : null;
  }

  protected cambiaEffetto(riga: RigaAssenza, valore: string): void {
    this.store.impostaEffettoAssenza(
      riga.chiave,
      valore === 'comeRiposo' ? 'comeRiposo' : 'neutra',
    );
  }

  protected voci(riga: RigaAssenza): readonly VoceMenu[] {
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

  protected scegli(riga: RigaAssenza, voce: string): void {
    if (voce === 'alterna') {
      this.store.alternaAttivoAssenza(riga.chiave);
    } else if (voce === 'rimuovi') {
      this.store.rimuoviAssenza(riga.chiave);
    }
  }

  protected aggiungi(): void {
    const chiave = this.store.aggiungiAssenza();
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
