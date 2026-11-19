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
import { RouterLink } from '@angular/router';
import {
  avvisoReportNonInviato,
  bimestreDaInviare,
  chiaveMese,
  etichettaBimestre,
  formattaMese,
  formattaNomeMese,
  meseCorrente,
  spostaMese,
} from '@turni/domain';
import { DATA_OGGI } from '../../core/ambiente';
import { rottaDelReparto } from '../../core/atterraggio';
import { Sessione } from '../../core/sessione.service';
import { ElencoReparti } from '../../dati/elenco-reparti';
import { ReportRepo } from '../../dati/report.repo';
import { RiepiloghiRepo } from '../../dati/riepiloghi.repo';
import type { RepartoSintesi } from '../../dati/reparti.repo';
import { testi } from '../../testi/it';
import { testiReport } from '../../testi/it-report';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { EmptyState } from '../../ui/empty-state';
import { Icona } from '../../ui/icona';

/**
 * Una riga di «Avvisi aperti» (UX §7.2): un mese in bozza con avvisi, il mese prossimo non ancora creato o il report
 * del bimestre chiuso non inviato (step 4.1). `link` e `queryParams` portano alla schermata giusta.
 */
interface AvvisoHome {
  readonly chiave: string;
  readonly tipo: 'avvisi' | 'nonCreato' | 'report';
  readonly testo: string;
  readonly etichetta: string;
  readonly link: readonly string[];
  readonly queryParams: Readonly<Record<string, string>>;
}

const ORDINE_AVVISI = { avvisi: 0, report: 1, nonCreato: 2 } as const;

interface GruppoCoordinatore {
  readonly uid: string;
  readonly nome: string;
  readonly attivo: boolean;
  readonly reparti: readonly RepartoSintesi[];
}

/**
 * Home (schermata 2, UX §7.2). Coordinatore: i propri reparti con «Aggiungi reparto» e «Apri»/«Riprendi».
 * ADMIN: tutti i reparti raggruppati per coordinatore, solo «Apri»: nessuna azione di modifica.
 * «Avvisi aperti» elenca per reparto i mesi in bozza con avvisi (dai riepiloghi, indice `statoMese` +
 * `numeroAvvisi`), il mese prossimo non ancora creato e il report del bimestre chiuso non inviato (L15).
 * Il numero di avvisi viene dai riepiloghi: non comprende i turni esclusi già assegnati né le incoerenze tra righe.
 */
