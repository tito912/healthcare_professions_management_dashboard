// Ricalcolo del riepilogo mensile di un dipendente (ARCHITETTURA §8, `aggiornaRiepilogo`). Non usa i dati
// dell'evento: rilegge mese, riga e righe adiacenti dello stesso dipendente e ricalcola con `calcolaRiepilogo()`.
// Lettura, calcolo e scrittura stanno in una transazione: i riepiloghi dei mesi N-1, N e N+1 di uno stesso
// dipendente dipendono da righe in comune (il riposo a cavallo di mese), e senza transazione un trigger
// potrebbe scrivere per ultimo dati letti prima di un altro. Il risultato è una funzione dei soli documenti
// letti: rieseguire dà lo stesso documento (tranne `calcolatoIl`). Un riepilogo già `convalidato` di un mese
// convalidato non si riscrive mai (definitivo). Due righe dello stesso mese di dipendenti
// diversi toccano documenti diversi e non si incontrano.
import {
  calcolaRiepilogo,
  spostaMese,
  type ChiaveMese,
  type RiepilogoCalcolato,
  type RiepilogoMensileDoc,
} from '@turni/domain';
import { db, oraServer, type InScrittura } from '../comune/admin';
import { giorniDi, leggiMese, leggiRiga } from './lettura';
import { rifMese, rifRiga, rifRiepilogo } from './rif';

/** Il riepilogo scritto, o null se il mese o la riga non esistono (nessun riepilogo senza una riga). */
export async function ricalcolaRiepilogo(
  repartoId: string,
  dipendenteId: string,
  chiaveMese: ChiaveMese,
): Promise<RiepilogoCalcolato | null> {
  const riferimentoRiepilogo = rifRiepilogo(repartoId, chiaveMese, dipendenteId);
  return db().runTransaction(async (transazione) => {
    const [mese, esistente, riga, precedente, successiva] = await Promise.all([
      transazione.get(rifMese(repartoId, chiaveMese)),
      transazione.get(riferimentoRiepilogo),
      transazione.get(rifRiga(repartoId, chiaveMese, dipendenteId)),
      transazione.get(rifRiga(repartoId, spostaMese(chiaveMese, -1), dipendenteId)),
      transazione.get(rifRiga(repartoId, spostaMese(chiaveMese, 1), dipendenteId)),
    ]);
    const meseLetto = leggiMese(mese);
    if (meseLetto === null) {
      return null;
    }
    const rigaLetta = leggiRiga(riga);
    if (rigaLetta === null) {
      transazione.delete(riferimentoRiepilogo);
      return null;
    }
    // Un mese convalidato ha il riepilogo definitivo (D2): lo scrive solo la convalida, che lo trova ancora in
    // bozza. Le modifiche alla riga di un mese adiacente non lo toccano più; la riapertura a mano (mese in
    // bozza) lo ricalcola di nuovo.
    if (meseLetto.stato === 'convalidato' && esistente.get('statoMese') === 'convalidato') {
      return null;
    }
    const calcolato = calcolaRiepilogo({
      riga: rigaLetta,
      chiaveMese,
      statoMese: meseLetto.stato,
      calendario: meseLetto.calendario,
      righeAdiacenti: { precedente: giorniDi(precedente), successiva: giorniDi(successiva) },
    });
    const documento: InScrittura<RiepilogoMensileDoc> = { ...calcolato, calcolatoIl: oraServer() };
    transazione.set(riferimentoRiepilogo, documento);
    return calcolato;
  });
}

/**
 * I mesi il cui riepilogo dipende dalla riga del mese `chiaveMese`: il mese stesso e i due adiacenti (il riposo e
 * la sovrapposizione a cavallo di mese entrano nel numero di avvisi di entrambi).
 */
export function mesiInteressati(chiaveMese: ChiaveMese): readonly ChiaveMese[] {
  return [spostaMese(chiaveMese, -1), chiaveMese, spostaMese(chiaveMese, 1)];
}
