// Barra del pennello (U3, UX §9.3): un chip per ogni turno attivo (col suo colore), tipologia di assenza e fascia
// di reperibilità, più la gomma. Un valore scelto si applica con clic o trascinamento sulle celle; `Esc` lo depone.
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { coloreTurno } from '@turni/domain';
import { testi } from '../../../testi/it';
import { Icona } from '../../../ui/icona';
import { COLORI } from '../../../ui/token';
import type { AssenzaSalvata } from '../../../dati/assenze.repo';
import type { TurnoSalvato } from '../../../dati/turni.repo';
import type { Pennello } from '../stato/griglia.store';

interface VoceChip {
  readonly chiave: string;
  readonly codice: string;
  readonly etichetta: string;
  readonly sfondo: string;
  readonly testo: string;
  readonly bordo: string;
  readonly tratteggiato: boolean;
  readonly pennello: Pennello;
}

@Component({
  selector: 'app-barra-pennello',
  imports: [Icona],
  template: `
    <span class="shrink-0 text-tabella font-semibold">{{ testi.griglia.pennello.titolo }}:</span>
    <button
      type="button"
      class="shrink-0 rounded-campo p-1 hover:bg-sfondo-neutro"
      tabindex="-1"
      aria-hidden="true"
      (click)="scorri(-1)"
    >
      <app-icona nome="frecciaSinistra" />
    </button>
    <div
      #striscia
      class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth py-1"
      role="toolbar"
      [attr.aria-label]="testi.griglia.pennello.titolo"
    >
      @for (voce of voci(); track voce.chiave) {
        <button
          type="button"
          class="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-campo border px-1.5 text-nota font-semibold"
          [class.border-dashed]="voce.tratteggiato"
          [class.ring-2]="premuto(voce)"
          [class.ring-focus]="premuto(voce)"
          [style.background]="voce.sfondo"
          [style.color]="voce.testo"
          [style.border-color]="voce.bordo"
          [attr.aria-pressed]="premuto(voce)"
          [attr.title]="voce.etichetta"
          [attr.aria-label]="voce.etichetta"
          (click)="scegli.emit(premuto(voce) ? null : voce.pennello)"
        >
          {{ voce.codice }}
        </button>
      }
      <button
        type="button"
        class="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-campo border border-bordo bg-sfondo px-2 text-nota font-semibold"
        [class.ring-2]="gommaPremuta()"
        [class.ring-focus]="gommaPremuta()"
        [attr.aria-pressed]="gommaPremuta()"
        [attr.title]="testi.griglia.pennello.gommaTitolo"
        (click)="scegli.emit(gommaPremuta() ? null : { tipo: 'gomma' })"
      >
        ⌫ {{ testi.griglia.pennello.gomma }}
      </button>
    </div>
    <button
      type="button"
      class="shrink-0 rounded-campo p-1 hover:bg-sfondo-neutro"
      tabindex="-1"
      aria-hidden="true"
      (click)="scorri(1)"
    >
      <app-icona nome="frecciaDestra" />
    </button>
    <span class="shrink-0 pl-2 text-tabella text-testo-secondario" aria-live="polite">{{
      testi.griglia.pennello.selezione(celleSelezionate())
    }}</span>
  `,
  host: { class: 'flex h-10 shrink-0 items-center gap-1 px-2' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraPennello {
  protected readonly testi = testi;
  readonly turni = input.required<readonly TurnoSalvato[]>();
  readonly assenze = input.required<readonly AssenzaSalvata[]>();
  readonly pennello = input<Pennello | null>(null);
  readonly celleSelezionate = input(0);
  readonly scegli = output<Pennello | null>();

  private readonly striscia = viewChild<ElementRef<HTMLElement>>('striscia');

  protected readonly voci = computed<readonly VoceChip[]>(() => {
    const voci: VoceChip[] = [];
    const attivi = this.turni().filter((t) => t.attivo);
    for (const t of attivi.filter((x) => x.tipo === 'turno')) {
      const stile = t.colore === null ? undefined : coloreTurno(t.colore);
      voci.push({
        chiave: `t-${t.codice}`,
        codice: t.codice,
        etichetta: `${t.codice} ${t.nome} ${t.inizio}–${t.fine}`,
        sfondo: stile?.sfondo ?? COLORI.sfondoNeutro,
        testo: stile?.testo ?? COLORI.testoNeutro,
        bordo: stile?.bordo ?? COLORI.bordo,
        tratteggiato: stile === undefined,
        pennello: { tipo: 'codice', codice: t.codice },
      });
    }
    for (const a of this.assenze().filter((x) => x.attivo)) {
      voci.push({
        chiave: `a-${a.codice}`,
        codice: a.codice,
        etichetta: `${a.codice} ${a.descrizione}`,
        sfondo: COLORI.sfondoNeutro,
        testo: a.effetto === 'comeRiposo' ? COLORI.testoSecondario : COLORI.testoNeutro,
        bordo: a.effetto === 'comeRiposo' ? COLORI.sfondoNeutro : COLORI.bordoNeutro,
        tratteggiato: false,
        pennello: { tipo: 'codice', codice: a.codice },
      });
    }
    for (const f of attivi.filter((x) => x.tipo === 'reperibilita')) {
      voci.push({
        chiave: `r-${f.codice}`,
        codice: f.codice,
        etichetta: `${f.codice} ${f.nome} ${f.inizio}–${f.fine}`,
        sfondo: COLORI.sfondo,
        testo: COLORI.testo,
        bordo: COLORI.testoNeutro,
        tratteggiato: true,
        pennello: { tipo: 'codice', codice: f.codice },
      });
    }
    return voci;
  });

  protected premuto(voce: VoceChip): boolean {
    const p = this.pennello();
    return voce.pennello.tipo === 'codice' && p?.tipo === 'codice' && p.codice === voce.codice;
  }

  protected gommaPremuta(): boolean {
    return this.pennello()?.tipo === 'gomma';
  }

  protected scorri(direzione: 1 | -1): void {
    this.striscia()?.nativeElement.scrollBy({ left: direzione * 200 });
  }
}
