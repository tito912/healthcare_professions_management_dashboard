// Stampa del mese (D16, UX §9.12): una tabella pensata per la carta, non la griglia a schermo. Sempre il mese
// intero, qualunque sia la vista. Intestazione con reparto, mese, stato e data; codici in grassetto con bordo
// sottile (i colori non servono: tutto resta leggibile in bianco e nero), reperibilità come codici piccoli
// sotto il codice, assenze in corsivo, turno scoperto «M1*», totali a destra, legenda in fondo. Il foglio di
// stile è `styles/stampa.css`: orizzontale, A3 o A4 secondo la carta scelta nel dialogo di stampa del browser,
// che offre anche «Salva come PDF». L'elemento nasce quando il browser sta per stampare (`beforeprint`) e
// sparisce a stampa finita (`afterprint`): fuori dalla stampa non pesa sulla pagina.
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  createComponent,
  DestroyRef,
  EnvironmentInjector,
  inject,
  Injectable,
  input,
  type ComponentRef,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { adessoMs, formattaDataDaMs, formattaOraDaMs, type ChiaveMese } from '@turni/domain';
import { testi } from '../../../testi/it';
import { testiGriglia } from '../../../testi/it-griglia';
import { celleDellaRiga, sfondoDiColonna, type CellaVista } from '../modello';
import type { GrigliaStore } from '../stato/griglia.store';
import { configurazioneVista } from '../vista';

interface RigaStampa {
  readonly id: string;
  readonly nome: string;
  readonly celle: readonly CellaVista[];
  readonly pianificate: string;
  readonly dovute: string;
  readonly differenza: string;
  readonly reperibilita: string;
}

interface VoceLegenda {
  readonly codice: string;
  readonly testo: string;
}

