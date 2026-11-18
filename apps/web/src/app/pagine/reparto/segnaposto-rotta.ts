import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Segnaposto } from './segnaposto';

/** Legge il titolo dai dati della rotta e lo passa alla pagina segnaposto. */
@Component({
  selector: 'app-segnaposto-rotta',
  imports: [Segnaposto],
  template: `<app-segnaposto [titolo]="titolo" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegnapostoRotta {
  protected readonly titolo = String(inject(ActivatedRoute).snapshot.data['titolo'] ?? '');
}
