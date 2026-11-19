// Convalida del mese (D1, D2, D18, U5, UX §9.8): dialogo in due passi. 1) Riepilogo degli avvisi aperti, per tipo
// e in elenco; ogni voce porta alla cella chiudendo il dialogo. 2) Conferma esplicita: spiega che il mese diventa
// di sola lettura totale e si riapre solo a database; la casella «Ho capito» è obbligatoria. Con dati non validi
// (blocchi) la convalida non è possibile: il dialogo lo dice e non offre di proseguire.
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { DialogCornice } from '../../ui/dialog';
import { Icona } from '../../ui/icona';
import { idUnivoco } from '../../ui/id-univoco';
import type { RiferimentoCella, VoceAvviso } from './stato/griglia.store';

export interface DatiConvalida {
  /** «novembre 2026». */
  readonly mese: string;
  /** Tutte le voci del pannello Avvisi: blocchi, avvisi e note. */
  readonly voci: readonly VoceAvviso[];
}

export type EsitoConvalida =
  { readonly tipo: 'convalida' } | { readonly tipo: 'vai'; readonly cella: RiferimentoCella };

interface GruppoTipo {
  readonly chiave: string;
  readonly titolo: string;
  readonly voci: readonly VoceAvviso[];
}

type TitoliTipo = Readonly<Record<string, string>>;

@Component({
  selector: 'app-dialogo-convalida',
  imports: [DialogCornice, Button, Icona],
  template: `
    <app-dialog-cornice [titolo]="t.titolo(dati.mese)" (chiudi)="rif.close(undefined)">
      <p class="mb-3 text-nota text-testo-secondario">{{ t.passo(passo()) }}</p>
      @if (passo() === 1) {
        @if (blocchi().length > 0) {
          <p
            role="alert"
            class="mb-3 rounded-campo border border-blocco bg-blocco-sfondo p-2 text-blocco-testo"
          >
            {{ t.bloccoIntro }}
          </p>
        }
        @if (totale() === 0) {
          <p class="flex items-center gap-2" data-test="nessun-avviso">
            <app-icona nome="spunta" /> {{ t.nessunAvviso }}
          </p>
        } @else {
          <p class="mb-2">{{ t.avvisiIntro(avvisi().length) }}</p>
          <div class="max-h-72 overflow-y-auto pr-1">
            @for (g of gruppi(); track g.chiave) {
              <section class="mb-3" [attr.aria-label]="g.titolo">
                <h3 class="mb-1 text-tabella font-semibold">
                  {{ g.titolo }} ({{ g.voci.length }})
                </h3>
                <ul class="flex flex-col gap-1">
                  @for (v of g.voci; track v.chiave) {
                    <li>
                      @if (v.cella; as cella) {
                        <button
                          type="button"
                          class="w-full rounded-campo border border-bordo p-2 text-left hover:bg-sfondo-neutro"
                          [attr.aria-label]="t.vai(v.testo + ' · ' + v.dettaglio)"
                          (click)="rif.close({ tipo: 'vai', cella })"
                        >
                          <span class="block">{{ v.testo }}</span>
                          <span class="block text-nota text-testo-secondario">{{
                            v.dettaglio
                          }}</span>
                        </button>
                      } @else {
                        <div class="rounded-campo border border-bordo p-2">
                          <span class="block">{{ v.testo }}</span>
                          <span class="block text-nota text-testo-secondario">{{
                            v.dettaglio
                          }}</span>
                        </div>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        }
      } @else {
        <p>{{ t.conferma(dati.mese) }}</p>
        <label class="mt-4 flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            class="size-4"
            [id]="idCasella"
            [checked]="capito()"
            (change)="capito.set(spunta($event))"
          />
          {{ t.hoCapito }}
        </label>
      }
      <ng-container azioni>
        @if (passo() === 1) {
          <button appButton type="button" (click)="rif.close(undefined)">{{ t.annulla }}</button>
          <button
            appButton
            type="button"
            variante="primario"
            cdkFocusInitial
            [disabled]="blocchi().length > 0"
            (click)="passo.set(2)"
          >
            {{ t.continua }}
          </button>
        } @else {
          <button appButton type="button" (click)="passo.set(1)">{{ t.indietro }}</button>
          <button appButton type="button" (click)="rif.close(undefined)">{{ t.annulla }}</button>
          <button
            appButton
            type="button"
            variante="pericolo"
            [disabled]="!capito()"
            (click)="rif.close({ tipo: 'convalida' })"
          >
            {{ t.convalida }}
          </button>
        }
      </ng-container>
    </app-dialog-cornice>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoConvalida {
  protected readonly t = testi.griglia.convalidaDialogo;
  protected readonly dati = inject<DatiConvalida>(DIALOG_DATA);
  protected readonly rif = inject<DialogRef<EsitoConvalida | undefined>>(DialogRef);
  protected readonly idCasella = idUnivoco('ho-capito');
  protected readonly passo = signal<1 | 2>(1);
  protected readonly capito = signal(false);

  protected readonly blocchi = computed(() => this.dati.voci.filter((v) => v.livello === 'blocco'));
  protected readonly avvisi = computed(() => this.dati.voci.filter((v) => v.livello === 'avviso'));
  /** Blocchi e avvisi: le note non contano (UX §9.6). */
  protected readonly totale = computed(() => this.blocchi().length + this.avvisi().length);

  /** Blocchi in testa, poi gli avvisi per tipo: ogni tipo un titolo («Riposi sotto le 11 ore (2)»). */
  protected readonly gruppi = computed<readonly GruppoTipo[]>(() => {
    const titoli: TitoliTipo = this.t.tipi;
    const perChiave = new Map<string, VoceAvviso[]>();
    for (const voce of [...this.blocchi(), ...this.avvisi()]) {
      const chiave = voce.livello === 'blocco' ? 'datiNonValidi' : voce.codice;
      perChiave.set(chiave, [...(perChiave.get(chiave) ?? []), voce]);
    }
    return [...perChiave.entries()].map(([chiave, voci]) => ({
      chiave,
      titolo: titoli[chiave] ?? this.t.tipi.altro,
      voci,
    }));
  });

  protected spunta(evento: Event): boolean {
    return evento.target instanceof HTMLInputElement && evento.target.checked;
  }
}
