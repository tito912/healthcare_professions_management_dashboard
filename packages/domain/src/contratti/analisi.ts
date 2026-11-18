// Applica uno schema a un input esterno senza esporre i valori: in caso di errore restituisce solo i
// percorsi dei campi non validi (mai il contenuto, che può essere un dato personale).
import type { z } from 'zod';

/** Schema zod di un contratto: chi valida (Functions, browser) non importa zod direttamente. */
export type SchemaContratto = z.ZodType;
/** Valore ottenuto da uno schema di contratto dopo la validazione. */
export type OutputContratto<S extends SchemaContratto> = z.output<S>;

export type EsitoAnalisi<T> =
  | { readonly valido: true; readonly valore: T }
  | { readonly valido: false; readonly campi: readonly string[] };

export function analizzaInput<S extends z.ZodType>(
  schema: S,
  dati: unknown,
): EsitoAnalisi<z.output<S>> {
  const esito = schema.safeParse(dati);
  if (esito.success) {
    return { valido: true, valore: esito.data };
  }
  const campi = esito.error.issues.map((problema) =>
    problema.path.length === 0 ? '(radice)' : problema.path.map(String).join('.'),
  );
  return { valido: false, campi: [...new Set(campi)] };
}
