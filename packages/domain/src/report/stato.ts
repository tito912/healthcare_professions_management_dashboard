// Stato di un report bimestrale: «inviato» e avviso della Home «report non inviato» (UX §7.2, L15). Funzioni pure.
import type { EsitoInvio } from '../documenti';
import type { ChiaveMese, IdBimestre } from '../tipi';

/**
 * Il report è stato inviato se è partito l'invio automatico o se almeno una email è stata accodata a mano. Chi non
 * ha email (`senzaEmail`) o ha dato errore non basta.
 */
export function reportInviato(
  invioAutomatico: boolean,
  esiti: readonly EsitoInvio['esito'][],
): boolean {
  return invioAutomatico || esiti.some((esito) => esito === 'accodato');
}

export interface StatoReportBimestre {
  readonly idBimestre: IdBimestre;
  readonly inviato: boolean;
  /** I due mesi del bimestre: lo stato, o null se il mese non è stato creato. */
  readonly mesi: readonly {
    readonly chiave: ChiaveMese;
    readonly stato: 'bozza' | 'convalidato' | null;
  }[];
}

export type AvvisoReport =
  | { readonly tipo: 'meseNonConvalidato'; readonly mesi: readonly ChiaveMese[] }
  | { readonly tipo: 'nonInviato' };

/**
 * L'avviso per il bimestre dovuto: nessuno se è già inviato o se non c'è alcun mese creato (non c'è niente da
 * inviare); «mese non convalidato» se manca una convalida (un mese non creato conta come non convalidato, L15);
 * altrimenti «non inviato».
 */
export function avvisoReportNonInviato(stato: StatoReportBimestre): AvvisoReport | null {
  if (stato.inviato || stato.mesi.every((mese) => mese.stato === null)) {
    return null;
  }
  const mancanti = stato.mesi.filter((mese) => mese.stato !== 'convalidato').map((m) => m.chiave);
  return mancanti.length > 0
    ? { tipo: 'meseNonConvalidato', mesi: mancanti }
    : { tipo: 'nonInviato' };
}
