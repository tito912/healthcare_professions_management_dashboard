// Ore dovute (D4). I nomi seguono DECISIONI («ore dovute»), ma il risultato è sempre in minuti interi.
//   ore dovute giornaliere = ore settimanali ÷ 5, per ogni giorno da lunedì a venerdì non festivo di servizio;
//   sabato, domenica, festivi e giorni fuori servizio: zero.
// Le assenze neutre (ferie, malattia, permessi) valgono le ore dovute del giorno: qui si tolgono dalle dovute,
// così il saldo (lavorate − dovute) non cambia e la colonna delle pianificate non contiene ore non lavorate.
// Le assenze «come riposo» (riposo, smonto) valgono zero ore lavorate: le dovute restano.
import { eGiornoNonLavorativo } from '../calendario/classifica-giorno';
import type { Festivita } from '../calendario/festivita';
import { chiaveGiornoDi, giorniDelMese } from '../calendario/mesi';
import { inServizioIl, type PeriodoServizio } from '../calendario/servizio';
import type { AssenzaInCella, CellaDoc } from '../documenti';
import type { ChiaveGiorno, ChiaveMese, DataISO, Minuti } from '../tipi';

/** Il contratto che serve alle ore dovute: ore settimanali e periodo di servizio (`ContrattoRiga`). */
export interface ContrattoOre extends PeriodoServizio {
  readonly oreSettimanali: number;
}

/** Minuti dovuti in un feriale: ore settimanali × 60 ÷ 5. Con passi di mezz'ora (L39) è sempre un intero. */
export function minutiDovutiGiornalieri(oreSettimanali: number): Minuti {
  return Math.round(oreSettimanali * 12);
}

/** Minuti dovuti in un giorno, data l'assenza della cella (o null). */
export function oreDovuteGiorno(
  data: DataISO,
  contratto: ContrattoOre,
  festivita: readonly Festivita[],
  assenza: Pick<AssenzaInCella, 'effetto'> | null,
): Minuti {
  if (!inServizioIl(contratto, data) || eGiornoNonLavorativo(data, festivita)) {
    return 0;
  }
  return assenza?.effetto === 'neutra' ? 0 : minutiDovutiGiornalieri(contratto.oreSettimanali);
}

/** Minuti dovuti nel mese: somma dei giorni, con le assenze delle celle della riga. */
export function oreDovuteMese(
  chiave: ChiaveMese,
  contratto: ContrattoOre,
  festivita: readonly Festivita[],
  giorni: Readonly<Partial<Record<ChiaveGiorno, Pick<CellaDoc, 'assenza'>>>>,
): Minuti {
  let totale = 0;
  for (const data of giorniDelMese(chiave)) {
    const giorno = chiaveGiornoDi(data);
    totale += oreDovuteGiorno(data, contratto, festivita, giorni[giorno]?.assenza ?? null);
  }
  return totale;
}
