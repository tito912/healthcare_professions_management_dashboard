// Menu della cella (U3, UX §9.5): turni ammessi per il dipendente, assenze, fasce di reperibilità, voci «In questa
// cella» e «Svuota». Si apre ancorato alla cella (CDK Overlay) con doppio clic, Invio, F2, Alt+↓, tasto menu,
// Maiusc+F10 o clic destro. Digitando si filtra per codice o nome; frecce per muoversi, Invio per scegliere,
// Esc per chiudere: il focus torna alla cella.
import { A11yModule } from '@angular/cdk/a11y';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { coloreTurno, type CellaDoc, type IdColoreTurno, type OpzioniCella } from '@turni/domain';
import { testi } from '../../../testi/it';
import { COLORI } from '../../../ui/token';
import type { VoceScelta } from '../stato/griglia.store';

export interface DatiMenu {
  /** «Rossi M. · martedì 3 novembre 2026». */
  readonly titolo: string;
  readonly opzioni: OpzioniCella;
  readonly cella: CellaDoc | null;
  readonly colori: ReadonlyMap<string, IdColoreTurno | null>;
  /** Sola lettura (ADMIN o mese convalidato): il menu non offre modifiche (UX §9.5). */
  readonly soloLettura: boolean;
}

interface Voce {
  readonly chiave: string;
  readonly gruppo: string;
  readonly codice: string;
  readonly etichetta: string;
  readonly dettaglio: string;
  readonly sfondo: string;
  readonly testo: string;
  readonly bordo: string;
  readonly tratteggiato: boolean;
  readonly scelta: VoceScelta;
}

/** Una voce del gruppo «In questa cella», senza il codice colorato. */
function voceDiCella(chiave: string, etichetta: string, scelta: VoceScelta, dettaglio = ''): Voce {
  return {
    chiave,
    gruppo: testi.griglia.menu.inQuestaCella,
    codice: '',
    etichetta,
    dettaglio,
    sfondo: '',
    testo: '',
    bordo: '',
    tratteggiato: false,
    scelta,
  };
}

const DATI_MENU = new InjectionToken<DatiMenu>('DATI_MENU');
const CHIUDI_MENU = new InjectionToken<(valore: VoceScelta | undefined) => void>('CHIUDI_MENU');

