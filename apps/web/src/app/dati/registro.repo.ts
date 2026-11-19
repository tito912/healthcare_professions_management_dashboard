import { Injectable } from '@angular/core';
import { serviziFirebase } from '../core/firebase';
import {
  sorgenteRegistro,
  type FiltriRegistro,
  type FonteRegistro,
  type VoceRegistro,
} from './registro.firestore';
import { PaginatoreUnito } from './registro.paginatore';

export type { FiltriRegistro, FonteRegistro, VoceRegistro } from './registro.firestore';
export { AUTORE_SISTEMA } from './registro.firestore';

/** Pagine del registro (50 voci, più recenti prima). Sola lettura: lo scrivono solo le Functions. */
export const VOCI_PER_PAGINA = 50;

/** Ordine: più recente prima; a pari istante, per ID, così l'ordine è stabile tra le sorgenti. */
function piuRecente(a: VoceRegistro, b: VoceRegistro): number {
  return b.ilMs - a.ilMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

@Injectable({ providedIn: 'root' })
export class RegistroRepo {
  /** Un paginatore nuovo per ogni combinazione di filtri; `successiva()` restituisce la pagina seguente. */
  apri(fonti: readonly FonteRegistro[], filtri: FiltriRegistro): PaginatoreUnito<VoceRegistro> {
    const { db } = serviziFirebase();
    return new PaginatoreUnito(
      fonti.map((fonte) => sorgenteRegistro(db, fonte, filtri)),
      piuRecente,
      VOCI_PER_PAGINA,
    );
  }
}
