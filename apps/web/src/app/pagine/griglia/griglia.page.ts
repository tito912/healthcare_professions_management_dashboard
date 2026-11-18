// Schermata 5, «Pianificazione mese» (UX §7.6-§7.7, §9): barra degli strumenti, fascia di stato, pennello, griglia
// con nomi e intestazione fissi, pannello Avvisi. Gli eventi della griglia si gestiscono per delega su un solo
// elemento (tastiera, puntatore, appunti): le celle non hanno ascoltatori propri.
import { Dialog } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { formattaIntervalloGiorni, formattaMese, type ChiaveMese } from '@turni/domain';
import type { ConModificheNonSalvate } from '../../core/guardie';
import { Inattivita } from '../../core/inattivita.service';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { Dialoghi } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import { ToastService } from '../../ui/toast';
import { BarraPennello } from './barra-pennello/barra-pennello';
import type { ConfermaDaRiga } from './riga/riga';
import { DialogoAggiungiMese, type DatiAggiungiMese } from './dialogo-aggiungi-mese';
import { DialogoUscita, type SceltaUscita } from './dialogo-uscita';
import { FasciaStato, testoStato } from './fascia-stato/fascia-stato';
import { Intestazione } from './intestazione/intestazione';
import { Legenda, type DatiLegenda } from './legenda/legenda';
import { MenuCella } from './menu-cella/menu-cella';
import { PannelloAvvisi } from './pannello-avvisi/pannello-avvisi';
import { Riga } from './riga/riga';
import { GrigliaStore, type RiferimentoCella } from './stato/griglia.store';
import { azioneDaTasto } from './tastiera';
import {
  LARGHEZZA_NOMI,
  LARGHEZZA_TOTALE,
  LARGHEZZA_TOTALI,
  NUMERO_TOTALI,
  VISTE,
  type Vista,
} from './vista';

/** Quanto sta nel fondo del contenitore per le barre di scorrimento e i bordi. */
const MARGINE_ORIZZONTALE = 0;

