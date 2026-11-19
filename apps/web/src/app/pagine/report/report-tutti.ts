// Schermata 7 per l'ADMIN, `/report` (UX §7.10): i reparti raggruppati per coordinatore con lo stato del report del
// bimestre («inviato il …», «generato il …, non inviato», «non generato»), «Apri» (la pagina del reparto, senza «Invia»)
// e «Scarica Excel». Nessuna azione di invio: è del coordinatore. Una lettura per reparto (`report/{idBimestre}`).
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  bimestreDaInviare,
  bimestreDi,
  chiaveMeseDi,
  eIdBimestre,
  etichettaBimestre,
  formattaDataDaMs,
  spostaBimestre,
  type IdBimestre,
} from '@turni/domain';
import { DATA_OGGI } from '../../core/ambiente';
import { codiceErroreFunzione, testoErroreFunzione } from '../../core/errori';
import { ElencoReparti } from '../../dati/elenco-reparti';
import type { RepartoSintesi } from '../../dati/reparti.repo';
import { ReportRepo, type ReportSalvato } from '../../dati/report.repo';
import { FunzioniReport } from '../../funzioni/report';
import { testi } from '../../testi/it';
import { testiReport } from '../../testi/it-report';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';
import { ToastService } from '../../ui/toast';

interface RigaReparto {
  readonly reparto: RepartoSintesi;
  readonly stato: string;
}

interface Gruppo {
  readonly uid: string;
  readonly nome: string;
  readonly attivo: boolean;
  readonly reparti: readonly RigaReparto[];
}

const BIMESTRE_MINIMO = '2020-B1';

