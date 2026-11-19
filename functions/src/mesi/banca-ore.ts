// Banca ore dell'anno di un dipendente (ARCHITETTURA §5.11, D4). Derivata dai riepiloghi mensili con `bancaOreAnno()`
// del dominio: qui solo lettura, confronto e scrittura. Come `ricalcolaRiepilogo()`, il risultato è una funzione dei
// soli documenti letti (i 12 riepiloghi dell'anno e la banca ore dell'anno prima): rieseguire dà lo stesso documento,
// che in quel caso non si riscrive (`calcolatoIl` resta quello di prima). Lettura e scrittura stanno in una
// transazione che legge tutti e 12 i riepiloghi, anche quelli che non esistono: un riepilogo scritto da un altro
// trigger nel frattempo fa ripetere la transazione, quindi due trigger sullo stesso dipendente non si perdono.
// Passaggio d'anno: finché l'anno dopo ha già una banca ore, la si ricalcola con il riporto aggiornato, e così via,
// anche quando l'anno appena ricalcolato non è cambiato: se la transazione di un anno successivo è fallita, la
// riconsegna dell'evento trova l'anno di partenza già giusto e deve comunque riparare quello rimasto indietro
// (review 3.1b, rilievo 1). Ogni passo non riscrive nulla se il documento è già giusto. È un ciclo in questa funzione,
// non un trigger sui documenti `bancaOre`: nessuna catena di eventi. Non scrive mai righe né riepiloghi (D2).
import {
  bancaOreAnno,
  chiaveMeseDa,
  type BancaOreDoc,
  type ChiaveMese,
  type RiepilogoPerBancaOre,
} from '@turni/domain';
import { db, oraServer, type InScrittura } from '../comune/admin';
import { stessiDati } from '../comune/confronto';
import { leggiRiepilogoPerBancaOre, leggiRiporto } from './lettura';
import { rifBancaOre, rifRiepilogo } from './rif';

/** Anni consecutivi che si propagano al massimo: oltre, qualcosa non va (ogni anno è un documento per dipendente). */
const MAX_ANNI_PROPAGAZIONE = 30;

const NUMERI_MESE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

interface EsitoAnno {
  /** L'anno dopo ha una banca ore: va ricalcolata col nuovo riporto. */
  readonly annoSuccessivoEsiste: boolean;
}

/** L'anno di una chiave di mese. */
export function annoDi(chiaveMese: ChiaveMese): number {
  return Number(chiaveMese.slice(0, 4));
}

async function ricalcolaAnno(
  repartoId: string,
  dipendenteId: string,
  anno: number,
): Promise<EsitoAnno> {
  const riferimento = rifBancaOre(repartoId, anno, dipendenteId);
  const mesi = NUMERI_MESE.map((numero) => chiaveMeseDa(anno, numero));
  return db().runTransaction(async (transazione) => {
    const [riepiloghi, precedente, esistente, successivo] = await Promise.all([
      transazione.getAll(...mesi.map((chiave) => rifRiepilogo(repartoId, chiave, dipendenteId))),
      transazione.get(rifBancaOre(repartoId, anno - 1, dipendenteId)),
      transazione.get(riferimento),
      transazione.get(rifBancaOre(repartoId, anno + 1, dipendenteId)),
    ]);
    const presenti = riepiloghi
      .map((snapshot, indice) => {
        const chiave = mesi[indice];
        return chiave === undefined
          ? null
          : leggiRiepilogoPerBancaOre(snapshot, chiave, dipendenteId);
      })
      .filter((riepilogo): riepilogo is RiepilogoPerBancaOre => riepilogo !== null);
    const annoSuccessivoEsiste = successivo.exists;
    // Senza riepiloghi e senza un documento già scritto non c'è nulla da calcolare.
    if (presenti.length === 0 && !esistente.exists) {
      return { annoSuccessivoEsiste };
    }
    const calcolata = bancaOreAnno({
      dipendenteId,
      anno,
      riporto: leggiRiporto(precedente),
      riepiloghi: presenti,
    });
    if (esistente.exists) {
      const salvata: Record<string, unknown> = { ...esistente.data() };
      delete salvata['calcolatoIl'];
      if (stessiDati(salvata, calcolata)) {
        return { annoSuccessivoEsiste };
      }
    }
    const documento: InScrittura<BancaOreDoc> = { ...calcolata, calcolatoIl: oraServer() };
    transazione.set(riferimento, documento);
    return { annoSuccessivoEsiste };
  });
}

/**
 * Ricalcola la banca ore dell'anno e quelle degli anni successivi che esistono già (il riporto di ogni anno è il saldo
 * dell'anno prima); i documenti già giusti non si riscrivono. Sicuro da ripetere e con eventi riconsegnati.
 */
export async function ricalcolaBancaOre(
  repartoId: string,
  dipendenteId: string,
  anno: number,
): Promise<void> {
  let corrente = anno;
  for (let passo = 0; passo < MAX_ANNI_PROPAGAZIONE; passo += 1) {
    const esito = await ricalcolaAnno(repartoId, dipendenteId, corrente);
    if (!esito.annoSuccessivoEsiste) {
      return;
    }
    corrente += 1;
  }
}
