// Paginazione del registro attività su più sorgenti (UX §7.12). Il coordinatore con più reparti legge una raccolta per
// reparto: ogni sorgente è già ordinata dalla più recente e questa classe le fonde, pagina per pagina, senza leggere
// più del necessario. Pura: non conosce Firestore.

/** Sorgente ordinata dalla voce più recente: restituisce al massimo `quante` voci a ogni chiamata, poi continua. */
export interface SorgentePagina<T> {
  carica(quante: number): Promise<{ readonly elementi: readonly T[]; readonly esaurita: boolean }>;
}

export interface PaginaUnita<T> {
  readonly elementi: readonly T[];
  /** Vero se potrebbero esserci altre voci (una nuova chiamata a `successiva`). */
  readonly ancora: boolean;
}

interface Buffer<T> {
  readonly sorgente: SorgentePagina<T>;
  coda: T[];
  esaurita: boolean;
}

export class PaginatoreUnito<T> {
  private readonly buffer: Buffer<T>[];

  /** `piuRecente(a, b)` è negativo se `a` viene prima di `b`. */
  constructor(
    sorgenti: readonly SorgentePagina<T>[],
    private readonly piuRecente: (a: T, b: T) => number,
    private readonly dimensione = 50,
  ) {
    this.buffer = sorgenti.map((sorgente) => ({ sorgente, coda: [], esaurita: false }));
  }

  private async riempi(buffer: Buffer<T>): Promise<void> {
    if (buffer.coda.length === 0 && !buffer.esaurita) {
      const letti = await buffer.sorgente.carica(this.dimensione);
      buffer.coda.push(...letti.elementi);
      buffer.esaurita = letti.esaurita || letti.elementi.length === 0;
    }
  }

  async successiva(): Promise<PaginaUnita<T>> {
    const elementi: T[] = [];
    while (elementi.length < this.dimensione) {
      await Promise.all(this.buffer.map((b) => this.riempi(b)));
      let scelto: Buffer<T> | null = null;
      for (const b of this.buffer) {
        const testa = b.coda[0];
        const migliore = scelto?.coda[0];
        if (
          testa !== undefined &&
          (migliore === undefined || this.piuRecente(testa, migliore) < 0)
        ) {
          scelto = b;
        }
      }
      const prossimo = scelto?.coda.shift();
      if (prossimo === undefined) {
        break;
      }
      elementi.push(prossimo);
    }
    return { elementi, ancora: this.buffer.some((b) => b.coda.length > 0 || !b.esaurita) };
  }
}
