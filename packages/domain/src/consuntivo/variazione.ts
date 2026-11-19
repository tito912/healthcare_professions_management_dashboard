// Variazioni di orario (SPEC «variazioni di ingresso e uscita», PIANO 3.1a criterio 1). Sull'orario reale si
// applica la stessa pausa del turno previsto (L37): la differenza di ore lavorate è quindi la differenza tra le
// durate reali dei due orari, in minuti reali a Europe/Rome (nella notte del cambio d'ora un'ora vale 0 o 120).
// L'orario reale segue la regola del turno: `fine <= inizio` vuol dire che termina il giorno dopo.
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import type { CellaDoc, OrarioReale, TurnoInCella } from '../documenti';
import type { ChiaveGiorno, ChiaveMese, DataISO, Minuti } from '../tipi';
import { durataReale } from '../turni/durata';

type Orario = Pick<OrarioReale, 'inizio' | 'fine'>;

/**
 * Differenza in minuti tra l'orario reale e il previsto di un turno che inizia nel giorno dato: positiva se si è
 * lavorato di più, negativa se di meno, zero se la durata è la stessa (anche con orari spostati).
 */
export function variazioneOrario(giorno: DataISO, previsto: Orario, reale: Orario): Minuti {
  return (
    durataReale(giorno, reale.inizio, reale.fine) -
    durataReale(giorno, previsto.inizio, previsto.fine)
  );
}

/** L'orario reale c'è ed è diverso dal previsto (ingresso o uscita). */
export function orarioVariato(turno: Orario, orarioReale: Orario | null): boolean {
  return (
    orarioReale !== null && (orarioReale.inizio !== turno.inizio || orarioReale.fine !== turno.fine)
  );
}

export interface VariazioniMese {
  /** Celle con un turno svolto e l'orario reale diverso dal previsto (§5.10 `variazioni`). */
  readonly variazioni: number;
  /** Somma algebrica delle differenze (§5.10 `minutiVariazioni`). */
  readonly minutiVariazioni: Minuti;
}

function turnoConVariazione(
  cella: CellaDoc,
): { readonly turno: TurnoInCella; readonly reale: OrarioReale } | null {
  if (cella.turno === null || cella.assenza !== null || cella.orarioReale === null) {
    return null;
  }
  return orarioVariato(cella.turno, cella.orarioReale)
    ? { turno: cella.turno, reale: cella.orarioReale }
    : null;
}

/**
 * Variazioni del mese di una riga. Contano solo i turni svolti (turno senza assenza): un orario reale su un turno
 * scoperto è un blocco di `validaRiga()` e qui si ignora. La notte dell'ultimo giorno resta nel mese d'inizio (L10).
 */
export function variazioniMese(
  chiave: ChiaveMese,
  giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
): VariazioniMese {
  let variazioni = 0;
  let minutiVariazioni = 0;
  for (const [giorno, cella] of Object.entries(giorni)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiave, giorno) : null;
    const variata = cella === undefined ? null : turnoConVariazione(cella);
    if (data === null || variata === null) {
      continue;
    }
    variazioni += 1;
    minutiVariazioni += variazioneOrario(data, variata.turno, variata.reale);
  }
  return { variazioni, minutiVariazioni };
}
