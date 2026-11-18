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
import { ActivatedRoute, Router } from '@angular/router';
import {
  formattaData,
  formattaOreSettimanali,
  oggi,
  type CodiceErrore,
  type LeggiDatiPrivatiOutput,
} from '@turni/domain';
import type { ConModificheNonSalvate } from '../../core/guardie';
import { codiceErroreFunzione, testoErroreFunzione } from '../../core/errori';
import { Inattivita } from '../../core/inattivita.service';
import { Sessione } from '../../core/sessione.service';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import { FunzioniDipendenti } from '../../funzioni/dipendenti';
import { testi } from '../../testi/it';
import { Button } from '../../ui/button';
import { ChipTurno } from '../../ui/chip-turno';
import { Dialoghi } from '../../ui/dialog';
import { Icona } from '../../ui/icona';
import { Input } from '../../ui/input';
import { ToastService } from '../../ui/toast';
import { DialogoDisattiva, type DatiDisattiva } from './dialogo-disattiva';
import { DipendentiStore } from './dipendenti.store';
import {
  codiceFiscaleDaSegnalare,
  formDa,
  formVuoto,
  improntaForm,
  inputSalvataggio,
  validaForm,
  type CampoForm,
  type ErroriForm,
  type FormDipendente,
} from './scheda-form';

type StatoDatiRiservati = 'nascosti' | 'caricamento' | 'pronti' | 'errore';

/**
 * Scheda del dipendente (UX §7.5): pannello laterale di 360 px, non modale, per le rotte `nuovo` e
 * `:did/anagrafica`. Codice fiscale, data di nascita ed email non sono nell'elenco: la scheda li chiede al
 * server (`leggiDatiPrivati`, ogni lettura è registrata) quando si apre, per il coordinatore, oppure con
 * «Mostra dati riservati», per l'ADMIN, che consulta soltanto. Il salvataggio è esplicito (D1).
 */