@Component({
  selector: 'app-home',
  imports: [Badge, Button, EmptyState, Icona, RouterLink],
  template: `
    <h1 class="mb-6 text-titolo-pagina">{{ testi.home.titolo }}</h1>

    <section aria-labelledby="titolo-avvisi" class="mb-8">
      <h2 id="titolo-avvisi" class="mb-2 text-titolo-sezione">{{ testi.home.avvisiTitolo }}</h2>
      <div
        class="rounded-pannello border border-bordo bg-sfondo px-4 py-3"
        [attr.aria-busy]="statoAvvisi() === 'caricamento'"
      >
        @if (avvisi().length > 0) {
          <ul class="flex flex-col gap-2">
            @for (avviso of avvisi(); track avviso.chiave) {
              <li class="flex items-center gap-3">
                <app-icona [nome]="avviso.tipo === 'avvisi' ? 'avviso' : 'info'" />
                <span class="flex-1" [class.text-avviso-testo]="avviso.tipo === 'avvisi'">{{
                  avviso.testo
                }}</span>
                <a
                  appButton
                  [routerLink]="avviso.link"
                  [queryParams]="avviso.queryParams"
                  [attr.aria-label]="avviso.etichetta"
                  >{{ testi.home.apri }}</a
                >
              </li>
            }
          </ul>
          <p class="mt-2 text-nota text-testo-secondario">{{ testi.home.avvisiConsiglio }}</p>
        } @else if (statoAvvisi() === 'caricamento') {
          <p class="text-testo-secondario" role="status">{{ testi.home.avvisiCaricamento }}</p>
        } @else if (statoAvvisi() !== 'errore') {
          <p class="text-testo-secondario">{{ testi.home.avvisiVuoto }}</p>
        }
        @if (statoAvvisi() === 'errore') {
          <p role="alert" class="mt-2 text-blocco-testo">{{ testi.home.avvisiErrore }}</p>
        }
      </div>
    </section>

    <section
      [attr.aria-labelledby]="'titolo-reparti'"
      [attr.aria-busy]="elenco.stato() === 'caricamento'"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 id="titolo-reparti" class="text-titolo-sezione">
          {{ eAdmin() ? testi.home.repartiAdmin : testi.home.repartiCoordinatore }}
        </h2>
        @if (!eAdmin() && elenco.stato() === 'pronto' && elenco.reparti().length > 0) {
          <a appButton variante="primario" routerLink="/reparti/nuovo">
            <app-icona nome="piu" /> {{ testi.home.aggiungiReparto }}
          </a>
        }
      </div>

      @switch (elenco.stato()) {
        @case ('errore') {
          <div
            role="alert"
            class="flex items-center gap-3 rounded-pannello border border-blocco bg-blocco-sfondo px-4 py-3 text-blocco-testo"
          >
            <app-icona nome="avviso" />
            <p class="flex-1">{{ testi.home.errore }}</p>
            <button appButton type="button" (click)="riprova()">{{ testi.ui.riprova }}</button>
          </div>
        }
        @case ('pronto') {
          @if (eAdmin()) {
            @if (gruppi().length === 0) {
              <app-empty-state [titolo]="testi.home.vuotoAdmin" icona="info" />
            } @else {
              <div class="flex flex-col gap-6">
                @for (gruppo of gruppi(); track gruppo.uid) {
                  <section
                    [attr.aria-label]="
                      testi.home.gruppoCoordinatore(gruppo.nome, gruppo.reparti.length)
                    "
                  >
                    <h3 class="mb-2 flex items-center gap-2 font-semibold">
                      {{ testi.home.gruppoCoordinatore(gruppo.nome, gruppo.reparti.length) }}
                      @if (!gruppo.attivo) {
                        <app-badge variante="neutro">{{ testi.home.disattivato }}</app-badge>
                      }
                    </h3>
                    <ul class="grid grid-cols-3 gap-4" [attr.aria-label]="testi.home.elencoReparti">
                      @for (reparto of gruppo.reparti; track reparto.id) {
                        <li class="rounded-pannello border border-bordo bg-sfondo p-4">
                          <p class="text-titolo-sezione">{{ reparto.nome }}</p>
                          <div class="mt-4 flex justify-end">
                            <a
                              appButton
                              [routerLink]="['/reparti', reparto.id]"
                              [attr.aria-label]="testi.home.apriReparto(reparto.nome)"
                              >{{ testi.home.apri }}</a
                            >
                          </div>
                        </li>
                      }
                    </ul>
                  </section>
                }
              </div>
            }
          } @else {
            @if (elenco.reparti().length === 0) {
              <app-empty-state
                [titolo]="testi.home.vuotoCoordinatoreTitolo"
                [testo]="testi.home.vuotoCoordinatoreTesto"
                icona="griglia"
              >
                <a appButton variante="primario" routerLink="/reparti/nuovo">
                  {{ testi.home.creaPrimoReparto }}
                </a>
              </app-empty-state>
            } @else {
              <ul class="grid grid-cols-3 gap-4" [attr.aria-label]="testi.home.elencoReparti">
                @for (reparto of elenco.reparti(); track reparto.id) {
                  <li class="flex flex-col rounded-pannello border border-bordo bg-sfondo p-4">
                    <p class="text-titolo-sezione">{{ reparto.nome }}</p>
                    @if (reparto.passo === 'completata') {
                      <p class="mt-1 text-testo-secondario">
                        {{ testi.home.meseCorrente(meseEtichetta) }}
                      </p>
                    } @else {
                      <p class="mt-1 font-medium text-avviso-testo">
                        {{ testi.home.configurazioneDaCompletare }}
                      </p>
                      <p class="text-testo-secondario">
                        {{ testi.home.passo(reparto.passo === 'turni' ? 2 : 3) }}
                      </p>
                    }
                    <div class="mt-4 flex justify-end">
                      <a
                        appButton
                        [routerLink]="rotta(reparto)"
                        [attr.aria-label]="
                          reparto.passo === 'completata'
                            ? testi.home.apriReparto(reparto.nome)
                            : testi.home.riprendiReparto(reparto.nome)
                        "
                        >{{
                          reparto.passo === 'completata' ? testi.home.apri : testi.home.riprendi
                        }}</a
                      >
                    </div>
                  </li>
                }
              </ul>
            }
          }
        }
        @default {
          <ul class="grid grid-cols-3 gap-4" aria-hidden="true">
            @for (n of [1, 2, 3]; track n) {
              <li
                class="h-32 animate-pulse rounded-pannello border border-bordo bg-sfondo-neutro motion-reduce:animate-none"
              ></li>
            }
          </ul>
          <p class="sr-only" role="status">{{ testi.ui.caricamento }}</p>
        }
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home implements OnInit {
  protected readonly testi = testi;
  protected readonly elenco = inject(ElencoReparti);
  private readonly sessione = inject(Sessione);
  protected readonly meseEtichetta = formattaMese(meseCorrente());

  protected readonly eAdmin = computed(() => this.sessione.ruolo() === 'ADMIN');

  private readonly riepiloghiRepo = inject(RiepiloghiRepo);
  private readonly reportRepo = inject(ReportRepo);
  private readonly oggi = inject(DATA_OGGI);
  protected readonly avvisi = signal<readonly AvvisoHome[]>([]);
  protected readonly statoAvvisi = signal<'caricamento' | 'pronto' | 'errore'>('caricamento');
  private lettura = 0;

  constructor() {
    // Gli avvisi dei mesi si cercano quando l'elenco dei reparti è pronto (una query per reparto configurato).
    effect(() => {
      if (this.elenco.stato() === 'pronto') {
        const reparti = this.elenco.reparti();
        untracked(() => void this.caricaAvvisi(reparti));
      }
    });
  }

  private async caricaAvvisi(reparti: readonly RepartoSintesi[]): Promise<void> {
    const numero = ++this.lettura;
    const completati = reparti.filter((r) => r.passo === 'completata');
    this.statoAvvisi.set('caricamento');
    const prossimo = spostaMese(chiaveMese(meseCorrente()), 1);
    let errore = false;
    const perReparto = await Promise.all(
      completati.map(async (reparto): Promise<AvvisoHome[]> => {
        const elenco: AvvisoHome[] = [];
        try {
          for (const m of await this.riepiloghiRepo.mesiConAvvisi(reparto.id)) {
            elenco.push({
              chiave: `${reparto.id}-${m.chiaveMese}-avvisi`,
              tipo: 'avvisi',
              testo: testi.home.avvisoMeseBozza(reparto.nome, formattaMese(m.chiaveMese), m.avvisi),
              etichetta: testi.home.apriAvviso(reparto.nome, formattaMese(m.chiaveMese)),
              link: ['/reparti', reparto.id, 'mesi', m.chiaveMese],
              queryParams: {},
            });
          }
          if (!(await this.riepiloghiRepo.esisteMese(reparto.id, prossimo))) {
            elenco.push({
              chiave: `${reparto.id}-${prossimo}-nonCreato`,
              tipo: 'nonCreato',
              testo: testi.home.avvisoMeseNonCreato(reparto.nome, formattaMese(prossimo)),
              etichetta: testi.home.apriAvviso(reparto.nome, formattaMese(prossimo)),
              link: ['/reparti', reparto.id, 'mesi', prossimo],
              queryParams: {},
            });
          }
          const dovuto = bimestreDaInviare(this.oggi());
          const avvisoReport = avvisoReportNonInviato(
            await this.reportRepo.statoBimestre(reparto.id, dovuto),
          );
          if (avvisoReport !== null) {
            const bimestre = etichettaBimestre(dovuto);
            elenco.push({
              chiave: `${reparto.id}-${dovuto}-report`,
              tipo: 'report',
              testo:
                avvisoReport.tipo === 'meseNonConvalidato'
                  ? testiReport.home.meseNonConvalidato(
                      reparto.nome,
                      bimestre,
                      avvisoReport.mesi.map(formattaNomeMese),
                    )
                  : testiReport.home.nonInviato(reparto.nome, bimestre),
              etichetta: testiReport.home.apri(reparto.nome, bimestre),
              link: ['/reparti', reparto.id, 'report'],
              queryParams: { bimestre: dovuto },
            });
          }
        } catch {
          errore = true;
        }
        return elenco;
      }),
    );
    if (numero !== this.lettura) {
      return;
    }
    this.avvisi.set(
      perReparto
        .flat()
        .sort(
          (a, b) =>
            ORDINE_AVVISI[a.tipo] - ORDINE_AVVISI[b.tipo] || a.testo.localeCompare(b.testo, 'it'),
        ),
    );
    this.statoAvvisi.set(errore ? 'errore' : 'pronto');
  }

  /** Reparti dell'ADMIN raggruppati per coordinatore, in ordine alfabetico. */
  protected readonly gruppi = computed<readonly GruppoCoordinatore[]>(() => {
    const perCoordinatore = new Map<string, RepartoSintesi[]>();
    for (const reparto of this.elenco.reparti()) {
      perCoordinatore.set(reparto.coordinatoreUid, [
        ...(perCoordinatore.get(reparto.coordinatoreUid) ?? []),
        reparto,
      ]);
    }
    const utenti = this.elenco.utentePerUid();
    return [...perCoordinatore.entries()]
      .map(([uid, reparti]) => {
        const utente = utenti.get(uid);
        return {
          uid,
          nome: utente ? `${utente.nome} ${utente.cognome}` : testi.layout.coordinatoreSconosciuto,
          attivo: utente?.attivo ?? true,
          reparti,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  });

  ngOnInit(): void {
    // La Home rilegge sempre: i reparti possono essere cambiati da un'altra scheda o dall'ADMIN.
    void this.elenco.carica(true);
  }

  protected rotta(reparto: RepartoSintesi): string {
    return rottaDelReparto(reparto, meseCorrente());
  }

  protected riprova(): void {
    void this.elenco.carica(true);
  }
}
