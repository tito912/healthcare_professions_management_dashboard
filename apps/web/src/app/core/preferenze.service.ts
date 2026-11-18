import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export interface PreferenzeUtente {
  /** ID dell'ultimo reparto aperto (U1). */
  readonly ultimoRepartoId: string | null;
  /** Menu laterale esteso (208 px) o ridotto (48 px). */
  readonly menuEsteso: boolean;
}

const PREDEFINITE: PreferenzeUtente = { ultimoRepartoId: null, menuEsteso: true };

/**
 * Preferenze per utente in `localStorage` (`turni.preferenze.<uid>`, L25). Lettura e scrittura in try/catch:
 * se il browser rifiuta l'archivio si usa il comportamento predefinito. Non contiene dati personali.
 */
@Injectable({ providedIn: 'root' })
export class Preferenze {
  private readonly documento = inject(DOCUMENT);

  leggi(uid: string): PreferenzeUtente {
    try {
      const grezzo = this.documento.defaultView?.localStorage.getItem(this.chiave(uid));
      if (!grezzo) {
        return PREDEFINITE;
      }
      const valore: unknown = JSON.parse(grezzo);
      if (typeof valore !== 'object' || valore === null) {
        return PREDEFINITE;
      }
      const ultimo = 'ultimoRepartoId' in valore ? valore.ultimoRepartoId : null;
      const esteso = 'menuEsteso' in valore ? valore.menuEsteso : true;
      return {
        ultimoRepartoId: typeof ultimo === 'string' && ultimo !== '' ? ultimo : null,
        menuEsteso: typeof esteso === 'boolean' ? esteso : true,
      };
    } catch {
      return PREDEFINITE;
    }
  }

  imposta(uid: string, modifica: Partial<PreferenzeUtente>): void {
    try {
      const nuove: PreferenzeUtente = { ...this.leggi(uid), ...modifica };
      this.documento.defaultView?.localStorage.setItem(this.chiave(uid), JSON.stringify(nuove));
    } catch {
      // Archivio rifiutato o pieno: le preferenze valgono solo per questa visita.
    }
  }

  private chiave(uid: string): string {
    return `turni.preferenze.${uid}`;
  }
}