@Component({
  selector: 'app-scheda-dipendente',
  imports: [Button, ChipTurno, Icona, Input],
  template: `
    <aside
      class="sticky top-4 ml-4 w-pannello shrink-0 rounded-pannello border border-bordo bg-sfondo"
      aria-labelledby="titolo-scheda"
      (keydown.escape)="chiudi()"
    >
      <div class="flex items-start justify-between gap-2 border-b border-bordo px-4 py-3">
        <h2 #titolo id="titolo-scheda" tabindex="-1" class="text-titolo-sezione focus:outline-none">
          {{ titoloScheda() }}
        </h2>
        <button
          type="button"
          class="flex size-8 shrink-0 items-center justify-center rounded-campo text-testo-secondario hover:bg-sfondo-neutro"
          [attr.aria-label]="testi.dipendenti.scheda.chiudi"
          (click)="chiudi()"
        >
          <app-icona nome="chiudi" />
        </button>
      </div>

      @if (nonTrovato()) {
        <p role="alert" class="px-4 py-4">{{ testi.dipendenti.scheda.nonTrovato }}</p>
      } @else if (modificabile()) {
        <form class="flex flex-col gap-3 px-4 py-4" novalidate (submit)="salva($event)">
          <app-input
            [etichetta]="testi.dipendenti.scheda.nome"
            [obbligatorio]="true"
            [lunghezzaMassima]="60"
            [valore]="form().nome"
            (valoreChange)="imposta('nome', $event)"
            [errore]="errore('nome')"
          />
          <app-input
            [etichetta]="testi.dipendenti.scheda.cognome"
            [obbligatorio]="true"
            [lunghezzaMassima]="60"
            [valore]="form().cognome"
            (valoreChange)="imposta('cognome', $event)"
            [errore]="errore('cognome')"
          />

          <fieldset class="flex flex-col gap-3 rounded-campo border border-bordo p-3">
            <legend
              tabindex="-1"
              data-focus="dati-riservati"
              class="px-1 text-tabella font-semibold focus:outline-none"
            >
              {{ testi.dipendenti.scheda.datiRiservati }}
            </legend>
            @switch (datiRiservati()) {
              @case ('caricamento') {
                <p role="status">{{ testi.dipendenti.scheda.datiInCaricamento }}</p>
              }
              @case ('errore') {
                <div role="alert" class="flex items-center gap-2 text-blocco-testo">
                  <app-icona nome="avviso" />
                  <span class="flex-1">{{ testi.dipendenti.scheda.datiNonDisponibili }}</span>
                  <button
                    appButton
                    type="button"
                    data-focus="riprova-dati"
                    (click)="caricaDatiRiservati(true)"
                  >
                    {{ testi.dipendenti.scheda.riprovaDati }}
                  </button>
                </div>
              }
              @default {
                <div (focusout)="toccaCodiceFiscale()">
                  <app-input
                    [etichetta]="testi.dipendenti.scheda.codiceFiscale"
                    [obbligatorio]="true"
                    [lunghezzaMassima]="20"
                    [valore]="form().codiceFiscale"
                    (valoreChange)="impostaCodiceFiscale($event)"
                    [errore]="errore('codiceFiscale')"
                  />
                </div>
                <app-input
                  tipo="date"
                  [etichetta]="testi.dipendenti.scheda.dataNascita"
                  [obbligatorio]="true"
                  [valore]="form().dataNascita"
                  (valoreChange)="imposta('dataNascita', $event)"
                  [errore]="errore('dataNascita')"
                />
                <app-input
                  tipo="email"
                  [etichetta]="testi.dipendenti.scheda.email"
                  [suggerimento]="testi.dipendenti.scheda.emailSuggerimento"
                  [lunghezzaMassima]="254"
                  [valore]="form().email"
                  (valoreChange)="imposta('email', $event)"
                  [errore]="errore('email')"
                />
              }
            }
          </fieldset>

          <app-input
            [etichetta]="testi.dipendenti.scheda.ore"
            [obbligatorio]="true"
            [suggerimento]="testi.dipendenti.scheda.oreSuggerimento"
            [valore]="form().ore"
            (valoreChange)="imposta('ore', $event)"
            [errore]="errore('ore')"
          />

          <fieldset class="flex flex-col gap-1">
            <legend class="mb-1 text-tabella font-medium">
              {{ testi.dipendenti.scheda.turniEsclusi }}
            </legend>
            @for (turno of turniMostrati(); track turno.codice) {
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  [attr.aria-label]="turno.codice + ' ' + turno.etichetta"
                  [checked]="form().turniEsclusi.includes(turno.codice)"
                  (change)="alternaTurno(turno.codice)"
                />
                <app-chip-turno [codice]="turno.codice" [colore]="turno.colore" />
                <span>{{ turno.etichetta }}</span>
              </label>
            } @empty {
              <p class="text-testo-secondario">
                {{ testi.dipendenti.scheda.nessunTurnoConfigurato }}
              </p>
            }
          </fieldset>

          <app-input
            tipo="date"
            [etichetta]="testi.dipendenti.scheda.dataAssunzione"
            [valore]="form().dataAssunzione"
            (valoreChange)="imposta('dataAssunzione', $event)"
            [errore]="errore('dataAssunzione')"
          />
          <app-input
            tipo="date"
            [etichetta]="testi.dipendenti.scheda.dataCessazione"
            [valore]="form().dataCessazione"
            (valoreChange)="imposta('dataCessazione', $event)"
            [errore]="errore('dataCessazione')"
          />

          <div aria-live="polite" class="min-h-5 text-tabella">
            @if (notaStato(); as nota) {
              <p class="font-medium text-bozza">{{ nota }}</p>
            }
          </div>

          @if (tentato() && !valido()) {
            <p role="alert" class="text-blocco-testo">{{ testi.dipendenti.scheda.correggi }}</p>
          }

          <div class="flex flex-wrap items-center gap-2 border-t border-bordo pt-3">
            @if (!nuovo()) {
              @if (form().attivo) {
                <button appButton type="button" data-focus="disattiva" (click)="disattiva()">
                  {{ testi.dipendenti.scheda.disattiva }}
                </button>
              } @else {
                <button appButton type="button" data-focus="riattiva" (click)="riattiva()">
                  {{ testi.dipendenti.scheda.riattiva }}
                </button>
              }
            }
            <span class="flex-1"></span>
            <button appButton type="button" (click)="chiudi()">
              {{ testi.dipendenti.scheda.annulla }}
            </button>
            <button appButton type="submit" variante="primario" [caricamento]="inSalvataggio()">
              {{ testi.dipendenti.scheda.salva }}
            </button>
          </div>
        </form>
      } @else {
        <!-- ADMIN: sola consultazione -->
        <dl class="flex flex-col gap-3 px-4 py-4">
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.nome }}</dt>
            <dd>{{ form().nome }}</dd>
          </div>
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.cognome }}</dt>
            <dd>{{ form().cognome }}</dd>
          </div>
          <div class="rounded-campo border border-bordo p-3">
            <dt
              tabindex="-1"
              data-focus="dati-riservati"
              class="mb-2 text-tabella font-semibold focus:outline-none"
            >
              {{ testi.dipendenti.scheda.datiRiservati }}
            </dt>
            <dd>
              @switch (datiRiservati()) {
                @case ('nascosti') {
                  <p class="mb-2 text-testo-secondario">
                    {{ testi.dipendenti.scheda.mostraDatiAvviso }}
                  </p>
                  <button appButton type="button" (click)="caricaDatiRiservati(true)">
                    <app-icona nome="occhio" /> {{ testi.dipendenti.scheda.mostraDati }}
                  </button>
                }
                @case ('caricamento') {
                  <p role="status">{{ testi.dipendenti.scheda.datiInCaricamento }}</p>
                }
                @case ('errore') {
                  <div role="alert" class="flex items-center gap-2 text-blocco-testo">
                    <app-icona nome="avviso" />
                    <span class="flex-1">{{ testi.dipendenti.scheda.datiNonDisponibili }}</span>
                    <button
                      appButton
                      type="button"
                      data-focus="riprova-dati"
                      (click)="caricaDatiRiservati(true)"
                    >
                      {{ testi.dipendenti.scheda.riprovaDati }}
                    </button>
                  </div>
                }
                @case ('pronti') {
                  <dl class="flex flex-col gap-2">
                    <div>
                      <dt class="text-tabella font-medium">
                        {{ testi.dipendenti.scheda.codiceFiscale }}
                      </dt>
                      <dd>{{ form().codiceFiscale }}</dd>
                    </div>
                    <div>
                      <dt class="text-tabella font-medium">
                        {{ testi.dipendenti.scheda.dataNascita }}
                      </dt>
                      <dd>{{ dataLeggibile(form().dataNascita) }}</dd>
                    </div>
                    <div>
                      <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.email }}</dt>
                      <dd>{{ form().email || testi.dipendenti.nessunTurnoEscluso }}</dd>
                    </div>
                  </dl>
                }
              }
            </dd>
          </div>
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.ore }}</dt>
            <dd>{{ oreLeggibili() }}</dd>
          </div>
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.turniEsclusi }}</dt>
            <dd class="flex flex-wrap gap-1">
              @for (turno of turniMostrati(); track turno.codice) {
                @if (form().turniEsclusi.includes(turno.codice)) {
                  <app-chip-turno [codice]="turno.codice" [colore]="turno.colore" />
                }
              } @empty {
                {{ testi.dipendenti.nessunTurnoEscluso }}
              }
            </dd>
          </div>
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.dataAssunzione }}</dt>
            <dd>{{ dataLeggibile(form().dataAssunzione) }}</dd>
          </div>
          <div>
            <dt class="text-tabella font-medium">{{ testi.dipendenti.scheda.dataCessazione }}</dt>
            <dd>{{ dataLeggibile(form().dataCessazione) }}</dd>
          </div>
        </dl>
        <div class="flex justify-end border-t border-bordo px-4 py-3">
          <button appButton type="button" (click)="chiudi()">{{ testi.ui.chiudi }}</button>
        </div>
      }
    </aside>
  `,
  host: {
    '(window:beforeunload)': 'primaDiChiudere($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedaDipendente implements ConModificheNonSalvate {
  protected readonly testi = testi;
  private readonly store = inject(DipendentiStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessione = inject(Sessione);
  private readonly funzioni = inject(FunzioniDipendenti);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);
  private readonly inattivita = inject(Inattivita);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly titolo = viewChild<ElementRef<HTMLElement>>('titolo');
  private readonly parametri = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly modificabile = computed(() => this.sessione.ruolo() === 'COORDINATORE');
  /** `null` = rotta `nuovo`. */
  private readonly idDipendente = computed(() => this.parametri().get('did'));
  protected readonly nuovo = computed(() => this.idDipendente() === null);

  private readonly dipendente = computed(() => {
    const id = this.idDipendente();
    return id === null ? null : (this.store.dipendenti().find((d) => d.id === id) ?? null);
  });
  protected readonly nonTrovato = computed(
    () => this.store.stato() === 'pronto' && !this.nuovo() && this.dipendente() === null,
  );

  protected readonly form = signal<FormDipendente>(formVuoto());
  /** Impronta del form com'era all'apertura (o dopo l'ultimo salvataggio). */
  private readonly improntaIniziale = signal(improntaForm(formVuoto()));
  protected readonly datiRiservati = signal<StatoDatiRiservati>('pronti');
  private readonly privatiLetti = signal<LeggiDatiPrivatiOutput | null>(null);
  protected readonly tentato = signal(false);
  protected readonly inSalvataggio = signal(false);
  private readonly codiceFiscaleToccato = signal(false);
  /** Errori che arrivano dal server (doppione, codice fiscale o email rifiutati); si tolgono modificando il campo. */
  private readonly erroriServer = signal<ErroriForm>({});
  /** Dipendente per cui il form è stato inizializzato: evita di ripartire a ogni rilettura dell'elenco. */
  private inizializzatoPer: string | null | undefined = undefined;

  private readonly contesto = computed(() => ({
    nuovo: this.nuovo(),
    privatiCaricati:
      this.datiRiservati() === 'pronti' && (this.nuovo() || this.privatiLetti() !== null),
    oggi: oggi(),
  }));

  private readonly esito = computed(() =>
    validaForm(this.form(), this.contesto(), this.privatiLetti()),
  );
  protected readonly valido = computed(() => this.esito().valido);

  protected readonly titoloScheda = computed(() => {
    const dipendente = this.dipendente();
    return this.nuovo() || dipendente === null
      ? testi.dipendenti.scheda.titoloNuovo
      : testi.dipendenti.scheda.titoloModifica(`${dipendente.nome} ${dipendente.cognome}`);
  });

  /** Errori da mostrare: quelli del server, quelli del form dopo il primo tentativo, il codice fiscale quando è completo. */
  private readonly errori = computed<ErroriForm>(() => {
    const esito = this.esito();
    const locali: ErroriForm = esito.valido ? {} : esito.errori;
    const visibili: Record<string, string> = {};
    if (this.tentato()) {
      Object.assign(visibili, locali);
    } else {
      const cf = locali.codiceFiscale;
      if (
        cf !== undefined &&
        codiceFiscaleDaSegnalare(this.form().codiceFiscale, this.codiceFiscaleToccato())
      ) {
        visibili['codiceFiscale'] = cf;
      }
    }
    return { ...visibili, ...this.erroriServer() };
  });

  /** Turni e fasce da mostrare tra le caselle: gli attivi, più quelli già esclusi anche se disattivati o sconosciuti. */
  protected readonly turniMostrati = computed(() => {
    const esclusi = new Set(this.form().turniEsclusi);
    const elenco = this.store
      .turni()
      .filter((turno) => turno.attivo || esclusi.has(turno.codice))
      .map((turno) => ({
        codice: turno.codice as string,
        colore: turno.colore,
        etichetta:
          turno.tipo === 'reperibilita'
            ? `${turno.nome} (${testi.dipendenti.reperibilita})`
            : turno.nome,
      }));
    const noti = new Set(elenco.map((t) => t.codice));
    for (const codice of esclusi) {
      if (!noti.has(codice)) {
        elenco.push({ codice, colore: null, etichetta: codice });
      }
    }
    return elenco;
  });

  protected readonly notaStato = computed(() => {
    const form = this.form();
    const dipendente = this.dipendente();
    if (this.nuovo() || dipendente === null) {
      return null;
    }
    if (!form.attivo && dipendente.attivo) {
      return testi.dipendenti.scheda.disattivatoDaSalvare(formattaData(form.dataCessazione));
    }
    if (form.attivo && !dipendente.attivo) {
      return testi.dipendenti.scheda.riattivatoDaSalvare;
    }
    if (!form.attivo) {
      return testi.dipendenti.scheda.disattivato(formattaData(form.dataCessazione));
    }
    return this.haModificheNonSalvate() ? testi.dipendenti.scheda.modificheNonSalvate : null;
  });

  constructor() {
    // Inizializza il form quando l'elenco è pronto e a ogni cambio di dipendente (route riusata).
    effect(() => {
      const pronto = this.store.stato() === 'pronto';
      const id = this.idDipendente();
      const dipendente = this.dipendente();
      if (!pronto) {
        return;
      }
      untracked(() => {
        if (this.inizializzatoPer === id) {
          return;
        }
        this.inizializza(id, dipendente);
      });
    });
    // L'avviso di inattività dice che ci sono modifiche da salvare (L27).
    effect(() =>
      this.inattivita.modificheNonSalvate.set(
        this.modificabile() && this.haModificheNonSalvate() ? 1 : 0,
      ),
    );
    inject(DestroyRef).onDestroy(() => this.inattivita.modificheNonSalvate.set(0));
  }

  private inizializza(id: string | null, dipendente: DipendenteSalvato | null): void {
    this.inizializzatoPer = id;
    this.tentato.set(false);
    this.erroriServer.set({});
    this.codiceFiscaleToccato.set(false);
    this.privatiLetti.set(null);
    if (id === null || dipendente === null) {
      const vuoto = formVuoto();
      this.form.set(vuoto);
      this.improntaIniziale.set(improntaForm(vuoto));
      this.datiRiservati.set('pronti');
    } else {
      const iniziale = formDa(dipendente, null);
      this.form.set(iniziale);
      this.improntaIniziale.set(improntaForm(iniziale));
      if (this.modificabile()) {
        void this.caricaDatiRiservati();
      } else {
        this.datiRiservati.set('nascosti');
      }
    }
    // Il focus va al titolo della scheda: chi usa la tastiera ha il resto a un Tab di distanza.
    afterNextRender(() => this.titolo()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Chiede al server i dati riservati (una voce di registro per ogni richiesta). */
  protected async caricaDatiRiservati(daAzione = false): Promise<void> {
    const dipendente = this.dipendente();
    const reparto = this.store.reparto();
    if (dipendente === null || reparto === null) {
      return;
    }
    const id = dipendente.id;
    this.datiRiservati.set('caricamento');
    try {
      const dati = await this.funzioni.leggiDatiPrivati({
        repartoId: reparto.id,
        dipendenteId: id,
      });
      if (this.idDipendente() !== id) {
        return; // nel frattempo si è aperta un'altra scheda
      }
      this.privatiLetti.set(dati);
      this.form.update((form) => ({
        ...form,
        codiceFiscale: dati.codiceFiscale,
        dataNascita: dati.dataNascita,
        email: dati.email ?? '',
      }));
      // Il punto di partenza ora comprende i dati riservati; le modifiche già fatte restano modifiche.
      this.improntaIniziale.set(improntaForm(formDa(dipendente, dati)));
      this.datiRiservati.set('pronti');
      if (daAzione) {
        this.portaFocus('dati-riservati');
      }
    } catch {
      if (this.idDipendente() === id) {
        this.datiRiservati.set('errore');
        if (daAzione) {
          this.portaFocus('riprova-dati');
        }
      }
    }
  }

  /**
   * Dopo un'azione che sostituisce il pulsante premuto il focus andrebbe su `body`: lo si porta, a vista
   * aggiornata, sull'elemento stabile indicato da `data-focus`.
   */
  private portaFocus(nome: string): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>(`[data-focus="${nome}"]`)?.focus(),
      { injector: this.injector },
    );
  }

  protected errore(campo: CampoForm): string | null {
    return this.errori()[campo] ?? null;
  }

  protected imposta(campo: CampoForm, valore: string): void {
    this.form.update((form) => ({ ...form, [campo]: valore }));
    this.togliErroreServer(campo);
  }

  protected impostaCodiceFiscale(valore: string): void {
    this.imposta('codiceFiscale', valore.toUpperCase());
  }

  protected toccaCodiceFiscale(): void {
    this.codiceFiscaleToccato.set(true);
  }

  private togliErroreServer(campo: CampoForm): void {
    if (this.erroriServer()[campo] !== undefined) {
      this.erroriServer.update((errori) => {
        const resto: ErroriForm = { ...errori };
        delete resto[campo];
        return resto;
      });
    }
  }

  protected alternaTurno(codice: string): void {
    this.form.update((form) => ({
      ...form,
      turniEsclusi: form.turniEsclusi.includes(codice)
        ? form.turniEsclusi.filter((c) => c !== codice)
        : [...form.turniEsclusi, codice],
    }));
  }

  protected async disattiva(): Promise<void> {
    const dati: DatiDisattiva = {
      dataIniziale: oggi(),
      dataAssunzione: this.form().dataAssunzione,
    };
    const data = await this.dialoghi.apri<DatiDisattiva, string>(DialogoDisattiva, dati);
    if (data !== undefined) {
      this.form.update((form) => ({ ...form, attivo: false, dataCessazione: data }));
      this.togliErroreServer('dataCessazione');
      this.portaFocus('riattiva');
    }
  }

  protected riattiva(): void {
    this.form.update((form) => ({ ...form, attivo: true, dataCessazione: '' }));
    this.togliErroreServer('dataCessazione');
    this.portaFocus('disattiva');
  }

  protected dataLeggibile(data: string): string {
    return data === '' ? testi.dipendenti.nessunTurnoEscluso : formattaData(data);
  }

  protected oreLeggibili(): string {
    const dipendente = this.dipendente();
    return dipendente === null ? '' : formattaOreSettimanali(dipendente.oreSettimanali);
  }

  protected async salva(evento: Event): Promise<void> {
    evento.preventDefault();
    const reparto = this.store.reparto();
    const esito = this.esito();
    if (reparto === null || this.inSalvataggio()) {
      return;
    }
    this.tentato.set(true);
    if (!esito.valido) {
      this.focalizzaPrimoErrore();
      return;
    }
    this.inSalvataggio.set(true);
    try {
      await this.funzioni.salva(inputSalvataggio(reparto.id, this.idDipendente(), esito));
      this.toast.successo(testi.dipendenti.scheda.salvato);
      // Dopo il salvataggio il form è il nuovo punto di partenza: si può uscire senza avviso.
      this.improntaIniziale.set(improntaForm(this.form()));
      await this.store.carica(reparto.id, true);
      await this.router.navigate(['/reparti', reparto.id, 'dipendenti']);
    } catch (errore) {
      this.mostraErroreSalvataggio(errore);
    } finally {
      this.inSalvataggio.set(false);
    }
  }

  private mostraErroreSalvataggio(errore: unknown): void {
    const codice: CodiceErrore | null = codiceErroreFunzione(errore);
    switch (codice) {
      case 'CF_NON_VALIDO':
      case 'CF_DUPLICATO':
        this.erroriServer.update((e) => ({ ...e, codiceFiscale: testi.erroriFunzioni[codice] }));
        this.focalizzaPrimoErrore();
        return;
      case 'EMAIL_NON_VALIDA':
        this.erroriServer.update((e) => ({ ...e, email: testi.erroriFunzioni[codice] }));
        this.focalizzaPrimoErrore();
        return;
      case null:
        this.toast.errore(testi.dipendenti.scheda.salvataggioNonRiuscito);
        return;
      default:
        this.toast.errore(testoErroreFunzione(errore));
    }
  }

  private focalizzaPrimoErrore(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }

  protected async chiudi(): Promise<void> {
    const reparto = this.store.reparto();
    if (reparto !== null) {
      await this.router.navigate(['/reparti', reparto.id, 'dipendenti']);
    }
  }

  haModificheNonSalvate(): boolean {
    return (
      this.modificabile() &&
      this.datiRiservati() !== 'caricamento' &&
      improntaForm(this.form()) !== this.improntaIniziale()
    );
  }

  confermaUscita(): Promise<boolean> {
    return this.dialoghi.conferma({
      titolo: testi.dipendenti.uscita.titolo,
      messaggio: testi.dipendenti.uscita.messaggio,
      etichettaConferma: testi.dipendenti.uscita.esci,
      etichettaAnnulla: testi.dipendenti.uscita.resta,
      pericolo: true,
    });
  }

  protected primaDiChiudere(evento: BeforeUnloadEvent): void {
    if (this.haModificheNonSalvate()) {
      evento.preventDefault();
    }
  }
}