@Component({
  selector: 'app-griglia',
  imports: [
    BarraPennello,
    Button,
    EmptyState,
    FasciaStato,
    Icona,
    Intestazione,
    PannelloAvvisi,
    RouterLink,
    Riga,
    TableScheletro,
  ],
  providers: [GrigliaStore],
  template: `
    <h1 class="sr-only">{{ titolo() }}</h1>
    @switch (store.stato()) {
      @case ('caricamento') {
        <app-table-scheletro [righe]="8" />
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <p class="flex-1">{{ testi.griglia.errore }}</p>
          <button appButton type="button" (click)="store.ricarica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('nonDisponibile') {
        <app-empty-state [titolo]="testi.griglia.nonDisponibile" icona="info">
          <a appButton routerLink="/home">{{ testi.errore.tornaAllaHome }}</a>
        </app-empty-state>
      }
      @case ('pronto') {
        <div
          class="flex min-h-0 flex-col"
          [style.height]="'calc(100dvh - var(--t-h-barra-superiore) - 16px)'"
        >
          @if (store.mese() !== null) {
            <app-fascia-stato
              [stato]="statoMese()"
              [pennello]="codicePennello()"
              (riprova)="salva()"
            />
          }
          <div
            class="flex h-11 shrink-0 items-center gap-2 px-2"
            role="toolbar"
            [attr.aria-label]="testi.griglia.barra"
          >
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
              [attr.aria-label]="testi.griglia.mesePrecedente"
              (click)="vaiAlMese(-1)"
            >
              <app-icona nome="frecciaSinistra" />
            </button>
            <span class="min-w-32 text-center text-titolo-sezione">{{
              store.meseEtichetta()
            }}</span>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
              [attr.aria-label]="testi.griglia.meseSuccessivo"
              (click)="vaiAlMese(1)"
            >
              <app-icona nome="frecciaDestra" />
            </button>

            @if (store.mese() !== null) {
              <div class="ml-4 flex items-center gap-2">
                <span id="etichetta-vista" class="text-tabella text-testo-secondario">{{
                  testi.griglia.vista.etichetta
                }}</span>
                <div
                  role="radiogroup"
                  aria-labelledby="etichetta-vista"
                  class="flex overflow-hidden rounded-campo border border-bordo"
                >
                  @for (v of viste; track v) {
                    <button
                      type="button"
                      role="radio"
                      class="h-compatto px-3 text-tabella"
                      [class.bg-primario]="store.vista() === v"
                      [class.text-white]="store.vista() === v"
                      [class.hover:bg-sfondo-neutro]="store.vista() !== v"
                      [attr.aria-checked]="store.vista() === v"
                      (click)="store.impostaVista(v)"
                    >
                      {{ testi.griglia.vista[v] }}
                    </button>
                  }
                </div>
              </div>
              @if (store.vista() !== 'mese') {
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                    [attr.aria-label]="testi.griglia.settimanaPrecedente"
                    [disabled]="!store.puoSpostareSettimana().indietro"
                    (click)="store.spostaSettimana(-1)"
                  >
                    <app-icona nome="frecciaSinistra" />
                  </button>
                  <span
                    class="min-w-24 text-center text-tabella"
                    [attr.aria-label]="testi.griglia.intervallo(intervallo())"
                  >
                    {{ intervallo() }}
                  </span>
                  <button
                    type="button"
                    class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
                    [attr.aria-label]="testi.griglia.settimanaSuccessiva"
                    [disabled]="!store.puoSpostareSettimana().avanti"
                    (click)="store.spostaSettimana(1)"
                  >
                    <app-icona nome="frecciaDestra" />
                  </button>
                </div>
              }
            }

            <div class="ml-auto flex items-center gap-2">
              @if (store.mese() !== null) {
                <button
                  appButton
                  type="button"
                  [attr.aria-expanded]="store.pannello() === 'avvisi'"
                  (click)="alternaPannello()"
                >
                  <app-icona nome="avviso" />
                  {{ testi.griglia.avvisi(store.numeroAvvisi()) }}
                </button>
                <span class="sr-only" aria-live="polite">{{
                  testi.griglia.avvisiAnnuncio(store.numeroAvvisi())
                }}</span>
                <button appButton type="button" (click)="apriLegenda()">
                  {{ testi.griglia.pulsanteLegenda }}
                </button>
                @if (!store.eAdmin()) {
                  <button
                    appButton
                    type="button"
                    variante="primario"
                    [attr.aria-disabled]="store.motivoSalvaDisabilitato() !== null"
                    [attr.title]="store.motivoSalvaDisabilitato()"
                    (click)="salva()"
                  >
                    {{ testi.griglia.salvaBozza }}
                  </button>
                  <button
                    appButton
                    type="button"
                    aria-disabled="true"
                    [attr.title]="store.motivoConvalidaDisabilitata()"
                  >
                    {{ testi.griglia.convalida }}
                  </button>
                }
              } @else if (!store.eAdmin() && !store.oltreFinestra()) {
                <button appButton type="button" variante="primario" (click)="aggiungiMese()">
                  {{ testi.griglia.aggiungiMese }}
                </button>
              }
            </div>
          </div>

          @if (store.mese() === null) {
            <app-empty-state
              [titolo]="testi.griglia.meseNonCreato(store.meseEtichetta())"
              [testo]="testoMeseNonCreato()"
              icona="griglia"
            >
              @if (!store.eAdmin() && !store.oltreFinestra()) {
                <button appButton type="button" variante="primario" (click)="aggiungiMese()">
                  {{ testi.griglia.aggiungiMese }}
                </button>
              }
            </app-empty-state>
          } @else if (store.ordine().length === 0) {
            <app-empty-state [titolo]="testi.griglia.nessunDipendente" icona="dipendenti">
              <a appButton [routerLink]="['/reparti', store.repartoId(), 'dipendenti']">
                {{ testi.griglia.vaiAiDipendenti }}
              </a>
            </app-empty-state>
          } @else {
            @if (store.modificabile()) {
              <app-barra-pennello
                [turni]="store.turni()"
                [assenze]="store.assenze()"
                [pennello]="store.pennello()"
                [celleSelezionate]="store.celleSelezionate()"
                (scegli)="store.scegliPennello($event)"
              />
            }
            <div class="relative min-h-0 flex-1">
              <div
                #scorrimento
                class="h-full overflow-auto border border-bordo bg-sfondo"
                [class.cursor-crosshair]="store.pennello() !== null"
              >
                <div
                  #griglia
                  role="grid"
                  class="griglia relative"
                  [attr.aria-label]="testi.griglia.cella.griglia"
                  [attr.aria-describedby]="idDescrizione"
                  [attr.aria-rowcount]="store.ordine().length + 1"
                  [attr.aria-colcount]="store.giorni().length + 5"
                  [attr.aria-readonly]="store.solaLettura() ? 'true' : null"
                  [style.--colonne]="colonneCss()"
                  [style.width.px]="larghezzaTotale()"
                  (keydown)="aTasto($event)"
                  (pointerdown)="aPuntatoreGiu($event)"
                  (pointerover)="aPuntatoreSopra($event)"
                  (pointerleave)="nascondiSuggerimento()"
                  (dblclick)="aDoppioClic($event)"
                  (contextmenu)="aMenuContestuale($event)"
                  (focusin)="aFocus($event)"
                  (copy)="aCopia($event)"
                  (paste)="aIncolla($event)"
                >
                  <app-intestazione
                    [colonne]="store.colonne()"
                    [configurazione]="store.configurazioneVista()"
                  />
                  @for (id of store.ordine(); track id; let i = $index) {
                    <app-riga
                      [id]="id"
                      [attr.aria-rowindex]="i + 2"
                      (confermato)="aConferma(id, $event)"
                      (annullato)="aAnnullato()"
                    />
                  }
                </div>
              </div>
              <p [id]="idDescrizione" class="sr-only">{{ testi.griglia.cella.descrizione }}</p>
              @if (store.pannello() === 'avvisi') {
                <app-pannello-avvisi
                  [voci]="store.voci()"
                  [soloLettura]="store.solaLettura()"
                  (vai)="vaiAllaVoce($event)"
                  (aggiorna)="store.applicaAllineamento($event)"
                  (chiudi)="chiudiPannello()"
                />
              }
              @if (suggerimento(); as s) {
                <div
                  role="tooltip"
                  class="pointer-events-none fixed z-50 max-w-xs rounded-campo bg-testo px-2 py-1 text-nota whitespace-pre-line text-white shadow-lg"
                  [style.left.px]="s.x"
                  [style.top.px]="s.y"
                >
                  {{ s.testo }}
                </div>
              }
            </div>
          }
        </div>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrigliaPage implements ConModificheNonSalvate {
  protected readonly testi = testi;
  protected readonly store = inject(GrigliaStore);
  protected readonly viste: readonly Vista[] = VISTE;
  protected readonly idDescrizione = 'descrizione-griglia';
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly documento = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly dialoghi = inject(Dialoghi);
  private readonly dialog = inject(Dialog);
  private readonly menu = inject(MenuCella);
  private readonly toast = inject(ToastService);
  private readonly inattivita = inject(Inattivita);

  private readonly scorrimento = viewChild<ElementRef<HTMLElement>>('scorrimento');
  private readonly griglia = viewChild<ElementRef<HTMLElement>>('griglia');
  protected readonly suggerimento = signal<{ x: number; y: number; testo: string } | null>(null);

  private readonly parametri = toSignal(this.rotta.paramMap, {
    initialValue: this.rotta.snapshot.paramMap,
  });

  protected readonly titolo = computed(() =>
    testi.griglia.titolo(this.store.reparto()?.nome ?? '', this.store.meseEtichetta()),
  );

  protected readonly statoMese = computed(() => {
    const mese = this.store.mese();
    return testoStato({
      eAdmin: this.store.eAdmin(),
      stato: mese?.stato ?? 'bozza',
      convalidatoIlMs: mese?.convalidatoIlMs ?? null,
      convalidatoDaNome: mese?.convalidatoDaNome ?? null,
      modifiche: this.store.modifiche(),
      salvataggio: this.store.salvataggio(),
      ultimoSalvataggio: this.store.ultimoSalvataggio(),
    });
  });

  protected readonly codicePennello = computed(() => {
    const p = this.store.pennello();
    return p === null ? null : p.tipo === 'gomma' ? testi.griglia.pennello.gomma : p.codice;
  });

  protected readonly intervallo = computed(() => {
    const i = this.store.intervalloVisibile();
    return i === null ? '' : formattaIntervalloGiorni(i.da, i.a);
  });

  protected readonly testoMeseNonCreato = computed(() => {
    if (this.store.eAdmin()) {
      return testi.griglia.soloConsultazioneMese;
    }
    return this.store.oltreFinestra()
      ? `${testi.griglia.oltreFinestra(formattaMese(this.store.ultimoMeseCreabile()))} ${testi.griglia.oltreFinestraSpiegazione}`
      : testi.griglia.meseNonCreatoTesto;
  });

  protected readonly larghezzaTotale = computed(
    () =>
      LARGHEZZA_NOMI +
      this.store.giorni().length * this.store.configurazioneVista().larghezzaGiorno +
      LARGHEZZA_TOTALI,
  );
  protected readonly colonneCss = computed(
    () =>
      `${LARGHEZZA_NOMI}px repeat(${this.store.giorni().length}, ${this.store.configurazioneVista().larghezzaGiorno}px) repeat(${NUMERO_TOTALI}, ${LARGHEZZA_TOTALE}px)`,
  );

  private trascinamento: RiferimentoCella | null = null;

  constructor() {
    effect(() => {
      const parametri = this.parametri();
      const rid = parametri.get('rid') ?? '';
      const chiave = parametri.get('chiaveMese') ?? '';
      untracked(() => void this.store.carica(rid, chiave));
    });

    // Misura lo spazio per i giorni (UX §8.1): larghezza utile del contenitore meno nomi e totali.
    effect((pulisci) => {
      const contenitore = this.scorrimento()?.nativeElement;
      if (contenitore === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      const misura = (): void => {
        const disponibile =
          contenitore.clientWidth - LARGHEZZA_NOMI - LARGHEZZA_TOTALI - MARGINE_ORIZZONTALE;
        if (disponibile > 0) {
          this.store.larghezzaDisponibile.set(disponibile);
        }
      };
      misura();
      const osservatore = new ResizeObserver(misura);
      osservatore.observe(contenitore);
      pulisci(() => osservatore.disconnect());
    });

    // Riga e colonna della cella attiva evidenziate (U9): classi sul DOM, così non si ridisegnano le righe.
    effect(() => {
      const attiva = this.store.attiva();
      this.store.giorni();
      this.store.ordine();
      this.store.stato();
      afterNextRender(() => this.evidenzia(attiva), { injector: this.injector });
    });

    // L'avviso di inattività dice quante modifiche non sono salvate e offre «Salva bozza» (UX §3, L27).
    effect(() => {
      const modifiche = this.store.modificabile() ? this.store.modifiche() : 0;
      this.inattivita.modificheNonSalvate.set(modifiche);
      this.inattivita.salvaBozza.set(
        modifiche > 0 ? async () => void (await this.store.salva()) : null,
      );
    });

    // Chiusura o ricarica della scheda con modifiche non salvate: avviso nativo del browser.
    const finestra = this.documento.defaultView;
    const primaDiUscire = (evento: BeforeUnloadEvent): void => {
      if (this.haModificheNonSalvate()) {
        evento.preventDefault();
        evento.returnValue = '';
      }
    };
    const tastoGlobale = (evento: KeyboardEvent): void => {
      if (
        (evento.ctrlKey || evento.metaKey) &&
        !evento.altKey &&
        evento.key.toLowerCase() === 's'
      ) {
        // Ctrl+S salva la bozza ovunque nella pagina e non apre «Salva con nome» del browser.
        evento.preventDefault();
        void this.salva();
      }
    };
    finestra?.addEventListener('beforeunload', primaDiUscire);
    this.documento.addEventListener('keydown', tastoGlobale);
    inject(DestroyRef).onDestroy(() => {
      finestra?.removeEventListener('beforeunload', primaDiUscire);
      this.documento.removeEventListener('keydown', tastoGlobale);
      this.inattivita.modificheNonSalvate.set(0);
      this.inattivita.salvaBozza.set(null);
      this.dialog.closeAll();
    });
  }

  // --- guardia di uscita ------------------------------------------------------------------------

  haModificheNonSalvate(): boolean {
    return this.store.modificabile() && this.store.modifiche() > 0;
  }

  async confermaUscita(): Promise<boolean> {
    const scelta = await this.dialoghi.apri<number, SceltaUscita | undefined>(
      DialogoUscita,
      this.store.modifiche(),
    );
    if (scelta === 'esci') {
      return true;
    }
    return scelta === 'salva' ? await this.store.salva() : false;
  }

  // --- navigazione tra mesi ------------------------------------------------------------------

  protected vaiAlMese(direzione: 1 | -1): void {
    const chiave = this.store.meseAdiacente(direzione);
    if (chiave !== null) {
      void this.vaiA(chiave);
    }
  }

  private vaiA(chiave: ChiaveMese): Promise<boolean> {
    return this.router.navigate(['/reparti', this.store.repartoId(), 'mesi', chiave]);
  }

  protected async aggiungiMese(): Promise<void> {
    const chiaveCorrente = this.store.chiaveMese();
    if (chiaveCorrente === null) {
      return;
    }
    const creati = await this.store.mesiCreati().catch(() => []);
    const dati: DatiAggiungiMese = {
      meseIniziale: chiaveCorrente,
      creati,
      creabile: (chiave) => this.store.meseCreabile(chiave),
    };
    const scelto = await this.dialoghi.apri<DatiAggiungiMese, ChiaveMese | undefined>(
      DialogoAggiungiMese,
      dati,
    );
    if (scelto === undefined || !(await this.store.aggiungiMese(scelto))) {
      return;
    }
    this.toast.successo(testi.griglia.aggiungiMeseDialogo.creatoToast(formattaMese(scelto)));
    if (scelto === chiaveCorrente) {
      await this.store.ricarica();
    } else {
      await this.vaiA(scelto);
    }
  }

  // --- pulsanti ------------------------------------------------------------------------------------

  protected async salva(): Promise<void> {
    if (this.store.motivoSalvaDisabilitato() === null) {
      await this.store.salva();
    }
  }

  protected alternaPannello(): void {
    this.store.pannello.update((p) => (p === 'avvisi' ? null : 'avvisi'));
  }

  protected chiudiPannello(): void {
    this.store.pannello.set(null);
    this.focalizzaAttiva();
  }

  protected vaiAllaVoce(cella: RiferimentoCella): void {
    this.store.vaiAllaCella(cella);
    this.focalizzaAttiva();
  }

  protected apriLegenda(): void {
    void this.dialoghi.apri<DatiLegenda, void>(Legenda, {
      turni: this.store.turni(),
      assenze: this.store.assenze(),
    });
  }

  // --- focus e DOM -----------------------------------------------------------------------------

  private elementoCella(cella: RiferimentoCella | null): HTMLElement | null {
    if (cella === null) {
      return null;
    }
    const celle = this.griglia()?.nativeElement.querySelectorAll<HTMLElement>(
      `[role="gridcell"][data-g="${cella.giorno}"]`,
    );
    return (
      Array.from(celle ?? []).find((e) => e.getAttribute('data-r') === cella.dipendenteId) ?? null
    );
  }

  /** Dà il focus alla cella attiva dopo il prossimo ridisegno (può essere in un'altra settimana). */
  protected focalizzaAttiva(): void {
    afterNextRender(() => this.elementoCella(this.store.attiva())?.focus(), {
      injector: this.injector,
    });
  }

  private cellaDa(bersaglio: EventTarget | null): RiferimentoCella | null {
    const elemento =
      bersaglio instanceof Element ? bersaglio.closest('[role="gridcell"][data-r][data-g]') : null;
    const dipendenteId = elemento?.getAttribute('data-r');
    const giorno = elemento?.getAttribute('data-g');
    const trovato = this.store.giorni().find((g) => g === giorno);
    return dipendenteId == null || trovato === undefined ? null : { dipendenteId, giorno: trovato };
  }

  private evidenzia(attiva: RiferimentoCella | null): void {
    const radice = this.griglia()?.nativeElement;
    if (radice === undefined) {
      return;
    }
    for (const classe of ['ev-col', 'ev-riga', 'ev-nome', 'ev-intestazione']) {
      for (const elemento of Array.from(radice.getElementsByClassName(classe))) {
        elemento.classList.remove(classe);
      }
    }
    if (attiva === null) {
      return;
    }
    const id = CSS.escape(attiva.dipendenteId);
    for (const e of Array.from(
      radice.querySelectorAll(`[role="gridcell"][data-g="${attiva.giorno}"]`),
    )) {
      e.classList.add('ev-col');
    }
    radice
      .querySelector(`[role="columnheader"][data-g="${attiva.giorno}"]`)
      ?.classList.add('ev-intestazione');
    for (const e of Array.from(radice.querySelectorAll(`[role="gridcell"][data-r="${id}"]`))) {
      e.classList.add('ev-riga');
    }
    radice.querySelector(`[role="rowheader"][data-nome="${id}"]`)?.classList.add('ev-nome');
  }

  // --- suggerimento (tooltip) della cella ----------------------------------------------------------

  private mostraSuggerimento(elemento: HTMLElement | null, cella: RiferimentoCella | null): void {
    if (elemento === null || cella === null) {
      this.suggerimento.set(null);
      return;
    }
    const celle = this.store.derivatiDi(cella.dipendenteId).dati().celle;
    const vista = celle.find((c) => c.giorno === cella.giorno);
    const righe: string[] = [];
    if (vista?.fuoriServizio != null) {
      righe.push(vista.fuoriServizio);
    }
    if (vista !== undefined && this.store.configurazioneVista().striscia === 'ore') {
      righe.push(...vista.striscia.map((v) => v.tooltip));
    }
    if (vista !== undefined && vista.avvisi !== '') {
      righe.push(vista.avvisi);
    }
    if (righe.length === 0) {
      this.suggerimento.set(null);
      return;
    }
    const r = elemento.getBoundingClientRect();
    this.suggerimento.set({ x: r.left, y: r.bottom + 6, testo: righe.join('\n') });
  }

  protected nascondiSuggerimento(): void {
    this.suggerimento.set(null);
  }

  protected aFocus(evento: FocusEvent): void {
    const cella = this.cellaDa(evento.target);
    this.mostraSuggerimento(evento.target instanceof HTMLElement ? evento.target : null, cella);
  }

  protected aPuntatoreSopra(evento: PointerEvent): void {
    const cella = this.cellaDa(evento.target);
    if (this.trascinamento !== null && cella !== null) {
      this.store.selezionaRettangolo(this.trascinamento, cella);
      return;
    }
    if (evento.pointerType === 'mouse') {
      const elemento =
        evento.target instanceof Element
          ? evento.target.closest<HTMLElement>('[role="gridcell"]')
          : null;
      this.mostraSuggerimento(elemento, cella);
    }
  }

  // --- puntatore ------------------------------------------------------------------------------------

  protected aPuntatoreGiu(evento: PointerEvent): void {
    if (evento.button !== 0) {
      return;
    }
    const bersaglio = evento.target;
    // Clic sul nome: seleziona la riga (UX §9.1).
    const nome =
      bersaglio instanceof Element
        ? bersaglio.closest<HTMLElement>('[role="rowheader"][data-nome]')
        : null;
    if (nome !== null) {
      const id = nome.getAttribute('data-nome');
      const primo = this.store.giorni()[0];
      if (id !== null && primo !== undefined) {
        this.store.selezionaCella({ dipendenteId: id, giorno: primo });
        this.store.selezionaRiga();
        this.focalizzaAttiva();
      }
      return;
    }
    const cella = this.cellaDa(bersaglio);
    if (cella === null || bersaglio instanceof HTMLInputElement) {
      return;
    }
    const pennello = this.store.pennello() !== null && this.store.modificabile();
    if (pennello) {
      // Con il pennello il clic o il trascinamento applicano: un rettangolo dalla cella di partenza a quella corrente.
      evento.preventDefault();
      this.trascinamento = cella;
      this.store.selezionaRettangolo(cella, cella);
    } else if (evento.shiftKey) {
      this.store.selezionaCella(cella, true);
    } else {
      this.store.selezionaCella(cella);
      this.trascinamento = cella;
    }
    const alRilascio = (): void => {
      this.documento.removeEventListener('pointerup', alRilascio, true);
      this.documento.removeEventListener('pointercancel', alRilascio, true);
      if (pennello && this.trascinamento !== null) {
        this.store.applicaPennelloAllaSelezione();
      }
      this.trascinamento = null;
      this.elementoCella(this.store.attiva())?.focus();
    };
    this.documento.addEventListener('pointerup', alRilascio, true);
    this.documento.addEventListener('pointercancel', alRilascio, true);
  }

  protected aDoppioClic(evento: MouseEvent): void {
    const bersaglio = evento.target;
    const nome =
      bersaglio instanceof Element
        ? bersaglio.closest<HTMLElement>('[role="rowheader"][data-nome]')
        : null;
    if (nome !== null) {
      const id = nome.getAttribute('data-nome');
      if (id !== null) {
        void this.router.navigate([
          '/reparti',
          this.store.repartoId(),
          'dipendenti',
          id,
          'anagrafica',
        ]);
      }
      return;
    }
    if (this.cellaDa(bersaglio) !== null && this.store.pennello() === null) {
      void this.apriMenu();
    }
  }

  protected aMenuContestuale(evento: MouseEvent): void {
    const cella = this.cellaDa(evento.target);
    if (cella === null) {
      return;
    }
    evento.preventDefault();
    const selezione = this.store.celleDellIntervallo();
    if (
      !selezione.some((c) => c.dipendenteId === cella.dipendenteId && c.giorno === cella.giorno)
    ) {
      this.store.selezionaCella(cella);
    }
    void this.apriMenu();
  }

  // --- menu della cella ---------------------------------------------------------------------------

  private async apriMenu(): Promise<void> {
    const attiva = this.store.attiva();
    const elemento = this.elementoCella(attiva);
    const dati = attiva === null ? null : this.store.datiPerMenu(attiva);
    if (elemento === null || dati === null) {
      return;
    }
    const voce = await this.menu.apri(elemento, { ...dati, soloLettura: this.store.solaLettura() });
    if (voce !== undefined) {
      this.store.scegliDalMenu(voce);
    }
    this.focalizzaAttiva();
  }

  // --- tastiera -------------------------------------------------------------------------------------

  protected aTasto(evento: KeyboardEvent): void {
    if (evento.target instanceof HTMLInputElement) {
      // L'inserimento veloce gestisce i propri tasti (`Cella.aTasto`).
      return;
    }
    const azione = azioneDaTasto(evento, { pennelloAttivo: this.store.pennello() !== null });
    if (azione === null) {
      return;
    }
    const s = this.store;
    const gestito = (): void => evento.preventDefault();
    switch (azione.tipo) {
      case 'muovi':
        gestito();
        s.muovi(azione.dRiga, azione.dColonna, azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'tab':
        if (s.tab(azione.indietro)) {
          gestito();
          this.focalizzaAttiva();
        }
        return;
      case 'primoGiorno':
        gestito();
        s.primoGiorno(azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'ultimoGiorno':
        gestito();
        s.ultimoGiorno(azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'primaCella':
        gestito();
        s.primaCella(azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'ultimaCella':
        gestito();
        s.ultimaCella(azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'pagina':
        gestito();
        s.pagina(azione.direzione, azione.estendi);
        this.focalizzaAttiva();
        return;
      case 'settimana':
        gestito();
        s.spostaSettimana(azione.direzione);
        this.focalizzaAttiva();
        return;
      case 'mese':
        gestito();
        this.vaiAlMese(azione.direzione);
        return;
      case 'inserisci':
        gestito();
        s.avviaInserimento(azione.carattere);
        return;
      case 'menu':
        gestito();
        void this.apriMenu();
        return;
      case 'applicaPennello':
        gestito();
        s.applicaPennelloAllaSelezione();
        return;
      case 'svuota':
        gestito();
        s.svuota();
        return;
      case 'esc':
        gestito();
        if (s.pennello() !== null) {
          s.scegliPennello(null);
        } else if (!s.riduciSelezione()) {
          s.pannello.set(null);
        }
        return;
      case 'annulla':
        gestito();
        s.annulla();
        return;
      case 'ripristina':
        gestito();
        s.ripristina();
        return;
      case 'legenda':
        gestito();
        this.apriLegenda();
        return;
      case 'selezionaRiga':
        gestito();
        s.selezionaRiga();
        return;
      case 'selezionaColonna':
        gestito();
        s.selezionaColonna();
        return;
      case 'salva':
        // Ctrl+S è gestito a livello di documento: vale anche fuori dalla griglia.
        return;
    }
  }

  protected aConferma(id: string, evento: ConfermaDaRiga): void {
    const esito = this.store.confermaInserimento(evento.conferma.testo, evento.conferma.suTutto);
    if (!esito.ok) {
      return;
    }
    const direzione = evento.conferma.suTutto ? null : evento.conferma.direzione;
    if (direzione !== null) {
      this.store.selezionaCella({ dipendenteId: id, giorno: evento.giorno });
      switch (direzione) {
        case 'giu':
          this.store.muovi(1, 0, false);
          break;
        case 'su':
          this.store.muovi(-1, 0, false);
          break;
        case 'destra':
          this.store.muovi(0, 1, false);
          break;
        case 'sinistra':
          this.store.muovi(0, -1, false);
          break;
      }
    }
    this.focalizzaAttiva();
  }

  protected aAnnullato(): void {
    if (this.store.inserimento() === null) {
      return;
    }
    this.store.annullaInserimento();
    // Con `Esc` il campo sparisce con il focus: lo si riporta sulla cella (con un clic altrove il focus è già altrove).
    afterNextRender(
      () => {
        const attivo = this.documento.activeElement;
        if (attivo === null || attivo === this.documento.body) {
          this.elementoCella(this.store.attiva())?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  // --- appunti ----------------------------------------------------------------------------------------

  protected aCopia(evento: ClipboardEvent): void {
    if (evento.target instanceof HTMLInputElement) {
      return;
    }
    const testo = this.store.copia();
    if (testo !== null && evento.clipboardData !== null) {
      evento.preventDefault();
      evento.clipboardData.setData('text/plain', testo);
    }
  }

  protected aIncolla(evento: ClipboardEvent): void {
    if (evento.target instanceof HTMLInputElement) {
      return;
    }
    const testo = evento.clipboardData?.getData('text/plain');
    if (testo !== undefined && testo !== '') {
      evento.preventDefault();
      this.store.incolla(testo);
    }
  }
}
