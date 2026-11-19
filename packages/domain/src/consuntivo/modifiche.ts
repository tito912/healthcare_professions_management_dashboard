// Differenze di consuntivo tra due versioni di una riga (PIANO 3.1b criterio 3, ARCHITETTURA §5.13): il trigger
// `aggiornaRiepilogo` ne scrive una voce `consuntivo.modificato` per ciascuna. Si guardano solo orari reali,
// assenze, sostituzioni e chiamate; il piano (turni e fasce) non è consuntivo, e nemmeno riposo e smonto (assenze
// «come riposo»): sono pianificazione del riposo, ne servirebbe una voce per ogni riposo assegnato. I valori sono stringhe di soli
// codici, orari e ID di dipendenti: mai testi liberi né nomi. Funzione pura.
import { eChiaveGiorno } from '../calendario/mesi';
import type { CellaDoc } from '../documenti';
import { celleValide } from '../regole/avvisi-riga';
import type { ChiaveGiorno, ChiaveMese } from '../tipi';

/** Nell'ordine in cui compaiono nelle voci di uno stesso giorno. */
export const CAMPI_CONSUNTIVO = [
  'orarioReale',
  'assenza',
  'sostituisce',
  'copertoDa',
  'chiamate',
  'reperibilitaSostituisce',
  'reperibilitaCopertaDa',
] as const;

export type CampoConsuntivo = (typeof CAMPI_CONSUNTIVO)[number];

export interface DifferenzaConsuntivo {
  readonly giorno: ChiaveGiorno;
  readonly campo: CampoConsuntivo;
  /** null = il campo era vuoto. */
  readonly prima: string | null;
  /** null = il campo è stato svuotato. */
  readonly dopo: string | null;
}

type ValoriCella = Readonly<Record<CampoConsuntivo, string | null>>;

const VUOTA: ValoriCella = {
  orarioReale: null,
  assenza: null,
  sostituisce: null,
  copertoDa: null,
  chiamate: null,
  reperibilitaSostituisce: null,
  reperibilitaCopertaDa: null,
};

/** `codice:valore` per ogni fascia che ha un valore, in ordine di codice, separate da virgole; null se nessuna. */
function perFascia(
  cella: CellaDoc,
  valore: (fascia: CellaDoc['reperibilita'][number]) => string | null,
): string | null {
  const voci = [...cella.reperibilita]
    .sort((a, b) => a.codice.localeCompare(b.codice))
    .flatMap((fascia) => {
      const v = valore(fascia);
      return v === null ? [] : [`${fascia.codice}:${v}`];
    });
  return voci.length === 0 ? null : voci.join(',');
}

function valoriDi(cella: CellaDoc | undefined): ValoriCella {
  if (cella === undefined) {
    return VUOTA;
  }
  return {
    orarioReale:
      cella.orarioReale === null ? null : `${cella.orarioReale.inizio}-${cella.orarioReale.fine}`,
    assenza: cella.assenza?.codice ?? null,
    sostituisce: cella.sostituisce,
    copertoDa: cella.copertoDa,
    chiamate: perFascia(cella, (fascia) =>
      fascia.chiamate.length === 0
        ? null
        : fascia.chiamate
            .map((c) =>
              c.oraInizio === null ? `${c.durataMinuti}` : `${c.durataMinuti}@${c.oraInizio}`,
            )
            .join('+'),
    ),
    reperibilitaSostituisce: perFascia(cella, (fascia) => fascia.sostituisce),
    reperibilitaCopertaDa: perFascia(cella, (fascia) => fascia.copertaDa),
  };
}

/**
 * Le differenze di consuntivo tra due mappe `giorni` (come arrivano da Firestore, non fidate: contano solo le celle
 * valide del mese), in ordine di giorno e poi di campo. Una riga che non c'è (`undefined` o `null`) vale vuota, quindi
 * una riga appena creata dà una voce per ogni consuntivo che contiene già.
 */
export function modificheConsuntivo(
  chiave: ChiaveMese,
  prima: unknown,
  dopo: unknown,
): DifferenzaConsuntivo[] {
  const celleDiDopo = celleValide(chiave, dopo);
  const celleDiPrima = celleValide(chiave, prima);
  const giorni = [...new Set([...Object.keys(celleDiPrima), ...Object.keys(celleDiDopo)])]
    .filter(eChiaveGiorno)
    .sort();
  const modifiche: DifferenzaConsuntivo[] = [];
  for (const giorno of giorni) {
    const a = valoriDi(celleDiPrima[giorno]);
    const b = valoriDi(celleDiDopo[giorno]);
    // Riposo e smonto sono piano: l'assenza si annota se almeno una delle due versioni è un'assenza neutra.
    const assenzaNeutra =
      celleDiPrima[giorno]?.assenza?.effetto === 'neutra' ||
      celleDiDopo[giorno]?.assenza?.effetto === 'neutra';
    for (const campo of CAMPI_CONSUNTIVO) {
      if (campo === 'assenza' && !assenzaNeutra) {
        continue;
      }
      if (a[campo] !== b[campo]) {
        modifiche.push({ giorno, campo, prima: a[campo], dopo: b[campo] });
      }
    }
  }
  return modifiche;
}
