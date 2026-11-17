// Validazione dell'input delle callable con gli schemi zod di packages/domain/src/contratti.
// Nei log vanno solo i percorsi dei campi non validi, mai i valori ricevuti.
import { analizzaInput, type OutputContratto, type SchemaContratto } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { errore } from './errori';

export function validaInput<S extends SchemaContratto>(
  funzione: string,
  schema: S,
  dati: unknown,
): OutputContratto<S> {
  const esito = analizzaInput(schema, dati);
  if (!esito.valido) {
    logger.warn('Input non valido', { funzione, campi: esito.campi });
    throw errore('INPUT_NON_VALIDO');
  }
  return esito.valore;
}
