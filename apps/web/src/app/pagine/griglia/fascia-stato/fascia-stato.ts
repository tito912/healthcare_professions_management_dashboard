// Fascia di stato del mese (U4, UX §9.7): dichiara sempre se il mese è in bozza (con o senza modifiche non
// salvate), convalidato o in sola consultazione. Testo, icona e colore, mai il solo colore.
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formattaDataDaMs, formattaOraDaMs } from '@turni/domain';
import { testi } from '../../../testi/it';
import { testiGriglia } from '../../../testi/it-griglia';
import { Icona, type NomeIcona } from '../../../ui/icona';
import { Spinner } from '../../../ui/spinner';

export type TipoStato =
  'bozzaModificata' | 'bozzaSalvata' | 'convalidato' | 'consultazione' | 'inCorso' | 'errore';

export interface StatoMese {
  readonly tipo: TipoStato;
  readonly testo: string;
  readonly destra: string | null;
}

export interface DatiStato {
  readonly eAdmin: boolean;
  readonly stato: 'bozza' | 'convalidato';
  readonly convalidatoIlMs: number | null;
  readonly convalidatoDaNome: string | null;
  readonly modifiche: number;
  readonly salvataggio: 'riposo' | 'inCorso' | 'errore';
  /** «HH:MM» dell'ultimo salvataggio di questa sessione. */
  readonly ultimoSalvataggio: string | null;
}

function convalidatoIl(dati: DatiStato): string | null {
  return dati.convalidatoIlMs === null
    ? null
    : `${formattaDataDaMs(dati.convalidatoIlMs)} alle ${formattaOraDaMs(dati.convalidatoIlMs)}`;
}

/** Il testo della fascia per il mese e le modifiche in corso (UX §9.7). */
export function testoStato(dati: DatiStato): StatoMese {
  const t = testiGriglia.fascia;
  if (dati.eAdmin) {
    const quando = convalidatoIl(dati);
    const stato =
      dati.stato === 'bozza'
        ? t.statoBozza
        : quando === null
          ? t.statoConvalidato
          : `${t.statoConvalidato} il ${quando}`;
    return { tipo: 'consultazione', testo: `${t.soloConsultazione} · ${stato}`, destra: null };
  }
  if (dati.stato === 'convalidato') {
    const quando = dati.convalidatoIlMs === null ? null : formattaDataDaMs(dati.convalidatoIlMs);
    return {
      tipo: 'convalidato',
      testo:
        quando === null || dati.convalidatoIlMs === null
          ? t.convalidatoSenzaData
          : t.convalidato(quando, formattaOraDaMs(dati.convalidatoIlMs), dati.convalidatoDaNome),
      destra: null,
    };
  }
  if (dati.salvataggio === 'inCorso') {
    return { tipo: 'inCorso', testo: t.salvataggioInCorso, destra: null };
  }
  if (dati.salvataggio === 'errore') {
    return { tipo: 'errore', testo: t.salvataggioNonRiuscito, destra: null };
  }
  if (dati.modifiche > 0) {
    return {
      tipo: 'bozzaModificata',
      testo: t.modifiche(dati.modifiche),
      destra: dati.ultimoSalvataggio === null ? null : t.ultimoSalvataggio(dati.ultimoSalvataggio),
    };
  }
  return {
    tipo: 'bozzaSalvata',
    testo: t.tuttoSalvato,
    destra: dati.ultimoSalvataggio === null ? null : t.salvatoAlle(dati.ultimoSalvataggio),
  };
}

const CLASSI: Record<TipoStato, string> = {
  bozzaModificata: 'border-l-4 border-l-[#D97706] bg-bozza-sfondo text-bozza',
  bozzaSalvata: 'border-l-4 border-l-successo bg-successo-sfondo text-successo',
  convalidato: 'border-l-4 border-l-testo-neutro bg-sfondo-neutro text-testo-neutro',
  consultazione: 'border-l-4 border-l-testo-neutro bg-sfondo-neutro text-testo-neutro',
  inCorso: 'border-l-4 border-l-primario bg-nota-sfondo text-nota',
  errore: 'border-l-4 border-l-blocco bg-blocco-sfondo text-blocco-testo',
};

const ICONE: Record<TipoStato, NomeIcona | null> = {
  bozzaModificata: 'avviso',
  bozzaSalvata: 'spunta',
  convalidato: 'lucchetto',
  consultazione: 'occhio',
  inCorso: null,
  errore: 'avviso',
};

@Component({
  selector: 'app-fascia-stato',
  imports: [Icona, Spinner],
  template: `
    @if (icona(); as nome) {
      <app-icona [nome]="nome" />
    } @else {
      <app-spinner [ritardo]="0" etichetta="" />
    }
    <span class="font-medium">{{ stato().testo }}</span>
    @if (pennello(); as p) {
      <span class="ml-4 rounded-campo bg-sfondo px-2 text-testo">{{
        testiGriglia.fascia.pennello(p)
      }}</span>
    }
    @if (stato().tipo === 'errore') {
      <button
        type="button"
        class="rounded-campo border border-current px-2 font-medium"
        (click)="riprova.emit()"
      >
        {{ testiGriglia.fascia.riprova }}
      </button>
    }
    <span class="ml-auto">{{ stato().destra }}</span>
  `,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': 'classi()',
    '[attr.aria-label]': 'testiGriglia.fascia.regione',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FasciaStato {
  protected readonly testi = testi;
  protected readonly testiGriglia = testiGriglia;
  readonly stato = input.required<StatoMese>();
  /** Il codice del pennello scelto, se c'è. */
  readonly pennello = input<string | null>(null);
  readonly riprova = output<void>();

  protected readonly classi = computed(
    () => `flex h-8 shrink-0 items-center gap-2 px-3 text-tabella ${CLASSI[this.stato().tipo]}`,
  );
  protected readonly icona = computed(() => ICONE[this.stato().tipo]);
}
