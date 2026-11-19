// Una riga della griglia: nome, celle dei giorni visibili e totali fissi a destra (UX §7.6). Legge dallo store i
// soli `computed` della propria riga: una modifica ridisegna questa riga e nessun'altra (PIANO 2.2 criterio 10).
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { ChiaveGiorno } from '@turni/domain';
import { testi } from '../../../testi/it';
import { Icona } from '../../../ui/icona';
import { Cella, type BordiSelezione, type ConfermaInserimento } from '../cella/cella';
import { GrigliaStore } from '../stato/griglia.store';

/** La conferma di un inserimento veloce in una cella della riga. */
export interface ConfermaDaRiga {
  readonly giorno: ChiaveGiorno;
  readonly conferma: ConfermaInserimento;
}

@Component({
  selector: 'app-riga',
  imports: [Cella, Icona],
  template: `
    @let d = dati();
    @let s = stato();
    <div
      role="rowheader"
      class="nome-riga sticky left-0 z-10 flex items-center gap-1 border-r border-b border-r-bordo border-b-[#E5E7EB] bg-sfondo pr-1 pl-2"
      [attr.data-nome]="d.id"
      [attr.title]="d.nomeCompleto"
    >
      <span
        class="w-2 shrink-0 text-center text-[10px] text-primario"
        [attr.aria-hidden]="d.modificata ? null : 'true'"
      >
        @if (d.modificata) {
          <span aria-hidden="true">●</span>
          <span class="sr-only">{{ testi.griglia.riga.modificheNonSalvate }}</span>
        }
      </span>
      <span class="min-w-0 flex-1 truncate">{{ d.nome }}</span>
      @if (festivo(); as f) {
        <span class="w-7 shrink-0 text-right text-nota font-semibold text-testo-secondario">
          <span aria-hidden="true">{{ f.testo }}</span>
          <span class="sr-only">{{ f.etichetta }}</span>
        </span>
      } @else {
        <span class="w-7 shrink-0"></span>
      }
    </div>
    @for (c of d.celle; track c.giorno; let i = $index) {
      <app-cella
        [modello]="c"
        [configurazione]="configurazione()"
        [dipendenteId]="d.id"
        [attiva]="s.giornoAttivo === c.giorno"
        [selezionata]="bordi(s.selezione, i)"
        [evidenziata]="bordiEvidenza(s.evidenza, i)"
        [soloLettura]="soloLettura()"
        [inserimento]="inserimentoDi(s, c.giorno)"
        [messaggio]="s.inserimento?.giorno === c.giorno ? messaggioInserimento() : null"
        (confermato)="confermato.emit({ giorno: c.giorno, conferma: $event })"
        (annullato)="annullato.emit()"
      />
    }
    <div
      role="gridcell"
      class="totale sticky z-10 flex items-center justify-end border-b border-b-[#E5E7EB] bg-sfondo px-1 text-tabella"
      style="right: 132px"
      [attr.aria-label]="testi.griglia.colonne.pianificateEsteso + ': ' + d.totali.pianificate"
    >
      {{ d.totali.pianificate }}
    </div>
    <div
      role="gridcell"
      class="totale sticky z-10 flex items-center justify-end border-b border-b-[#E5E7EB] bg-sfondo px-1 text-tabella"
      style="right: 88px"
      [attr.aria-label]="testi.griglia.colonne.dovuteEsteso + ': ' + d.totali.dovute"
    >
      {{ d.totali.dovute }}
    </div>
    <div
      role="gridcell"
      class="totale sticky z-10 flex items-center justify-end border-b border-b-[#E5E7EB] bg-sfondo px-1 text-tabella font-medium"
      [class.text-debito]="d.totali.differenzaNegativa"
      [class.text-credito]="!d.totali.differenzaNegativa"
      style="right: 44px"
      [attr.aria-label]="testi.griglia.colonne.differenzaEsteso + ': ' + d.totali.differenza"
    >
      {{ d.totali.differenza }}
    </div>
    <div
      role="gridcell"
      class="totale sticky right-0 z-10 flex items-center justify-end gap-0.5 border-b border-b-[#E5E7EB] bg-sfondo px-1 text-tabella"
      [class.text-avviso]="d.totali.reperibilitaOltre"
      [attr.aria-label]="testi.griglia.colonne.reperibilitaEsteso + ': ' + d.totali.reperibilita"
    >
      @if (d.totali.reperibilitaOltre) {
        <app-icona nome="avviso" />
      }
      {{ d.totali.reperibilita }}
    </div>
  `,
  host: {
    role: 'row',
    class: 'grid',
    '[style.grid-template-columns]': '"var(--colonne)"',
    '[style.height.px]': 'configurazione().altezzaRiga',
    '[attr.data-riga]': 'id()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Riga {
  protected readonly testi = testi;
  private readonly store = inject(GrigliaStore);

  readonly id = input.required<string>();
  readonly confermato = output<ConfermaDaRiga>();
  readonly annullato = output<void>();

  protected readonly configurazione = this.store.configurazioneVista;
  protected readonly messaggioInserimento = this.store.messaggioInserimento;
  protected readonly soloLettura = this.store.solaLettura;
  protected readonly dati = computed(() => this.store.derivatiDi(this.id()).dati());
  protected readonly stato = computed(() => this.store.derivatiDi(this.id()).stato());
  /**
   * Con la colonna di un festivo attiva, quante volte il dipendente ha lavorato quella festività negli ultimi 5
   * anni (U6). Cambia solo passando da una colonna festiva all'altra: muovere la cella attiva altrove non
   * ridisegna la riga.
   */
  protected readonly festivo = computed(
    () => {
      const conteggi = this.store.conteggiStorico();
      const festa = this.store.festivitaAttiva();
      if (conteggi === null || festa === null) {
        return null;
      }
      const n = conteggi.get(this.id()) ?? 0;
      return {
        testo: testi.griglia.storico.conteggio(n),
        etichetta: testi.griglia.storico.etichettaConteggio(festa.nome, n),
      };
    },
    { equal: (a, b) => a?.testo === b?.testo && a?.etichetta === b?.etichetta },
  );

  protected inserimentoDi(
    stato: { inserimento: { giorno: string; iniziale: string } | null },
    giorno: string,
  ): { iniziale: string } | null {
    // Lo stesso oggetto dello stato (non una copia): così l'input della cella non cambia a ogni controllo.
    return stato.inserimento?.giorno === giorno ? stato.inserimento : null;
  }

  /** La settimana evidenziata è un intervallo su questa sola riga: sempre sia la prima sia l'ultima. */
  protected bordiEvidenza(
    evidenza: { da: number; a: number } | null,
    indice: number,
  ): BordiSelezione | null {
    return this.bordi(
      evidenza === null ? null : { ...evidenza, primaRiga: true, ultimaRiga: true },
      indice,
    );
  }

  protected bordi(
    selezione: { da: number; a: number; primaRiga: boolean; ultimaRiga: boolean } | null,
    indice: number,
  ): BordiSelezione | null {
    if (selezione === null || indice < selezione.da || indice > selezione.a) {
      return null;
    }
    return {
      sopra: selezione.primaRiga,
      sotto: selezione.ultimaRiga,
      sinistra: indice === selezione.da,
      destra: indice === selezione.a,
    };
  }
}
