import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { formattaMese } from '@turni/domain';
import { RepartiRepo } from '../../dati/reparti.repo';
import { testi } from '../../testi/it';
import { Spinner } from '../../ui/spinner';

/**
 * Pagina segnaposto della griglia del mese (schermata 5): la griglia vera arriva con lo step 2.2.
 * Legge il reparto con le regole del ruolo: chi non può leggerlo vede «Reparto non disponibile».
 */
@Component({
  selector: 'app-griglia-segnaposto',
  imports: [Spinner],
  template: `
    @if (reparto.isLoading()) {
      <app-spinner />
    } @else if (reparto.value(); as r) {
      <h1 class="mb-2 text-titolo-pagina">{{ testi.reparto.pianificazioneTitolo(r.nome, meseEtichetta()) }}</h1>
      <p class="text-testo-secondario">{{ testi.reparto.pianificazioneSegnaposto }}</p>
    } @else {
      <h1 class="mb-2 text-titolo-pagina">{{ testi.reparto.nonDisponibile }}</h1>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrigliaSegnaposto {
  protected readonly testi = testi;
  private readonly rotta = inject(ActivatedRoute);
  private readonly repository = inject(RepartiRepo);

  private readonly parametri = toSignal(this.rotta.paramMap, {
    initialValue: this.rotta.snapshot.paramMap,
  });
  protected readonly meseEtichetta = computed(() =>
    formattaMese(this.parametri().get('chiaveMese') ?? ''),
  );
  protected readonly reparto = resource({
    params: () => this.parametri().get('rid') ?? '',
    loader: ({ params }) => this.repository.leggi(params),
  });
}
