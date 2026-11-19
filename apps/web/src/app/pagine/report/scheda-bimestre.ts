// Scheda «Bimestre» del report (UX §7.10): selettore del bimestre, tabella con le colonne del file, «Scarica Excel»,
// «Invia a tutti…» con conferma, reinvio per riga con lo stato dell'ultimo invio. Il bimestre in corso si consulta come
// provvisorio (mesi in bozza compresi, valori «≈»); il file e l'invio comprendono solo i mesi convalidati. L'ADMIN vede
// la stessa tabella senza i pulsanti di invio (`puoInviare` falso).
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { etichettaBimestre, mesiDelBimestre, spostaBimestre, type IdBimestre } from '@turni/domain';
import { codiceErroreFunzione, testoErroreFunzione } from '../../core/errori';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import { ReportRepo, type MesiDelBimestre, type ReportSalvato } from '../../dati/report.repo';
import { RiepiloghiRepo } from '../../dati/riepiloghi.repo';
import { FunzioniReport } from '../../funzioni/report';
import { testi } from '../../testi/it';
import { testiReport } from '../../testi/it-report';
import { Button } from '../../ui/button';
import { Dialoghi } from '../../ui/dialog';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { TableScheletro } from '../../ui/table';
import { ToastService } from '../../ui/toast';
import {
  celleConteggi,
  nomiMesi,
  righeReport,
  vistaBimestre,
  type RigaReportVista,
  type VistaBimestre,
} from './modello';

type Stato = 'caricamento' | 'pronto' | 'errore';
type Occupato = 'nessuno' | 'file' | 'anteprima' | 'invio';

const BIMESTRE_MINIMO = '2020-B1';

