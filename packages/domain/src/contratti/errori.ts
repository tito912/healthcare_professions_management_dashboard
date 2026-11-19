// Codici d'errore delle callable (ARCHITETTURA §8): viaggiano in `HttpsError.details.codice` e il browser
// li traduce con apps/web/src/app/testi/it.ts. Mai testi con dati personali.
import { z } from 'zod';

export const CODICI_ERRORE = [
  // comuni (functions/src/comune/autorizzazione.ts e validazione.ts)
  'NON_AUTENTICATO',
  'UTENTE_NON_ABILITATO',
  'RUOLO_NON_AUTORIZZATO',
  'NON_PROPRIETARIO',
  'INPUT_NON_VALIDO',
  'NON_TROVATO',
  'ERRORE_INTERNO',
  // utenti (step 1.1)
  'EMAIL_GIA_USATA',
  'NON_COORDINATORE',
  'COORDINATORE_NON_VALIDO',
  // dipendenti (step 1.4)
  'CF_NON_VALIDO',
  'CF_DUPLICATO',
  'EMAIL_NON_VALIDA',
  // mesi (step 2.3)
  'MESE_GIA_CONVALIDATO',
  'MESE_NON_CONCLUSO',
  'RIGHE_NON_VALIDE',
  // report (step 4.1)
  'NESSUN_MESE_CONVALIDATO',
] as const;
export type CodiceErrore = (typeof CODICI_ERRORE)[number];

/** Forma di `HttpsError.details` per tutte le callable. */
export const schemaDettagliErrore = z.object({
  codice: z.enum(CODICI_ERRORE),
  /** `RIGHE_NON_VALIDE`: gli ID dei dipendenti delle righe da correggere (mai nomi). */
  righe: z.array(z.string()).optional(),
});
export type DettagliErrore = z.infer<typeof schemaDettagliErrore>;
