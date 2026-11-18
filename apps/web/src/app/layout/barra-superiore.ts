import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formattaMese } from '@turni/domain';
import { ContestoRoute } from '../core/contesto-route';
import { Sessione } from '../core/sessione.service';
import { ElencoReparti } from '../dati/elenco-reparti';
import type { RepartoSintesi } from '../dati/reparti.repo';
import { testi } from '../testi/it';
import { Button } from '../ui/button';
import { Icona } from '../ui/icona';
import { Menu, MenuGruppo, MenuVoce } from '../ui/menu';
import { Tooltip } from '../ui/tooltip';

interface GruppoReparti {
  readonly chiave: string;
  readonly etichetta: string;
  readonly reparti: readonly RepartoSintesi[];
}

/**
 * Barra superiore (UX §3, 48 px): pulsante del menu, nome dell'applicazione, percorso con il selettore del
 * reparto come primo elemento, nome e ruolo dell'utente, «Esci».
 */
@Component({
  selector: 'app-barra-superiore',
  imports: [Button, Icona, Menu, MenuVoce, MenuGruppo, RouterLink, Tooltip],
  template: `
    <header
      class="flex h-barra items-center gap-3 border-b border-bordo bg-sfondo px-3"
    >
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-campo hover:bg-sfondo-neutro"
        [attr.aria-label]="menuEsteso() ? testi.layout.riduciMenu : testi.layout.apriMenu"
        [attr.aria-expanded]="menuEsteso()"
        aria-controls="navigazione-principale"
        [appTooltip]="menuEsteso() ? testi.layout.riduciMenu : testi.layout.apriMenu"
        (click)="alternaMenu.emit()"
      >
        <app-icona nome="menu" />
      </button>
      <a routerLink="/home" class="rounded-campo font-semibold whitespace-nowrap">
        {{ testi.app.nomeBreve }}
      </a>

      <nav [attr.aria-label]="testi.layout.percorso" class="min-w-0 flex-1">
        <ol class="flex items-center gap-1 text-testo">
          @if (repartoDelPercorso(); as reparto) {
            <li>
              <app-menu
                [etichetta]="testi.layout.cambiaReparto"
                [testo]="reparto.nome"
                icona="freccia"
                [bordo]="true"
              >
                @for (gruppo of gruppi(); track gruppo.chiave) {
                  @if (gruppi().length > 1 || mostraTitoliGruppo()) {
                    <app-menu-gruppo [etichetta]="gruppo.etichetta">
                      @for (r of gruppo.reparti; track r.id) {
                        <button appMenuVoce [selezionata]="r.id === reparto.id" (click)="cambiaReparto(r.id)">
                          @if (r.id === reparto.id) {
                            <app-icona nome="spunta" />
                          }
                          {{ r.nome }}
                        </button>
                      }
                    </app-menu-gruppo>
                  } @else {
                    @for (r of gruppo.reparti; track r.id) {
                      <button appMenuVoce [selezionata]="r.id === reparto.id" (click)="cambiaReparto(r.id)">
                        @if (r.id === reparto.id) {
                          <app-icona nome="spunta" />
                        }
                        {{ r.nome }}
                      </button>
                    }
                  }
                }
              </app-menu>
            </li>
          } @else if (repartoId() !== null) {
            <li class="px-2">{{ testi.layout.selettoreReparto }}</li>
          }
          @for (voce of voci(); track $index; let ultima = $last) {
            <li class="flex items-center gap-1">
              @if (repartoId() !== null || $index > 0) {
                <span aria-hidden="true" class="text-testo-secondario">›</span>
              }
              <span [attr.aria-current]="ultima ? 'page' : null" [class.font-semibold]="ultima" class="px-1">
                {{ voce }}
              </span>
            </li>
          }
        </ol>
      </nav>

      <div class="flex items-center gap-3 whitespace-nowrap">
        <p>
          <span class="font-medium">{{ sessione.nomeCompleto() }}</span>
          <span class="text-testo-secondario"> · {{ ruoloEtichetta() }}</span>
        </p>
        <button appButton type="button" (click)="esci()">{{ testi.layout.esci }}</button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarraSuperiore {
  protected readonly testi = testi;
  protected readonly sessione = inject(Sessione);
  private readonly contesto = inject(ContestoRoute);
  private readonly elenco = inject(ElencoReparti);
  private readonly router = inject(Router);

  readonly menuEsteso = input.required<boolean>();
  readonly alternaMenu = output<void>();

  protected readonly repartoId = this.contesto.repartoId;

  protected readonly ruoloEtichetta = computed(() => {
    const ruolo = this.sessione.ruolo();
    return ruolo === null ? '' : testi.ruoli[ruolo];
  });

  /** Reparto mostrato nel selettore: solo dentro un reparto (UX §3). */
  protected readonly repartoDelPercorso = computed(() => {
    const id = this.repartoId();
    if (id === null) {
      return null;
    }
    return (
      this.elenco.reparti().find((reparto) => reparto.id === id) ?? {
        id,
        nome: testi.layout.selettoreReparto,
        coordinatoreUid: '',
        passo: 'completata' as const,
      }
    );
  });

  protected readonly mostraTitoliGruppo = computed(() => this.sessione.ruolo() === 'ADMIN');

  /** Per il coordinatore un solo gruppo; per l'ADMIN un gruppo per coordinatore (UX §3). */
  protected readonly gruppi = computed<readonly GruppoReparti[]>(() => {
    const reparti = this.elenco.reparti();
    if (this.sessione.ruolo() !== 'ADMIN') {
      return [{ chiave: 'propri', etichetta: '', reparti }];
    }
    const perCoordinatore = new Map<string, RepartoSintesi[]>();
    for (const reparto of reparti) {
      perCoordinatore.set(reparto.coordinatoreUid, [
        ...(perCoordinatore.get(reparto.coordinatoreUid) ?? []),
        reparto,
      ]);
    }
    const utenti = this.elenco.utentePerUid();
    return [...perCoordinatore.entries()]
      .map(([uid, elencoReparti]) => {
        const utente = utenti.get(uid);
        return {
          chiave: uid,
          etichetta: utente ? `${utente.nome} ${utente.cognome}` : testi.layout.coordinatoreSconosciuto,
          reparti: elencoReparti,
        };
      })
      .sort((a, b) => a.etichetta.localeCompare(b.etichetta, 'it'));
  });

  /** Voci del percorso dopo il selettore del reparto (o l'unica voce fuori da un reparto). */
  protected readonly voci = computed<readonly string[]>(() => {
    if (this.repartoId() !== null) {
      const sezione = this.contesto.sezione();
      const voci: string[] = [];
      if (sezione !== null) {
        voci.push(testi.reparto.sezioni[sezione]);
      }
      const mese = this.contesto.chiaveMese();
      if (mese !== null) {
        voci.push(formattaMese(mese));
      }
      return voci;
    }
    if (this.contesto.eNuovoReparto()) {
      return [testi.percorso.nuovoReparto];
    }
    switch (this.contesto.radice()) {
      case 'home':
        return [testi.percorso.home];
      case 'utenti':
        return [testi.percorso.utenti];
      case 'registro':
        return [testi.percorso.registro];
      case 'report':
        return [testi.percorso.reportTutti];
      case 'errore':
        return [testi.percorso.errore];
      default:
        return [testi.percorso.nonTrovata];
    }
  });

  /** Cambiare reparto porta alla stessa sezione dell'altro reparto. */
  protected cambiaReparto(nuovoId: string): void {
    const sezione = this.contesto.sezione();
    const parti = ['/reparti', nuovoId];
    if (sezione !== null) {
      parti.push(sezione);
      const mese = this.contesto.chiaveMese();
      if (sezione === 'mesi' && mese !== null) {
        parti.push(mese);
      }
    }
    void this.router.navigateByUrl(parti.join('/'));
  }

  protected esci(): void {
    void this.sessione.esci();
  }
}
