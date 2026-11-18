import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  ANNO_MASSIMO_FESTIVITA,
  ANNO_MINIMO_FESTIVITA,
  festivitaReparto,
  formattaData,
  MAX_FESTIVITA_LOCALI,
  nazionaliEscluseNellAnno,
  validaFestivitaLocale,
  ID_FESTIVITA_NAZIONALI,
  type Festivita,
  type IdFestivitaNazionale,
} from '@turni/domain';
import { testi } from '../../../testi/it';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { Icona } from '../../../ui/icona';
import { Input } from '../../../ui/input';
import { Select, type OpzioneSelect } from '../../../ui/select';
import { Table } from '../../../ui/table';
import { ConfigurazioneStore } from './configurazione.store';

interface FormFestivita {
  /** Id della locale che si modifica; null se se ne aggiunge una (anche partendo da una nazionale). */
  readonly id: string | null;
  /** Nazionale da escludere quando si applica (modifica di una nazionale, L36). */
  readonly daNazionale: IdFestivitaNazionale | null;
}

function nazionaleDa(id: string): IdFestivitaNazionale | undefined {
  return ID_FESTIVITA_NAZIONALI.find((n) => n === id);
}

/** Festività dell'anno scelto (D14, UX §7.4): nazionali calcolate dal dominio più le locali del reparto. */
@Component({
  selector: 'app-sezione-festivita',
  imports: [Badge, Button, Icona, Input, Select, Table],
  template: `
    <section aria-labelledby="titolo-sezione-festivita" class="mb-8">
      <div class="mb-2 flex items-center gap-3">
        <h2 id="titolo-sezione-festivita" class="text-titolo-sezione">
          {{ testi.configurazione.festivita.titolo }}
        </h2>
        <div class="flex items-center gap-1" role="group" [attr.aria-label]="f.anno">
          <button
            appButton
            type="button"
            variante="testo"
            [attr.aria-label]="f.annoPrecedente"
            [disabled]="store.anno() <= annoMinimo"
            (click)="cambiaAnno(-1)"
          >
            ◀
          </button>
          <span class="min-w-12 text-center font-semibold" data-anno aria-live="polite">{{
            store.anno()
          }}</span>
          <button
            appButton
            type="button"
            variante="testo"
            [attr.aria-label]="f.annoSuccessivo"
            [disabled]="store.anno() >= annoMassimo"
            (click)="cambiaAnno(1)"
          >
            ▶
          </button>
        </div>
      </div>
      <app-table [etichetta]="f.etichetta(store.anno())">
        <thead>
          <tr>
            <th scope="col">{{ col.data }}</th>
            <th scope="col">{{ col.nome }}</th>
            <th scope="col">{{ col.tipo }}</th>
            @if (store.modificabile()) {
              <th scope="col">
                <span class="sr-only">{{ col.azioni }}</span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (festa of elenco(); track festa.id) {
            <tr [attr.data-festivita]="festa.id">
              <td class="whitespace-nowrap">{{ data(festa) }}</td>
              <td>{{ festa.nome }}</td>
              <td>
                <app-badge [variante]="festa.tipo === 'nazionale' ? 'neutro' : 'nota'">{{
                  festa.tipo === 'nazionale' ? f.nazionale : f.locale
                }}</app-badge>
              </td>
              @if (store.modificabile()) {
                <td class="whitespace-nowrap">
                  @if (festa.tipo === 'nazionale') {
                    <button
                      appButton
                      type="button"
                      variante="testo"
                      [attr.aria-label]="f.rimuoviDi(festa.nome)"
                      (click)="rimuoviNazionale(festa)"
                    >
                      {{ f.rimuovi }}
                    </button>
                    <button
                      appButton
                      type="button"
                      variante="testo"
                      [attr.aria-label]="f.modificaDi(festa.nome)"
                      (click)="modificaNazionale(festa)"
                    >
                      {{ f.modifica }}
                    </button>
                  } @else {
                    <button
                      appButton
                      type="button"
                      variante="testo"
                      [attr.aria-label]="f.modificaDi(festa.nome)"
                      (click)="modificaLocale(festa)"
                    >
                      {{ f.modifica }}
                    </button>
                    <button
                      appButton
                      type="button"
                      variante="testo"
                      [attr.aria-label]="f.eliminaDi(festa.nome)"
                      (click)="store.eliminaLocale(festa.id)"
                    >
                      {{ f.elimina }}
                    </button>
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </app-table>

      @if (store.modificabile()) {
        @if (form(); as modulo) {
          <form
            class="mt-3 max-w-2xl rounded-pannello border border-bordo bg-sfondo p-4"
            novalidate
            [attr.aria-label]="modulo.id === null ? f.form.titoloNuova : f.form.titoloModifica"
            (submit)="applica($event)"
          >
            <h3 class="mb-3 font-semibold">
              {{ modulo.id === null ? f.form.titoloNuova : f.form.titoloModifica }}
            </h3>
            <div class="grid grid-cols-[1fr_6rem_10rem] gap-3">
              <app-input
                [etichetta]="f.form.nome"
                [obbligatorio]="true"
                [lunghezzaMassima]="60"
                [(valore)]="nome"
                [errore]="erroreNome()"
              />
              <app-input
                [etichetta]="f.form.giorno"
                [obbligatorio]="true"
                [lunghezzaMassima]="2"
                [(valore)]="giorno"
                [errore]="erroreGiorno()"
              />
              <app-select [etichetta]="f.form.mese" [opzioni]="mesi" [(valore)]="mese" />
            </div>
            <div class="mt-3 flex gap-2">
              <button appButton type="button" (click)="annulla()">{{ f.form.annulla }}</button>
              <button appButton type="submit" variante="primario">
                {{
                  modulo.id === null && modulo.daNazionale === null
                    ? f.form.aggiungi
                    : f.form.applica
                }}
              </button>
            </div>
          </form>
        } @else {
          <div class="mt-2">
            <button appButton type="button" [disabled]="troppeLocali()" (click)="apriNuova()">
              <app-icona nome="piu" /> {{ f.aggiungiLocale }}
            </button>
            @if (troppeLocali()) {
              <p class="mt-1 text-nota text-testo-secondario">{{ f.form.troppeLocali }}</p>
            }
          </div>
        }
      }

      <div class="mt-3" data-festivita-rimosse>
        <p class="font-medium">{{ f.rimosse }}</p>
        @if (rimosse().length === 0) {
          <p class="text-testo-secondario">{{ f.nessunaRimossa }}</p>
        } @else {
          <ul class="mt-1 flex flex-wrap gap-2">
            @for (festa of rimosse(); track festa.id) {
              <li class="flex items-center gap-1 rounded-campo border border-bordo bg-sfondo px-2">
                <span>{{ festa.nome }}</span>
                @if (store.modificabile()) {
                  <button
                    appButton
                    type="button"
                    variante="testo"
                    [attr.aria-label]="f.ripristinaDi(festa.nome)"
                    (click)="ripristina(festa)"
                  >
                    {{ f.ripristina }}
                  </button>
                }
              </li>
            }
          </ul>
        }
      </div>
      <p class="mt-2 text-nota text-testo-secondario">{{ f.nota }}</p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SezioneFestivita {
  protected readonly testi = testi;
  protected readonly f = testi.configurazione.festivita;
  protected readonly col = testi.configurazione.colonne;
  protected readonly store = inject(ConfigurazioneStore);
  protected readonly annoMinimo = ANNO_MINIMO_FESTIVITA;
  protected readonly annoMassimo = ANNO_MASSIMO_FESTIVITA;
  protected readonly mesi: readonly OpzioneSelect[] = testi.mesi.map((etichetta, indice) => ({
    valore: String(indice + 1),
    etichetta,
  }));

  protected readonly form = signal<FormFestivita | null>(null);
  protected readonly nome = signal('');
  protected readonly giorno = signal('');
  protected readonly mese = signal('1');
  protected readonly erroreNome = signal<string | null>(null);
  protected readonly erroreGiorno = signal<string | null>(null);

  private readonly configurazione = computed(() => this.store.bozza()?.festivita ?? null);

  protected readonly elenco = computed<readonly Festivita[]>(() => {
    const configurazione = this.configurazione();
    return configurazione === null ? [] : festivitaReparto(this.store.anno(), configurazione);
  });

  protected readonly rimosse = computed<readonly Festivita[]>(() => {
    const configurazione = this.configurazione();
    return configurazione === null
      ? []
      : nazionaliEscluseNellAnno(this.store.anno(), configurazione);
  });

  protected readonly troppeLocali = computed(
    () => (this.configurazione()?.locali.length ?? 0) >= MAX_FESTIVITA_LOCALI,
  );

  protected data(festa: Festivita): string {
    return formattaData(festa.data);
  }

  protected cambiaAnno(passo: number): void {
    this.store.anno.update((anno) =>
      Math.min(ANNO_MASSIMO_FESTIVITA, Math.max(ANNO_MINIMO_FESTIVITA, anno + passo)),
    );
  }

  protected rimuoviNazionale(festa: Festivita): void {
    const id = nazionaleDa(festa.id);
    if (id !== undefined) {
      this.store.escludiNazionale(id);
    }
  }

  protected ripristina(festa: Festivita): void {
    const id = nazionaleDa(festa.id);
    if (id !== undefined) {
      this.store.ripristinaNazionale(id);
    }
  }

  protected apriNuova(): void {
    this.apri({ id: null, daNazionale: null }, '', '', '1');
  }

  /** «Modifica» su una nazionale = esclusione più una locale precompilata (L36). */
  protected modificaNazionale(festa: Festivita): void {
    const [, mese = '1', giorno = ''] = festa.data.split('-');
    this.apri(
      { id: null, daNazionale: nazionaleDa(festa.id) ?? null },
      festa.nome,
      String(Number(giorno)),
      String(Number(mese)),
    );
  }

  protected modificaLocale(festa: Festivita): void {
    const locale = this.configurazione()?.locali.find((l) => l.id === festa.id);
    if (locale !== undefined) {
      this.apri(
        { id: locale.id, daNazionale: null },
        locale.nome,
        String(locale.giorno),
        String(locale.mese),
      );
    }
  }

  private apri(modulo: FormFestivita, nome: string, giorno: string, mese: string): void {
    this.nome.set(nome);
    this.giorno.set(giorno);
    this.mese.set(mese);
    this.erroreNome.set(null);
    this.erroreGiorno.set(null);
    this.form.set(modulo);
  }

  protected annulla(): void {
    this.form.set(null);
  }

  protected applica(evento: Event): void {
    evento.preventDefault();
    const modulo = this.form();
    if (modulo === null) {
      return;
    }
    const giorno = this.giorno().trim() === '' ? Number.NaN : Number(this.giorno());
    const mese = Number(this.mese());
    const motivo = validaFestivitaLocale({ id: 'loc-prova', nome: this.nome(), giorno, mese });
    this.erroreNome.set(
      motivo === 'nomeVuoto'
        ? this.f.form.nomeVuoto
        : motivo === 'nomeTroppoLungo'
          ? this.f.form.nomeLungo
          : null,
    );
    this.erroreGiorno.set(
      motivo === 'giornoNonValido'
        ? this.f.form.giornoNonValido
        : motivo === 'dataInesistente'
          ? this.f.form.dataInesistente
          : null,
    );
    if (motivo !== null) {
      return;
    }
    if (modulo.id !== null) {
      this.store.modificaLocale(modulo.id, this.nome(), giorno, mese);
    } else {
      if (!this.store.aggiungiLocale(this.nome(), giorno, mese)) {
        this.erroreNome.set(this.f.form.troppeLocali);
        return;
      }
      if (modulo.daNazionale !== null) {
        this.store.escludiNazionale(modulo.daNazionale);
      }
    }
    this.form.set(null);
  }
}
