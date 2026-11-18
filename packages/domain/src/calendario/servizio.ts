// Giorni di servizio di un dipendente (ARCHITETTURA §5.5, L35): tra assunzione e cessazione, estremi compresi.
import type { ChiaveMese, DataISO } from '../tipi';
import { giorniDelMese } from './mesi';

/** Le due date che decidono il servizio: quelle del dipendente o quelle copiate nella riga (`contratto`). */
export interface PeriodoServizio {
  readonly dataAssunzione: DataISO | null;
  readonly dataCessazione: DataISO | null;
}

/** In servizio il giorno `data`: assunto entro quel giorno e non cessato prima. */
export function inServizioIl(periodo: PeriodoServizio, data: DataISO): boolean {
  return (
    (periodo.dataAssunzione === null || periodo.dataAssunzione <= data) &&
    (periodo.dataCessazione === null || data <= periodo.dataCessazione)
  );
}

/** I giorni del mese in cui il dipendente è in servizio. */
export function giorniDiServizio(periodo: PeriodoServizio, chiave: ChiaveMese): readonly DataISO[] {
  return giorniDelMese(chiave).filter((data) => inServizioIl(periodo, data));
}

/** In servizio almeno un giorno del mese: chi riceve una riga con «Aggiungi mese». */
export function inServizioNelMese(periodo: PeriodoServizio, chiave: ChiaveMese): boolean {
  const giorni = giorniDelMese(chiave);
  const primo = giorni[0];
  const ultimo = giorni.at(-1);
  if (primo === undefined || ultimo === undefined) {
    return false;
  }
  return (
    (periodo.dataAssunzione === null || periodo.dataAssunzione <= ultimo) &&
    (periodo.dataCessazione === null || primo <= periodo.dataCessazione)
  );
}

/** I dipendenti in servizio almeno un giorno del mese, nell'ordine ricevuto. */
export function dipendentiInServizio<T extends PeriodoServizio>(
  chiave: ChiaveMese,
  dipendenti: readonly T[],
): T[] {
  return dipendenti.filter((dipendente) => inServizioNelMese(dipendente, chiave));
}
