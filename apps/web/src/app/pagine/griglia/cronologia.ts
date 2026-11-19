// Annulla e ripristina (UX §9.7): un passo per operazione (un inserimento, un tratto di pennello, un incolla,
// una scelta dal menu), al massimo 200 passi. La cronologia sopravvive al salvataggio e si azzera cambiando mese.
import type { CellaDoc, ChiaveGiorno } from '@turni/domain';

/** La variazione di una cella: `null` = cella vuota. */
export interface ModificaCella {
  readonly dipendenteId: string;
  readonly giorno: ChiaveGiorno;
  readonly prima: CellaDoc | null;
  readonly dopo: CellaDoc | null;
}

export type Passo = readonly ModificaCella[];

export const MAX_PASSI_CRONOLOGIA = 200;

export class Cronologia {
  private passi: Passo[] = [];
  /** Numero di passi applicati: quelli oltre l'indice sono ripristinabili. */
  private indice = 0;

  registra(passo: Passo): void {
    if (passo.length === 0) {
      return;
    }
    this.passi = [...this.passi.slice(0, this.indice), passo].slice(-MAX_PASSI_CRONOLOGIA);
    this.indice = this.passi.length;
  }

  puoAnnullare(): boolean {
    return this.indice > 0;
  }

  puoRipristinare(): boolean {
    return this.indice < this.passi.length;
  }

  /** Il passo da annullare (l'ultimo applicato), o null. Chi chiama riporta le celle a `prima`. */
  annulla(): Passo | null {
    if (!this.puoAnnullare()) {
      return null;
    }
    this.indice -= 1;
    return this.passi[this.indice] ?? null;
  }

  /** Il passo da ripetere, o null. Chi chiama riporta le celle a `dopo`. */
  ripristina(): Passo | null {
    if (!this.puoRipristinare()) {
      return null;
    }
    const passo = this.passi[this.indice] ?? null;
    this.indice += 1;
    return passo;
  }

  azzera(): void {
    this.passi = [];
    this.indice = 0;
  }

  get lunghezza(): number {
    return this.passi.length;
  }
}
