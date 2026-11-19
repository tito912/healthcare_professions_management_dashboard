// Stato di un report bimestrale: «inviato» e avviso della Home «report non inviato» (UX §7.2, L15). Funzioni pure.
import { mesiDelBimestre } from '../calendario/bimestri';
import type { EsitoInvio } from '../documenti';
import type { ChiaveMese, IdBimestre } from '../tipi';

/**
 * Il report è stato inviato se è partito l'invio automatico (che si rilascia se qualche email va in errore) oppure se
 * c'è almeno un esito e nessuno è `errore`: chi ha dato errore va ritentato, quindi l'avviso resta. Se nessun
 * dipendente ha email (tutti `senzaEmail`) non c'è nulla da fare e il report conta come evaso.
 */
export function reportInviato(
  invioAutomatico: boolean,
  esiti: readonly EsitoInvio['esito'][],
): boolean {
  return invioAutomatico || (esiti.length > 0 && esiti.every((esito) => esito !== 'errore'));
}

/** Un invio copre il bimestre se comprendeva entrambi i mesi (un invio con un mese in bozza è parziale). */
export function copreIlBimestre(
  mesiInclusi: readonly ChiaveMese[],
  idBimestre: IdBimestre,
): boolean {
  return mesiDelBimestre(idBimestre).every((mese) => mesiInclusi.includes(mese));
}

/**
 * Come `reportInviato`, ma un invio che non copre il bimestre (fatto con un solo mese convalidato) vale come da
 * rifare: l'avviso resta finché non parte il report completo.
 */
export function reportInviatoPerBimestre(
  invioAutomatico: boolean,
  idBimestre: IdBimestre,
  invii: readonly {
    readonly esito: EsitoInvio['esito'];
    readonly mesiInclusi: readonly ChiaveMese[];
  }[],
): boolean {
  return reportInviato(
    invioAutomatico,
    invii.map((invio) =>
      invio.esito !== 'errore' && !copreIlBimestre(invio.mesiInclusi, idBimestre)
        ? 'errore'
        : invio.esito,
    ),
  );
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