@Component({
  selector: 'app-pagina-stampa',
  template: `
    @let s = store();
    <header class="stampa-intestazione">
      <h1>{{ titolo() }}</h1>
      <p>{{ stato() }}</p>
      <p>{{ stampatoIl() }}</p>
    </header>
    <table class="stampa-tabella">
      <thead>
        <tr>
          <th class="stampa-nome" scope="col">{{ testiGriglia.stampa.dipendente }}</th>
          @for (c of s.tuttiIGiorni(); track c.giorno) {
            <th scope="col" [class]="classeColonna(c)">
              <span class="stampa-numero">{{ c.numero }}{{ c.festivita ? '✱' : '' }}</span>
              <span class="stampa-iniziale">{{ iniziale(c.giornoSettimana) }}</span>
            </th>
          }
          <th class="stampa-totale" scope="col">{{ testiGriglia.colonne.pianificate }}</th>
          <th class="stampa-totale" scope="col">{{ testiGriglia.colonne.dovute }}</th>
          <th class="stampa-totale" scope="col">{{ testiGriglia.colonne.differenza }}</th>
          <th class="stampa-totale" scope="col">{{ testiGriglia.colonne.reperibilita }}</th>
        </tr>
      </thead>
      <tbody>
        @for (r of righe(); track r.id) {
          <tr>
            <th class="stampa-nome" scope="row">{{ r.nome }}</th>
            @for (c of r.celle; track c.giorno; let i = $index) {
              <td [class]="classeCella(c, s.tuttiIGiorni()[i])">
                @if (c.fuoriServizio !== null) {
                  <span class="stampa-fuori">–</span>
                } @else {
                  @if (c.chip; as chip) {
                    <span [class]="'stampa-codice stampa-' + chip.categoria"
                      >{{ chip.codice }}{{ chip.categoria === 'scoperto' ? '*' : '' }}</span
                    >
                  }
                  @if (c.striscia.length > 0) {
                    <span class="stampa-rep">{{ codiciStriscia(c) }}</span>
                  }
                  @if (c.segni.chiamata) {
                    <span class="stampa-segno stampa-segno-alto-sinistra" aria-hidden="true"
                      >☎</span
                    >
                  }
                  @if (c.segni.sostituzione) {
                    <span class="stampa-segno stampa-segno-alto-destra" aria-hidden="true">⇄</span>
                  }
                  @if (c.segni.orarioVariato) {
                    <span class="stampa-segno stampa-segno-basso-destra" aria-hidden="true">±</span>
                  }
                }
              </td>
            }
            <td class="stampa-totale">{{ r.pianificate }}</td>
            <td class="stampa-totale">{{ r.dovute }}</td>
            <td class="stampa-totale">{{ r.differenza }}</td>
            <td class="stampa-totale">{{ r.reperibilita }}</td>
          </tr>
        }
      </tbody>
    </table>
    <footer class="stampa-legenda">
      <h2>{{ testiGriglia.stampa.legenda }}</h2>
      <ul class="stampa-codici">
        @for (v of legenda(); track v.codice) {
          <li>
            <strong>{{ v.codice }}</strong> {{ v.testo }}
          </li>
        }
      </ul>
      <ul class="stampa-segni-legenda">
        @for (testo of segni; track testo) {
          <li>{{ testo }}</li>
        }
      </ul>
      <p>{{ testiGriglia.stampa.totali }}: {{ totaliLegenda }}</p>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginaStampa {
  protected readonly testi = testi;
  protected readonly testiGriglia = testiGriglia;
  readonly store = input.required<GrigliaStore>();

  protected readonly segni = Object.values(testiGriglia.stampa.segni);
  protected readonly totaliLegenda = [
    `${testiGriglia.colonne.pianificate} = ${testiGriglia.colonne.pianificateEsteso}`,
    `${testiGriglia.colonne.dovute} = ${testiGriglia.colonne.dovuteEsteso}`,
    `${testiGriglia.colonne.differenza} = ${testiGriglia.colonne.differenzaEsteso}`,
    `${testiGriglia.colonne.reperibilita} = ${testiGriglia.colonne.reperibilitaEsteso}`,
  ].join('; ');

  protected readonly titolo = computed(() => {
    const s = this.store();
    return testiGriglia.stampa.intestazione(s.reparto()?.nome ?? '', s.meseEtichetta());
  });

  protected readonly stato = computed(() => {
    const s = this.store();
    const mese = s.mese();
    const t = testiGriglia.stampa;
    if (mese?.stato === 'convalidato' && mese.convalidatoIlMs !== null) {
      return t.statoConvalidato(
        formattaDataDaMs(mese.convalidatoIlMs),
        formattaOraDaMs(mese.convalidatoIlMs),
        mese.convalidatoDaNome,
      );
    }
    const modifiche = s.modifiche();
    return modifiche > 0
      ? `${t.statoBozza} · ${testiGriglia.fascia.modifiche(modifiche)}`
      : t.statoBozza;
  });

  protected readonly stampatoIl = computed(() => {
    const ora = adessoMs();
    return testiGriglia.stampa.stampatoIl(formattaDataDaMs(ora), formattaOraDaMs(ora));
  });

  /** Le righe con tutti i giorni del mese, qualunque sia la vista a schermo. */
  protected readonly righe = computed<readonly RigaStampa[]>(() => {
    const s = this.store();
    const chiave: ChiaveMese | null = s.chiaveMese();
    if (chiave === null) {
      return [];
    }
    const colonne = s.tuttiIGiorni();
    const vista = configurazioneVista('mese', 1000, colonne.length);
    return s.ordine().flatMap((id) => {
      const stato = s.rigaSignal(id)?.();
      if (stato === undefined) {
        return [];
      }
      const derivati = s.derivatiDi(id);
      const dati = derivati.dati();
      return [
        {
          id,
          nome: dati.nomeCompleto,
          celle: celleDellaRiga({
            nome: dati.nome,
            chiaveMese: chiave,
            colonne,
            contratto: stato.contratto,
            giorni: stato.giorni,
            grezzi: stato.grezzi,
            segnalazioni: derivati.segnalazioni(),
            config: s.configVista(),
            vista,
          }),
          pianificate: dati.totali.pianificate,
          dovute: dati.totali.dovute,
          differenza: dati.totali.differenza,
          reperibilita: dati.totali.reperibilita,
        },
      ];
    });
  });

  /** Turni, fasce e assenze attivi o usati nel mese, con nome e orario. */
  protected readonly legenda = computed<readonly VoceLegenda[]>(() => {
    const s = this.store();
    const usati = new Set<string>();
    for (const r of this.righe()) {
      for (const c of r.celle) {
        if (c.chip !== null) {
          usati.add(c.chip.codice);
        }
        for (const v of c.striscia) {
          usati.add(v.codice);
        }
      }
    }
    const voci: VoceLegenda[] = [];
    for (const t of s.turni()) {
      if (t.attivo || usati.has(t.codice)) {
        voci.push({
          codice: t.codice,
          testo: `${t.nome} ${t.inizio}–${t.fine}${t.tipo === 'reperibilita' ? ' (reperibilità)' : ''}`,
        });
      }
    }
    for (const a of s.assenze()) {
      if (a.attivo || usati.has(a.codice)) {
        voci.push({ codice: a.codice, testo: a.descrizione });
      }
    }
    return voci;
  });

  protected iniziale(giornoSettimana: number): string {
    return testiGriglia.iniziali[giornoSettimana - 1] ?? '';
  }

  protected codiciStriscia(c: CellaVista): string {
    return c.striscia.map((v) => v.codice).join(' ');
  }

  protected classeColonna(c: { tipo: string; festivita: unknown }): string {
    return `stampa-giorno${c.tipo === 'sabato' || c.tipo === 'domenica' ? ' stampa-weekend' : ''}${c.festivita ? ' stampa-festivo' : ''}`;
  }

  protected classeCella(
    c: CellaVista,
    colonna: Parameters<typeof sfondoDiColonna>[0] | undefined,
  ): string {
    const sfondo = colonna === undefined ? 'feriale' : sfondoDiColonna(colonna);
    return `stampa-giorno stampa-cella${sfondo === 'weekend' ? ' stampa-weekend' : ''}${sfondo === 'festivo' ? ' stampa-festivo' : ''}${c.fuoriServizio !== null ? ' stampa-fuori-servizio' : ''}`;
  }
}

/**
 * Collega la pagina alla stampa del browser: a `beforeprint` crea la tabella di stampa dentro `<body>`, a
 * `afterprint` la toglie. Così `Ctrl+P`, il pulsante «Stampa» e il menu del browser stampano allo stesso modo.
 */
@Injectable({ providedIn: 'root' })
export class StampaMese {
  private readonly documento = inject(DOCUMENT);
  private readonly appRef = inject(ApplicationRef);
  private readonly iniettore = inject(EnvironmentInjector);

  /** Da chiamare nel costruttore della pagina: si scollega da solo alla distruzione. */
  collega(store: GrigliaStore, distruzione: DestroyRef): void {
    const finestra = this.documento.defaultView;
    if (finestra === null) {
      return;
    }
    let corrente: { ref: ComponentRef<PaginaStampa>; host: HTMLElement } | null = null;
    const rimuovi = (): void => {
      if (corrente !== null) {
        this.appRef.detachView(corrente.ref.hostView);
        corrente.ref.destroy();
        corrente.host.remove();
        corrente = null;
      }
    };
    const prepara = (): void => {
      rimuovi();
      if (store.mese() === null) {
        return;
      }
      const host = this.documento.createElement('div');
      host.className = 'stampa-radice';
      this.documento.body.appendChild(host);
      const ref = createComponent(PaginaStampa, {
        environmentInjector: this.iniettore,
        hostElement: host,
      });
      ref.setInput('store', store);
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
      corrente = { ref, host };
    };
    finestra.addEventListener('beforeprint', prepara);
    finestra.addEventListener('afterprint', rimuovi);
    distruzione.onDestroy(() => {
      finestra.removeEventListener('beforeprint', prepara);
      finestra.removeEventListener('afterprint', rimuovi);
      rimuovi();
    });
  }

  /** «Stampa» dal pulsante: apre il dialogo di stampa del browser (anche «Salva come PDF»). */
  stampa(): void {
    this.documento.defaultView?.print();
  }
}