@Component({
  selector: 'app-report-bimestre',
  imports: [Button, EmptyState, Icona, TableScheletro],
  template: `
    <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div
        class="flex items-center gap-1"
        role="group"
        [attr.aria-label]="testiReport.bimestre.etichetta"
      >
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
          [attr.aria-label]="testiReport.bimestre.precedente"
          [disabled]="idBimestre() <= bimestreMinimo"
          (click)="vaiA(-1)"
        >
          <app-icona nome="frecciaSinistra" />
        </button>
        <span class="min-w-28 text-center text-titolo-sezione" data-bimestre>{{
          etichetta()
        }}</span>
        <button
          type="button"
          class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro disabled:opacity-40"
          [attr.aria-label]="testiReport.bimestre.successivo"
          [disabled]="idBimestre() >= bimestreMassimo()"
          (click)="vaiA(1)"
        >
          <app-icona nome="frecciaDestra" />
        </button>
      </div>

      @if (vista(); as v) {
        <div class="flex-1">
          @if (v.provvisorio && v.mesiMostrati.length > 0) {
            <p class="text-avviso-testo" data-provvisorio>
              {{ testiReport.provvisorio(nomiMesi(v.mesiNonConvalidati)) }}
            </p>
          }
          @if (v.mesiConvalidati.length > 0 && v.mesiNonConvalidati.length > 0) {
            <p class="text-nota text-testo-secondario" data-file-e-invio>
              {{ testiReport.fileEInvio(nomiMesi(v.mesiConvalidati)) }}
            </p>
          }
        </div>
        <div class="flex items-center gap-2">
          <button
            appButton
            type="button"
            [caricamento]="occupato() === 'file'"
            [disabled]="!puoAzioni() || occupato() !== 'nessuno'"
            [attr.aria-describedby]="puoAzioni() ? null : 'motivo-azioni'"
            (click)="scarica()"
          >
            {{ testiReport.scaricaExcel }}
          </button>
          @if (puoInviare()) {
            <button
              appButton
              variante="primario"
              type="button"
              [caricamento]="occupato() === 'anteprima' || occupato() === 'invio'"
              [disabled]="!puoAzioni() || occupato() !== 'nessuno'"
              [attr.aria-describedby]="puoAzioni() ? null : 'motivo-azioni'"
              (click)="inviaATutti()"
            >
              {{ testiReport.inviaATutti }}
            </button>
          }
        </div>
      }
    </div>

    @switch (stato()) {
      @case ('caricamento') {
        <app-table-scheletro [righe]="6" />
        <p class="sr-only" role="status">{{ testiReport.generazione }}</p>
      }
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiReport.errore }}</p>
          <button appButton type="button" (click)="carica()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('pronto') {
        @if (vista(); as v) {
          @if (v.mesiMostrati.length === 0) {
            <app-empty-state [titolo]="testiReport.nessunMese" icona="report" />
          } @else {
            @if (!puoAzioni()) {
              <p id="motivo-azioni" class="mb-2 text-nota text-testo-secondario" data-motivo>
                {{ testiReport.nessunMeseConvalidato }}
              </p>
            } @else if (!puoInviare()) {
              <p class="mb-2 text-nota text-testo-secondario">
                {{ testiReport.soloConsultazione }}
              </p>
            }
            @if (righe().length === 0) {
              <app-empty-state [titolo]="testiReport.nessunDipendente" icona="report" />
            } @else {
              <div class="overflow-x-auto rounded-pannello border border-bordo bg-sfondo">
                <table class="w-full border-collapse text-tabella">
                  <caption class="sr-only">
                    {{
                      testiReport.tabella(etichetta())
                    }}
                  </caption>
                  <thead>
                    <tr class="bg-sfondo-neutro">
                      <th
                        scope="col"
                        class="h-riga min-w-40 border-b border-bordo px-3 text-left font-semibold"
                      >
                        {{ testiReport.colonne.dipendente }}
                      </th>
                      @for (c of colonne; track c) {
                        <th
                          scope="col"
                          class="h-riga border-b border-bordo px-2 text-right font-semibold"
                        >
                          {{ c }}
                        </th>
                      }
                      <th
                        scope="col"
                        class="h-riga min-w-44 border-b border-bordo px-3 text-left font-semibold"
                      >
                        {{ testiReport.colonne.ultimoInvio }}
                      </th>
                      @if (puoInviare()) {
                        <th scope="col" class="h-riga border-b border-bordo px-2">
                          <span class="sr-only">{{ testiReport.colonne.azioni }}</span>
                        </th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of righe(); track r.id) {
                      <tr [attr.data-dipendente]="r.id">
                        <th
                          scope="row"
                          class="h-riga border-b border-bordo px-3 text-left font-medium"
                        >
                          <span [attr.title]="r.nomeCompleto">{{ r.nome }}</span>
                        </th>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="turni"
                        >
                          {{ r.celle.turni }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="notti"
                        >
                          {{ r.celle.notti }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="sabati"
                        >
                          {{ r.celle.sabati }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="domeniche"
                        >
                          {{ r.celle.domeniche }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="reperibilita"
                        >
                          {{ r.celle.reperibilita }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="chiamate"
                        >
                          {{ r.celle.chiamate }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-2 text-right tabular-nums"
                          [class.italic]="v.provvisorio"
                          data-cella="durata"
                        >
                          {{ r.celle.durata }}
                        </td>
                        <td
                          class="h-riga border-b border-bordo px-3"
                          [class.text-blocco-testo]="r.ultimoInvio.esito === 'errore'"
                          data-cella="ultimo-invio"
                        >
                          {{ r.ultimoInvio.testo }}
                        </td>
                        @if (puoInviare()) {
                          <td class="h-riga border-b border-bordo px-2 text-right">
                            <button
                              appButton
                              variante="testo"
                              type="button"
                              [disabled]="!puoAzioni() || occupato() !== 'nessuno'"
                              [attr.aria-label]="testiReport.reinviaA(r.nomeCompleto)"
                              (click)="reinvia(r)"
                            >
                              {{ testiReport.reinvia }}
                            </button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="bg-sfondo-neutro font-semibold">
                      <th scope="row" class="h-riga px-3 text-left">
                        {{ testiReport.colonne.totale }}
                      </th>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="turni"
                      >
                        {{ totali().turni }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="notti"
                      >
                        {{ totali().notti }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="sabati"
                      >
                        {{ totali().sabati }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="domeniche"
                      >
                        {{ totali().domeniche }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="reperibilita"
                      >
                        {{ totali().reperibilita }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="chiamate"
                      >
                        {{ totali().chiamate }}
                      </td>
                      <td
                        class="h-riga px-2 text-right tabular-nums"
                        [class.italic]="v.provvisorio"
                        data-totale="durata"
                      >
                        {{ totali().durata }}
                      </td>
                      <td [attr.colspan]="puoInviare() ? 2 : 1"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              @if (v.provvisorio) {
                <p class="mt-2 text-nota text-testo-secondario">
                  {{ testiReport.provvisorioSuggerimento }}
                </p>
              }
            }
          }
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedaBimestre {
  protected readonly testi = testi;
  protected readonly testiReport = testiReport;
  protected readonly nomiMesi = nomiMesi;
  protected readonly bimestreMinimo = BIMESTRE_MINIMO;
  protected readonly colonne = [
    testiReport.colonne.turni,
    testiReport.colonne.notti,
    testiReport.colonne.sabati,
    testiReport.colonne.domeniche,
    testiReport.colonne.reperibilita,
    testiReport.colonne.chiamate,
    testiReport.colonne.durata,
  ];
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly reportRepo = inject(ReportRepo);
  private readonly riepiloghiRepo = inject(RiepiloghiRepo);
  private readonly funzioni = inject(FunzioniReport);
  private readonly dialoghi = inject(Dialoghi);
  private readonly toast = inject(ToastService);

  readonly repartoId = input.required<string>();
  readonly idBimestre = input.required<IdBimestre>();
  /** Il bimestre in corso: oltre non si va. */
  readonly bimestreMassimo = input.required<IdBimestre>();
  readonly dipendenti = input.required<readonly DipendenteSalvato[]>();
  /** Solo il coordinatore proprietario invia (l'ADMIN consulta e scarica). */
  readonly puoInviare = input.required<boolean>();

  protected readonly stato = signal<Stato>('caricamento');
  protected readonly occupato = signal<Occupato>('nessuno');
  private readonly mesi = signal<readonly MesiDelBimestre[]>([]);
  private readonly report = signal<ReportSalvato | null>(null);
  private readonly riepiloghi = signal<Awaited<ReturnType<RiepiloghiRepo['perReport']>>>([]);
  private richiesta = 0;

  protected readonly etichetta = computed(() => etichettaBimestre(this.idBimestre()));
  protected readonly vista = computed<VistaBimestre | null>(() =>
    this.stato() === 'pronto'
      ? vistaBimestre(this.idBimestre(), this.mesi(), this.report(), this.riepiloghi())
      : null,
  );
  protected readonly righe = computed<readonly RigaReportVista[]>(() => {
    const v = this.vista();
    return v === null ? [] : righeReport(this.dipendenti(), v, this.report());
  });
  protected readonly totali = computed(() => {
    const v = this.vista();
    return celleConteggi(v?.totali ?? vuoti, v?.provvisorio ?? false);
  });
  /** File e invio hanno senso solo con almeno un mese convalidato. */
  protected readonly puoAzioni = computed(() => (this.vista()?.mesiConvalidati.length ?? 0) > 0);

  constructor() {
    effect(() => {
      this.repartoId();
      this.idBimestre();
      untracked(() => void this.carica());
    });
  }

  protected async carica(): Promise<void> {
    const numero = ++this.richiesta;
    const rid = this.repartoId();
    const id = this.idBimestre();
    const [primo, secondo] = mesiDelBimestre(id);
    this.stato.set('caricamento');
    try {
      const [mesi, report, riepiloghi] = await Promise.all([
        this.reportRepo.mesi(rid, id),
        this.reportRepo.leggi(rid, id),
        this.riepiloghiRepo.perReport(rid, primo, secondo),
      ]);
      if (numero !== this.richiesta) {
        return;
      }
      this.mesi.set(mesi);
      this.report.set(report);
      this.riepiloghi.set(riepiloghi);
      this.stato.set('pronto');
    } catch {
      if (numero === this.richiesta) {
        this.stato.set('errore');
      }
    }
  }

  protected vaiA(spostamento: number): void {
    void this.router.navigate([], {
      relativeTo: this.rotta,
      queryParams: { bimestre: spostaBimestre(this.idBimestre(), spostamento) },
      queryParamsHandling: 'merge',
    });
  }

  protected async scarica(): Promise<void> {
    this.occupato.set('file');
    try {
      const file = await this.funzioni.genera({
        repartoId: this.repartoId(),
        idBimestre: this.idBimestre(),
      });
      this.funzioni.scarica(file.nomeFile, file.contenutoBase64);
      this.toast.successo(testiReport.fileScaricato(file.nomeFile));
    } catch (e) {
      this.toast.errore(
        codiceErroreFunzione(e) === null ? testiReport.erroreFile : testoErroreFunzione(e),
      );
    } finally {
      this.occupato.set('nessuno');
    }
    await this.ricaricaSilenzioso();
  }

  protected async inviaATutti(): Promise<void> {
    this.occupato.set('anteprima');
    let conEmail = 0;
    let senzaEmail = 0;
    try {
      const { esiti } = await this.funzioni.invia({
        repartoId: this.repartoId(),
        idBimestre: this.idBimestre(),
        dipendenteIds: null,
        anteprima: true,
      });
      conEmail = esiti.filter((e) => e.esito === 'accodato').length;
      senzaEmail = esiti.filter((e) => e.esito !== 'accodato').length;
    } catch (e) {
      this.occupato.set('nessuno');
      this.toast.errore(
        codiceErroreFunzione(e) === null
          ? testiReport.invio.erroreAnteprima
          : testoErroreFunzione(e),
      );
      return;
    }
    if (conEmail === 0) {
      this.occupato.set('nessuno');
      this.toast.info(testiReport.invio.nessunIndirizzo);
      return;
    }
    const parziale = (this.vista()?.mesiNonConvalidati.length ?? 0) > 0;
    this.occupato.set('nessuno');
    const confermato = await this.dialoghi.conferma({
      titolo: testiReport.invio.titolo,
      messaggio:
        testiReport.invio.conferma(conEmail, senzaEmail) +
        (parziale ? testiReport.invio.solo(nomiMesi(this.vista()?.mesiConvalidati ?? [])) : ''),
      etichettaConferma: testiReport.invio.azione,
    });
    if (!confermato) {
      return;
    }
    this.occupato.set('invio');
    try {
      const { esiti } = await this.funzioni.invia({
        repartoId: this.repartoId(),
        idBimestre: this.idBimestre(),
        dipendenteIds: null,
      });
      const conta = (esito: string): number => esiti.filter((e) => e.esito === esito).length;
      this.toast.successo(
        testiReport.invio.esitoTutti(conta('accodato'), conta('senzaEmail'), conta('errore')),
      );
    } catch (e) {
      this.toast.errore(
        codiceErroreFunzione(e) === null ? testiReport.invio.erroreInvio : testoErroreFunzione(e),
      );
    } finally {
      this.occupato.set('nessuno');
    }
    await this.ricaricaSilenzioso();
  }

  protected async reinvia(riga: RigaReportVista): Promise<void> {
    const confermato = await this.dialoghi.conferma({
      titolo: testiReport.invio.titoloSingolo,
      messaggio: testiReport.invio.confermaSingolo(riga.nomeCompleto),
      etichettaConferma: testiReport.invio.azioneSingolo,
    });
    if (!confermato) {
      return;
    }
    this.occupato.set('invio');
    try {
      const { esiti } = await this.funzioni.invia({
        repartoId: this.repartoId(),
        idBimestre: this.idBimestre(),
        dipendenteIds: [riga.id],
      });
      const esito = esiti.find((e) => e.dipendenteId === riga.id)?.esito ?? 'errore';
      if (esito === 'errore') {
        this.toast.errore(testiReport.invio.esitoSingolo.errore(riga.nomeCompleto));
      } else if (esito === 'senzaEmail') {
        this.toast.info(testiReport.invio.esitoSingolo.senzaEmail(riga.nomeCompleto));
      } else {
        this.toast.successo(testiReport.invio.esitoSingolo.accodato(riga.nomeCompleto));
      }
    } catch (e) {
      this.toast.errore(
        codiceErroreFunzione(e) === null ? testiReport.invio.erroreInvio : testoErroreFunzione(e),
      );
    } finally {
      this.occupato.set('nessuno');
    }
    await this.ricaricaSilenzioso();
  }

  /** Rilegge il documento del report (esiti e data) senza lo scheletro. */
  private async ricaricaSilenzioso(): Promise<void> {
    const rid = this.repartoId();
    const id = this.idBimestre();
    try {
      const report = await this.reportRepo.leggi(rid, id);
      if (rid === this.repartoId() && id === this.idBimestre()) {
        this.report.set(report);
      }
    } catch {
      // I dati mostrati restano quelli di prima: l'esito dell'operazione è già stato comunicato.
    }
  }
}

const vuoti = {
  turniSvolti: 0,
  notti: 0,
  sabati: 0,
  domenicheEFestivi: 0,
  reperibilitaSvolte: 0,
  chiamate: 0,
  minutiChiamate: 0,
};
