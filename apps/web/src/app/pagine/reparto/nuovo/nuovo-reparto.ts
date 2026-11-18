import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Sessione } from '../../../core/sessione.service';
import { ConfigurazioneRepo } from '../../../dati/configurazione.repo';
import { ElencoReparti } from '../../../dati/elenco-reparti';
import { testi } from '../../../testi/it';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { IndicatorePassi } from '../indicatore-passi';

/**
 * Passo 1 della creazione guidata (`/reparti/nuovo`, UX §7.3): il nome del reparto. «Crea reparto» scrive in
 * un batch il reparto (`passo: 'turni'`) con le assenze predefinite R e MA e porta al passo 2.
 */
@Component({
  selector: 'app-nuovo-reparto',
  imports: [Button, IndicatorePassi, Input, RouterLink],
  template: `
    <h1 class="mb-4 text-titolo-pagina">{{ testi.nuovoReparto.titolo }}</h1>
    <div class="mb-6"><app-indicatore-passi [corrente]="1" /></div>
    <form class="flex max-w-lg flex-col gap-4" novalidate (submit)="crea($event)">
      <app-input
        #campoNome
        [etichetta]="testi.nuovoReparto.etichetta"
        [obbligatorio]="true"
        [lunghezzaMassima]="60"
        [(valore)]="nome"
        [errore]="errore()"
        [disabilitato]="inCorso()"
      />
      <div class="flex gap-2">
        <a appButton routerLink="/home">{{ testi.nuovoReparto.annulla }}</a>
        <button appButton type="submit" variante="primario" [caricamento]="inCorso()">
          {{ testi.nuovoReparto.crea }}
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuovoReparto {
  protected readonly testi = testi;
  private readonly repo = inject(ConfigurazioneRepo);
  private readonly sessione = inject(Sessione);
  private readonly elenco = inject(ElencoReparti);
  private readonly router = inject(Router);

  protected readonly nome = signal('');
  protected readonly errore = signal<string | null>(null);
  protected readonly inCorso = signal(false);
  private readonly campoNome = viewChild.required<Input>('campoNome');

  protected async crea(evento: Event): Promise<void> {
    evento.preventDefault();
    if (this.inCorso()) {
      return;
    }
    const nome = this.nome().trim();
    const utente = this.sessione.utente();
    if (nome === '' || nome.length > 60) {
      this.errore.set(testi.nuovoReparto.nomeNonValido);
      this.campoNome().focalizza();
      return;
    }
    if (utente === null) {
      return;
    }
    this.errore.set(null);
    this.inCorso.set(true);
    try {
      const id = await this.repo.creaReparto(utente.uid, nome);
      await this.elenco.carica(true);
      await this.router.navigate(['/reparti', id, 'configurazione']);
    } catch {
      this.errore.set(testi.nuovoReparto.errore);
    } finally {
      this.inCorso.set(false);
    }
  }
}
