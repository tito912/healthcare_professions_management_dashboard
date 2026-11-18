import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tabella semantica con lo stile di UX §4 (righe e intestazioni da 36 px, 13/18).
 * Uso: `<app-table etichetta="Coordinatori"><thead>…</thead><tbody>…</tbody></app-table>`.
 * L'etichetta è la didascalia letta dagli screen reader (non visibile).
 */
@Component({
  selector: 'app-table',
  template: `
    <table
      class="w-full border-collapse text-left text-tabella [&_td]:h-riga [&_td]:border-b [&_td]:border-bordo [&_td]:px-3 [&_th]:h-riga [&_th]:border-b [&_th]:border-bordo [&_thead_th]:bg-sfondo-neutro [&_th]:px-3 [&_th]:font-semibold"
    >
      <caption class="sr-only">
        {{
          etichetta()
        }}
      </caption>
      <ng-content />
    </table>
  `,
  host: { class: 'block overflow-x-auto rounded-pannello border border-bordo bg-sfondo' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Table {
  readonly etichetta = input.required<string>();
}

/** Righe grigie al posto della tabella durante un caricamento (UX §6). */
@Component({
  selector: 'app-table-scheletro',
  template: `
    <div class="rounded-pannello border border-bordo bg-sfondo" aria-hidden="true">
      @for (riga of righeVuote(); track $index) {
        <div class="flex h-riga items-center border-b border-bordo px-3 last:border-b-0">
          <div
            class="h-3 w-1/3 animate-pulse rounded-campo bg-sfondo-neutro motion-reduce:animate-none"
          ></div>
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableScheletro {
  readonly righe = input<number>(4);
  protected righeVuote(): number[] {
    return Array.from({ length: this.righe() }, (_, indice) => indice);
  }
}