@Component({
  selector: 'app-report-tutti',
  imports: [Badge, Button, EmptyState, Icona, RouterLink],
  template: `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-titolo-pagina">{{ testiReport.titoloTutti }}</h1>
      <div
        class="flex items-center gap-1"
        role="group"
        [attr.aria-label]="testiReport.tutti.bimestre"
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
          [disabled]="idBimestre() >= bimestreCorrente()"
          (click)="vaiA(1)"
        >
          <app-icona nome="frecciaDestra" />
        </button>
      </div>
    </div>
    <p class="mb-4 text-testo-secondario">{{ testiReport.tutti.descrizione }}</p>

    @switch (elenco.stato()) {
      @case ('errore') {
        <div
          role="alert"
          class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
        >
          <app-icona nome="avviso" />
          <p class="flex-1">{{ testiReport.tutti.errore }}</p>
          <button appButton type="button" (click)="riprova()">{{ testi.ui.riprova }}</button>
        </div>
      }
      @case ('pronto') {
        @if (gruppi().length === 0) {
          <app-empty-state [titolo]="testiReport.tutti.nessunReparto" icona="info" />
        } @else {
          <div class="flex flex-col gap-6" [attr.aria-busy]="caricamento()">
            @for (gruppo of gruppi(); track gruppo.uid) {
              <section
                [attr.aria-label]="testiReport.tutti.gruppo(gruppo.nome, gruppo.reparti.length)"
              >
                <h2 class="mb-2 flex items-center gap-2 font-semibold">
                  {{ testiReport.tutti.gruppo(gruppo.nome, gruppo.reparti.length) }}
                  @if (!gruppo.attivo) {
                    <app-badge variante="neutro">{{ testiReport.tutti.disattivato }}</app-badge>
                  }
                </h2>
                <ul class="flex flex-col gap-2" [attr.aria-label]="testiReport.tutti.elenco">
                  @for (riga of gruppo.reparti; track riga.reparto.id) {
                    <li
                      class="flex flex-wrap items-center gap-3 rounded-pannello border border-bordo bg-sfondo px-4 py-3"
                      [attr.data-reparto]="riga.reparto.id"
                    >
                      <span class="min-w-40 font-medium">{{ riga.reparto.nome }}</span>
                      <span class="flex-1 text-testo-secondario" data-stato>{{ riga.stato }}</span>
                      <a
                        appButton
                        [routerLink]="['/reparti', riga.reparto.id, 'report']"
                        [queryParams]="{ bimestre: idBimestre() }"
                        [attr.aria-label]="testiReport.tutti.apriReparto(riga.reparto.nome)"
                        >{{ testiReport.tutti.apri }}</a
                      >
                      <button
                        appButton
                        type="button"
                        [caricamento]="inScarico() === riga.reparto.id"
                        [disabled]="inScarico() !== null"
                        [attr.aria-label]="testiReport.tutti.scaricaReparto(riga.reparto.nome)"
                        (click)="scarica(riga.reparto)"
                      >
                        {{ testiReport.tutti.scarica }}
                      </button>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        }
      }
      @default {
        <div
          class="h-24 animate-pulse rounded-pannello border border-bordo bg-sfondo-neutro motion-reduce:animate-none"
          aria-hidden="true"
        ></div>
        <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportTutti implements OnInit {
  protected readonly testi = testi;
  protected readonly testiReport = testiReport;
  protected readonly bimestreMinimo = BIMESTRE_MINIMO;
  protected readonly elenco = inject(ElencoReparti);
  private readonly oggi = inject(DATA_OGGI);
  private readonly router = inject(Router);
  private readonly rotta = inject(ActivatedRoute);
  private readonly reportRepo = inject(ReportRepo);
  private readonly funzioni = inject(FunzioniReport);
  private readonly toast = inject(ToastService);

  private readonly query = toSignal(this.rotta.queryParamMap, {
    initialValue: this.rotta.snapshot.queryParamMap,
  });

  protected readonly bimestreCorrente = computed(() => bimestreDi(chiaveMeseDi(this.oggi())));
  /** Il bimestre dell'URL se valido e non nel futuro; altrimenti l'ultimo dovuto (quello da inviare, D7). */
  protected readonly idBimestre = computed<IdBimestre>(() => {
    const letto = this.query().get('bimestre');
    return letto !== null &&
      eIdBimestre(letto) &&
      letto >= BIMESTRE_MINIMO &&
      letto <= this.bimestreCorrente()
      ? letto
      : bimestreDaInviare(this.oggi());
  });
  protected readonly etichetta = computed(() => etichettaBimestre(this.idBimestre()));

  /** Un report per reparto (null = non generato); undefined = lettura fallita. */
  private readonly report = signal<ReadonlyMap<string, ReportSalvato | null | undefined>>(
    new Map(),
  );
  protected readonly caricamento = signal(true);
  protected readonly inScarico = signal<string | null>(null);
  private lettura = 0;

  protected readonly gruppi = computed<readonly Gruppo[]>(() => {
    const perCoordinatore = new Map<string, RepartoSintesi[]>();
    for (const reparto of this.elenco.reparti()) {
      if (reparto.passo === 'completata') {
        perCoordinatore.set(reparto.coordinatoreUid, [
          ...(perCoordinatore.get(reparto.coordinatoreUid) ?? []),
          reparto,
        ]);
      }
    }
    const utenti = this.elenco.utentePerUid();
    const report = this.report();
    return [...perCoordinatore.entries()]
      .map(([uid, reparti]) => {
        const utente = utenti.get(uid);
        return {
          uid,
          nome: utente
            ? `${utente.nome} ${utente.cognome}`
            : testiReport.tutti.coordinatoreSconosciuto,
          attivo: utente?.attivo ?? true,
          reparti: [...reparti]
            .sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
            .map((reparto) => ({ reparto, stato: this.testoStato(report.get(reparto.id)) })),
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  });

  constructor() {
    effect(() => {
      if (this.elenco.stato() === 'pronto') {
        const reparti = this.elenco.reparti().filter((r) => r.passo === 'completata');
        const id = this.idBimestre();
        untracked(() => void this.leggiReport(reparti, id));
      }
    });
  }

  ngOnInit(): void {
    void this.elenco.carica(true);
  }

  protected riprova(): void {
    void this.elenco.carica(true);
  }

  private testoStato(report: ReportSalvato | null | undefined): string {
    if (report === undefined) {
      return testiReport.tutti.nonLeggibile;
    }
    if (report === null) {
      return testiReport.tutti.nonGenerato;
    }
    if (report.inviato && report.ultimoInvioMs !== null) {
      return testiReport.tutti.inviato(formattaDataDaMs(report.ultimoInvioMs));
    }
    return report.generatoIlMs === null
      ? testiReport.tutti.nonGenerato
      : testiReport.tutti.generato(formattaDataDaMs(report.generatoIlMs));
  }

  private async leggiReport(reparti: readonly RepartoSintesi[], id: IdBimestre): Promise<void> {
    const numero = ++this.lettura;
    this.caricamento.set(true);
    const letti = await Promise.all(
      reparti.map(async (reparto): Promise<[string, ReportSalvato | null | undefined]> => {
        try {
          return [reparto.id, await this.reportRepo.leggi(reparto.id, id)];
        } catch {
          return [reparto.id, undefined];
        }
      }),
    );
    if (numero === this.lettura) {
      this.report.set(new Map(letti));
      this.caricamento.set(false);
    }
  }

  protected vaiA(spostamento: number): void {
    void this.router.navigate([], {
      relativeTo: this.rotta,
      queryParams: { bimestre: spostaBimestre(this.idBimestre(), spostamento) },
      queryParamsHandling: 'merge',
    });
  }

  protected async scarica(reparto: RepartoSintesi): Promise<void> {
    this.inScarico.set(reparto.id);
    try {
      const file = await this.funzioni.genera({
        repartoId: reparto.id,
        idBimestre: this.idBimestre(),
      });
      this.funzioni.scarica(file.nomeFile, file.contenutoBase64);
      this.toast.successo(testiReport.fileScaricato(file.nomeFile));
      await this.leggiReport(
        this.elenco.reparti().filter((r) => r.passo === 'completata'),
        this.idBimestre(),
      );
    } catch (e) {
      this.toast.errore(
        codiceErroreFunzione(e) === null ? testiReport.erroreFile : testoErroreFunzione(e),
      );
    } finally {
      this.inScarico.set(null);
    }
  }
}
