import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { meseCorrente } from '@turni/domain';
import { RepartoCorrente } from '../core/reparto-corrente';
import { Sessione } from '../core/sessione.service';
import { testi } from '../testi/it';
import { Icona, type NomeIcona } from '../ui/icona';
import { Tooltip } from '../ui/tooltip';

interface VoceMenu {
  readonly etichetta: string;
  readonly icona: NomeIcona;
  readonly link: string;
  /** Il link è attivo anche sulle rotte figlie. */
  readonly esatto: boolean;
}

/**
 * Menu laterale (UX §3): «Home»; il gruppo del reparto corrente; poi «Report di tutti i reparti» (solo ADMIN),
 * «Registro attività» e «Utenti» (solo ADMIN). Esteso (208 px, icona e testo) o ridotto (48 px, sola icona
 * con suggerimento e `aria-label`).
 */
@Component({
  selector: 'app-navigazione',
  imports: [Icona, NgTemplateOutlet, RouterLink, RouterLinkActive, Tooltip],
  template: `
    <nav
      id="navigazione-principale"
      [attr.aria-label]="testi.layout.navigazionePrincipale"
      class="flex h-full flex-col gap-1 overflow-y-auto border-r border-bordo bg-sfondo py-2"
      [class.w-menu-esteso]="esteso()"
      [class.w-menu-ridotto]="!esteso()"
    >
      <ul class="flex flex-col gap-1 px-1">
        <ng-container *ngTemplateOutlet="voce; context: { v: home }" />
      </ul>

      @if (reparto(); as r) {
        <div class="mt-2 px-1">
          @if (esteso()) {
            <p class="truncate px-2 pb-1 text-nota font-semibold text-testo-secondario">{{ r.nome }}</p>
          } @else {
            <hr class="mx-2 border-bordo" />
          }
          <ul class="flex flex-col gap-1" [attr.aria-label]="r.nome">
            @for (v of vociReparto(); track v.link) {
              <ng-container *ngTemplateOutlet="voce; context: { v }" />
            }
          </ul>
        </div>
      }

      <ul class="mt-2 flex flex-col gap-1 px-1">
        @for (v of vociGlobali(); track v.link) {
          <ng-container *ngTemplateOutlet="voce; context: { v }" />
        }
      </ul>
    </nav>

    <ng-template #voce let-v="v">
      <li>
        <a
          [routerLink]="v.link"
          routerLinkActive="bg-nota-sfondo font-semibold text-nota"
          [routerLinkActiveOptions]="{ exact: v.esatto }"
          ariaCurrentWhenActive="page"
          [attr.aria-label]="esteso() ? null : v.etichetta"
          [appTooltip]="esteso() ? '' : v.etichetta"
          class="flex h-controllo items-center gap-3 rounded-campo px-2 hover:bg-sfondo-neutro"
        >
          <app-icona [nome]="v.icona" />
          @if (esteso()) {
            <span class="truncate">{{ v.etichetta }}</span>
          }
        </a>
      </li>
    </ng-template>
  `,
  host: { class: 'block shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Navigazione {
  protected readonly testi = testi;
  private readonly sessione = inject(Sessione);
  private readonly corrente = inject(RepartoCorrente);

  readonly esteso = input.required<boolean>();

  protected readonly reparto = this.corrente.reparto;

  protected readonly home: VoceMenu = {
    etichetta: testi.menu.home,
    icona: 'home',
    link: '/home',
    esatto: true,
  };

  protected readonly vociReparto = computed<readonly VoceMenu[]>(() => {
    const id = this.corrente.id();
    if (id === null) {
      return [];
    }
    const base = `/reparti/${id}`;
    return [
      { etichetta: testi.menu.pianificazione, icona: 'griglia', link: `${base}/mesi/${meseCorrente()}`, esatto: false },
      { etichetta: testi.menu.bancaOre, icona: 'banca', link: `${base}/banca-ore`, esatto: false },
      { etichetta: testi.menu.report, icona: 'report', link: `${base}/report`, esatto: false },
      { etichetta: testi.menu.dipendenti, icona: 'dipendenti', link: `${base}/dipendenti`, esatto: false },
      { etichetta: testi.menu.configurazione, icona: 'configurazione', link: `${base}/configurazione`, esatto: false },
    ];
  });

  protected readonly vociGlobali = computed<readonly VoceMenu[]>(() => {
    const voci: VoceMenu[] = [];
    if (this.sessione.ruolo() === 'ADMIN') {
      voci.push({ etichetta: testi.menu.reportTutti, icona: 'report', link: '/report', esatto: true });
    }
    voci.push({ etichetta: testi.menu.registro, icona: 'registro', link: '/registro', esatto: true });
    if (this.sessione.ruolo() === 'ADMIN') {
      voci.push({ etichetta: testi.menu.utenti, icona: 'utenti', link: '/utenti', esatto: true });
    }
    return voci;
  });
}
