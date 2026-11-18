// Contratti delle callable di gestione utenti (ARCHITETTURA §8): creaCoordinatore, impostaStatoUtente,
// assegnaReparto. Condivisi da browser (validazione prima dell'invio) e Functions (validazione che fa fede).
// Oggetti `strict`: un campo in più rende l'input non valido.
import { z } from 'zod';

/**
 * ID di un documento Firestore o uid di Firebase Auth: niente '/', niente '.' o '..', al massimo 128
 * caratteri, e non un ID riservato da Firestore (`__.*__`, review 1.1 rilievo 1): un ID così farebbe
 * fallire la lettura dell'Admin SDK (INVALID_ARGUMENT) e la callable risponderebbe ERRORE_INTERNO invece
 * di INPUT_NON_VALIDO. Per prudenza si rifiuta ogni ID che inizia e finisce con '__', anche '__' e '___'.
 */
export const schemaIdDocumento = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/)
  .refine((id) => !(id.startsWith('__') && id.endsWith('__')));

/** Nome o cognome di un utente: 1-60 caratteri dopo il trim, senza caratteri di controllo. */
export const schemaNomePersona = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[^\p{Cc}]+$/u);

/** Email di accesso: senza spazi ai lati e in minuscolo (Firebase Auth non distingue le maiuscole). */
export const schemaEmailAccesso = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const schemaCreaCoordinatoreInput = z.strictObject({
  email: schemaEmailAccesso,
  nome: schemaNomePersona,
  cognome: schemaNomePersona,
});
export type CreaCoordinatoreInput = z.input<typeof schemaCreaCoordinatoreInput>;
export const schemaCreaCoordinatoreOutput = z.strictObject({ uid: schemaIdDocumento });
export type CreaCoordinatoreOutput = z.infer<typeof schemaCreaCoordinatoreOutput>;

export const schemaImpostaStatoUtenteInput = z.strictObject({
  uid: schemaIdDocumento,
  attivo: z.boolean(),
});
export type ImpostaStatoUtenteInput = z.input<typeof schemaImpostaStatoUtenteInput>;
export const schemaImpostaStatoUtenteOutput = schemaImpostaStatoUtenteInput;
export type ImpostaStatoUtenteOutput = z.infer<typeof schemaImpostaStatoUtenteOutput>;

export const schemaAssegnaRepartoInput = z.strictObject({
  repartoId: schemaIdDocumento,
  coordinatoreUid: schemaIdDocumento,
});
export type AssegnaRepartoInput = z.input<typeof schemaAssegnaRepartoInput>;
export const schemaAssegnaRepartoOutput = schemaAssegnaRepartoInput;
export type AssegnaRepartoOutput = z.infer<typeof schemaAssegnaRepartoOutput>;