@Component({
  selector: 'app-menu-cella-pannello',
  imports: [A11yModule],
  template: `
    <div
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      role="menu"
      [attr.aria-label]="dati.titolo"
      class="w-72 rounded-pannello border border-bordo bg-sfondo shadow-lg"
      (keydown)="aTasto($event)"
    >
      <p class="border-b border-bordo px-3 py-2 font-semibold">{{ dati.titolo }}</p>
      @if (dati.soloLettura) {
        <p class="px-3 py-2 text-testo-secondario">{{ testi.griglia.menu.soloLettura }}</p>
        @if (conTurno) {
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-sfondo-neutro focus:bg-sfondo-neutro"
            (click)="apriDettaglioTurno()"
          >
            {{ testi.griglia.menu.dettaglioTurno }}
          </button>
        }
        @if (conReperibilita) {
          <button
            type="button"
            role="menuitem"
            tabindex="-1"
            class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-sfondo-neutro focus:bg-sfondo-neutro"
            (click)="apriDettaglio()"
          >
            {{ testi.griglia.menu.dettaglioReperibilita }}
          </button>
        }
      } @else {
        <div class="px-2 pt-2">
          <input
            #filtro
            type="search"
            autocomplete="off"
            class="h-compatto w-full rounded-campo border border-bordo px-2"
            [attr.aria-label]="testi.griglia.menu.filtro"
            [placeholder]="testi.griglia.menu.filtro"
            (input)="testoFiltro.set(filtro.value)"
          />
        </div>
        <div class="max-h-96 overflow-y-auto py-1">
          @let elenco = visibili();
          @if (elenco.length === 0) {
            <p class="px-3 py-2 text-testo-secondario">{{ testi.griglia.menu.nessunRisultato }}</p>
          }
          @for (v of elenco; track v.chiave; let i = $index) {
            @if (i === 0 || elenco[i - 1]?.gruppo !== v.gruppo) {
              <p class="px-3 pt-2 pb-1 text-nota font-semibold text-testo-secondario">
                {{ v.gruppo }}
              </p>
            }
            <button
              type="button"
              role="menuitem"
              tabindex="-1"
              class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-sfondo-neutro focus:bg-sfondo-neutro"
              (click)="scegli(v)"
            >
              @if (v.codice !== '') {
                <span
                  class="inline-flex h-5 min-w-8 items-center justify-center rounded-campo border px-1.5 text-nota font-semibold"
                  [class.border-dashed]="v.tratteggiato"
                  [style.background]="v.sfondo"
                  [style.color]="v.testo"
                  [style.border-color]="v.bordo"
                  >{{ v.codice }}</span
                >
              }
              <span class="min-w-0 flex-1 truncate">{{ v.etichetta }}</span>
              @if (v.dettaglio !== '') {
                <span class="text-nota text-testo-secondario">{{ v.dettaglio }}</span>
              }
            </button>
          }
          @if (dati.opzioni.reperibilitaAlCompleto) {
            <p class="px-3 pt-2 pb-1 text-nota font-semibold text-testo-secondario">
              {{ testi.griglia.menu.reperibilita }}
            </p>
            <p class="px-3 py-1 text-testo-secondario">
              {{ testi.griglia.menu.massimoReperibilita }}
            </p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuCellaPannello {
  protected readonly testi = testi;
  protected readonly dati = inject(DATI_MENU);
  private readonly chiudi = inject(CHIUDI_MENU);
  private readonly filtro = viewChild<ElementRef<HTMLInputElement>>('filtro');
  private readonly radice = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly testoFiltro = signal('');
  protected readonly conReperibilita = (this.dati.cella?.reperibilita.length ?? 0) > 0;
  protected readonly conTurno = this.dati.cella?.turno != null;

  private readonly voci = computed<readonly Voce[]>(() => {
    const t = testi.griglia.menu;
    const { opzioni, cella, colori } = this.dati;
    const voci: Voce[] = [];
    for (const turno of opzioni.turni) {
      const stile = coloreTurno(colori.get(turno.codice) ?? '');
      voci.push({
        chiave: `t-${turno.codice}`,
        gruppo: t.turni,
        codice: turno.codice,
        etichetta: turno.nome,
        dettaglio: `${turno.inizio}–${turno.fine}`,
        sfondo: stile?.sfondo ?? COLORI.sfondoNeutro,
        testo: stile?.testo ?? COLORI.testoNeutro,
        bordo: stile?.bordo ?? COLORI.bordo,
        tratteggiato: stile === undefined,
        scelta: { tipo: 'codice', codice: turno.codice },
      });
    }
    for (const assenza of opzioni.assenze) {
      voci.push({
        chiave: `a-${assenza.codice}`,
        gruppo: t.assenze,
        codice: assenza.codice,
        etichetta: assenza.descrizione,
        dettaglio: '',
        sfondo: COLORI.sfondoNeutro,
        testo: COLORI.testoNeutro,
        bordo: assenza.effetto === 'comeRiposo' ? COLORI.sfondoNeutro : COLORI.bordoNeutro,
        tratteggiato: false,
        scelta: { tipo: 'codice', codice: assenza.codice },
      });
    }
    for (const fascia of opzioni.reperibilita) {
      voci.push({
        chiave: `r-${fascia.codice}`,
        gruppo: t.reperibilita,
        codice: fascia.codice,
        etichetta: fascia.nome,
        dettaglio: `${fascia.inizio}–${fascia.fine}`,
        sfondo: COLORI.sfondo,
        testo: COLORI.testo,
        bordo: COLORI.testoNeutro,
        tratteggiato: true,
        scelta: { tipo: 'codice', codice: fascia.codice },
      });
    }
    for (const r of cella?.reperibilita ?? []) {
      voci.push({
        chiave: `x-${r.codice}`,
        gruppo: t.inQuestaCella,
        codice: '',
        etichetta: t.rimuovi(r.codice),
        dettaglio: `${r.inizio}–${r.fine}`,
        sfondo: '',
        testo: '',
        bordo: '',
        tratteggiato: false,
        scelta: { tipo: 'rimuovi', codice: r.codice },
      });
    }
    if ((cella?.reperibilita.length ?? 0) > 0) {
      voci.push({
        chiave: 'dettaglio',
        gruppo: t.inQuestaCella,
        codice: '',
        etichetta: t.dettaglioReperibilita,
        dettaglio: '',
        sfondo: '',
        testo: '',
        bordo: '',
        tratteggiato: false,
        scelta: { tipo: 'dettaglio' },
      });
    }
    if (cella?.turno != null) {
      voci.push(voceDiCella('dettaglio-turno', t.dettaglioTurno, { tipo: 'dettaglioTurno' }));
    }
    // «Trova sostituto» solo da un turno o una fascia scoperti (un'assenza neutra senza sostituto, UX §9.11).
    if (cella?.turno != null && cella.assenza !== null && cella.copertoDa === null) {
      voci.push(
        voceDiCella('trova-sostituto', t.trovaSostituto, {
          tipo: 'trovaSostituto',
          oggetto: { tipo: 'turno' },
        }),
      );
    }
    if (cella?.assenza?.effetto === 'neutra') {
      for (const r of cella.reperibilita.filter((f) => f.copertaDa === null)) {
        voci.push(
          voceDiCella(
            `trova-sostituto-${r.codice}`,
            t.trovaSostitutoFascia(r.codice),
            { tipo: 'trovaSostituto', oggetto: { tipo: 'reperibilita', codice: r.codice } },
            `${r.inizio}–${r.fine}`,
          ),
        );
      }
    }
    if (cella?.copertoDa != null || cella?.sostituisce != null) {
      voci.push(
        voceDiCella('rimuovi-sostituzione', t.rimuoviSostituzione, {
          tipo: 'rimuoviSostituzione',
          oggetto: { tipo: 'turno' },
        }),
      );
    }
    for (const r of cella?.reperibilita ?? []) {
      if (r.copertaDa !== null || r.sostituisce !== null) {
        voci.push(
          voceDiCella(
            `rimuovi-sostituzione-${r.codice}`,
            t.rimuoviSostituzioneFascia(r.codice),
            { tipo: 'rimuoviSostituzione', oggetto: { tipo: 'reperibilita', codice: r.codice } },
            `${r.inizio}–${r.fine}`,
          ),
        );
      }
    }
    if (cella?.turno != null && cella.assenza !== null) {
      voci.push({
        chiave: 'elimina-scoperto',
        gruppo: t.inQuestaCella,
        codice: '',
        etichetta: t.eliminaTurnoScoperto,
        dettaglio: '',
        sfondo: '',
        testo: '',
        bordo: '',
        tratteggiato: false,
        scelta: { tipo: 'eliminaTurnoScoperto' },
      });
    }
    voci.push({
      chiave: 'svuota',
      gruppo: '',
      codice: '',
      etichetta: t.svuota,
      dettaglio: '',
      sfondo: '',
      testo: '',
      bordo: '',
      tratteggiato: false,
      scelta: { tipo: 'gomma' },
    });
    return voci;
  });

  protected readonly visibili = computed<readonly Voce[]>(() => {
    const testo = this.testoFiltro().trim().toLowerCase();
    return testo === ''
      ? this.voci()
      : this.voci().filter(
          (v) =>
            v.codice.toLowerCase().includes(testo) || v.etichetta.toLowerCase().includes(testo),
        );
  });

  protected apriDettaglio(): void {
    this.chiudi({ tipo: 'dettaglio' });
  }

  protected apriDettaglioTurno(): void {
    this.chiudi({ tipo: 'dettaglioTurno' });
  }

  protected scegli(voce: Voce): void {
    this.chiudi(voce.scelta);
  }

  protected aTasto(evento: KeyboardEvent): void {
    const voci = Array.from(
      this.radice.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    const corrente = voci.findIndex((v) => v === document.activeElement);
    const sposta = (indice: number): void => {
      evento.preventDefault();
      voci[Math.max(0, Math.min(voci.length - 1, indice))]?.focus();
    };
    switch (evento.key) {
      case 'ArrowDown':
        sposta(corrente + 1);
        return;
      case 'ArrowUp':
        if (corrente <= 0) {
          evento.preventDefault();
          this.filtro()?.nativeElement.focus();
        } else {
          sposta(corrente - 1);
        }
        return;
      case 'Enter':
        // Dal campo del filtro sceglie la prima voce; su una voce il clic nativo fa il resto.
        if (corrente < 0) {
          evento.preventDefault();
          const prima = this.visibili()[0];
          if (prima !== undefined) {
            this.chiudi(prima.scelta);
          }
        }
        return;
      case 'Escape':
        evento.preventDefault();
        this.chiudi(undefined);
        return;
      default:
    }
  }
}

/** Apre il menu della cella ancorato all'elemento e restituisce la voce scelta (undefined se chiuso senza scegliere). */
@Injectable({ providedIn: 'root' })
export class MenuCella {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private aperto: OverlayRef | null = null;

  apri(origine: HTMLElement, dati: DatiMenu): Promise<VoceScelta | undefined> {
    this.chiudiAperto();
    return new Promise((risolvi) => {
      const rif = this.overlay.create({
        positionStrategy: this.overlay
          .position()
          .flexibleConnectedTo(origine)
          .withPositions([
            { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
            { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
            { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
          ])
          .withPush(true),
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-transparent-backdrop',
      });
      this.aperto = rif;
      let finito = false;
      const chiudi = (valore: VoceScelta | undefined): void => {
        if (finito) {
          return;
        }
        finito = true;
        rif.dispose();
        if (this.aperto === rif) {
          this.aperto = null;
        }
        origine.focus();
        risolvi(valore);
      };
      rif.backdropClick().subscribe(() => chiudi(undefined));
      rif.detachments().subscribe(() => chiudi(undefined));
      rif.attach(
        new ComponentPortal(
          MenuCellaPannello,
          null,
          Injector.create({
            parent: this.injector,
            providers: [
              { provide: DATI_MENU, useValue: dati },
              { provide: CHIUDI_MENU, useValue: chiudi },
            ],
          }),
        ),
      );
    });
  }

  private chiudiAperto(): void {
    this.aperto?.dispose();
    this.aperto = null;
  }
}
