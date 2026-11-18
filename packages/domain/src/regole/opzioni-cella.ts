// Opzioni ammesse per una cella (U7): quelle che menu e pennello offrono. I turni esclusi per il dipendente e
// quelli disattivati non compaiono; le reperibilità non compaiono se la cella ne ha già 2.
import type { CellaDoc, TipologiaAssenzaDoc, TurnoDoc } from '../documenti';
import { MAX_REPERIBILITA_GIORNO } from '../impostazioni';
import type { CodiceTurno } from '../tipi';

/** Un turno o una fascia della configurazione del reparto, senza i campi di sistema. */
export type TurnoConfigurato = Pick<
  TurnoDoc,
  'codice' | 'tipo' | 'nome' | 'inizio' | 'fine' | 'pausaMinuti' | 'notturno' | 'attivo' | 'ordine'
>;

/** Una tipologia di assenza della configurazione, senza i campi di sistema. */
export type AssenzaConfigurata = Pick<
  TipologiaAssenzaDoc,
  'codice' | 'descrizione' | 'effetto' | 'malattia' | 'attivo' | 'ordine'
>;

/** Configurazione del reparto letta dalla griglia: turni e fasce (anche disattivati) e tipologie di assenza. */
export interface ConfigurazioneGriglia {
  readonly turni: readonly TurnoConfigurato[];
  readonly assenze: readonly AssenzaConfigurata[];
}

export interface OpzioniCella {
  readonly turni: readonly TurnoConfigurato[];
  readonly assenze: readonly AssenzaConfigurata[];
  readonly reperibilita: readonly TurnoConfigurato[];
  /** Vero se la cella ha già il massimo di reperibilità: il menu lo dice al posto delle voci. */
  readonly reperibilitaAlCompleto: boolean;
}

function perOrdine<T extends { readonly ordine: number; readonly codice: string }>(
  a: T,
  b: T,
): number {
  return a.ordine - b.ordine || a.codice.localeCompare(b.codice);
}

export function opzioniCella(
  configurazione: ConfigurazioneGriglia,
  turniEsclusi: readonly CodiceTurno[],
  cella: Pick<CellaDoc, 'reperibilita'> | null,
): OpzioniCella {
  const ammesso = (turno: TurnoConfigurato): boolean =>
    turno.attivo && !turniEsclusi.includes(turno.codice);
  const presenti = cella?.reperibilita ?? [];
  const alCompleto = presenti.length >= MAX_REPERIBILITA_GIORNO;
  const turni = configurazione.turni
    .filter((t) => t.tipo === 'turno' && ammesso(t))
    .sort(perOrdine);
  const reperibilita = alCompleto
    ? []
    : configurazione.turni
        .filter(
          (t) =>
            t.tipo === 'reperibilita' && ammesso(t) && !presenti.some((r) => r.codice === t.codice),
        )
        .sort(perOrdine);
  const assenze = configurazione.assenze.filter((a) => a.attivo).sort(perOrdine);
  return { turni, assenze, reperibilita, reperibilitaAlCompleto: alCompleto };
}
