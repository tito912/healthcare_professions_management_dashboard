// Contratti delle callable generaReport e inviaReport (ARCHITETTURA §8): condivisi da browser e Functions.
import { z } from 'zod';
import { eIdBimestre } from '../calendario/bimestri';
import type { IdBimestre } from '../tipi';
import { schemaChiaveMese } from './mesi';
import { schemaIdDocumento } from './utenti';

export const schemaIdBimestre = z
  .string()
  .refine((valore): valore is IdBimestre => eIdBimestre(valore));

export const schemaGeneraReportInput = z.strictObject({
  repartoId: schemaIdDocumento,
  idBimestre: schemaIdBimestre,
});
export type GeneraReportInput = z.input<typeof schemaGeneraReportInput>;

/** Il file Excel del reparto in base64, per il download dal browser. */
export const schemaGeneraReportOutput = z.strictObject({
  nomeFile: z.string(),
  contenutoBase64: z.string(),
  mesiInclusi: z.array(schemaChiaveMese),
});
export type GeneraReportOutput = z.infer<typeof schemaGeneraReportOutput>;

/** Dipendenti a cui inviare in una sola chiamata. */
export const MAX_DIPENDENTI_PER_INVIO = 500;

/**
 * `dipendenteIds: null` = tutti i dipendenti del report. Con `anteprima: true` non si scrive e non si accoda nulla: la
 * risposta dice per ciascuno `accodato` (riceverebbe la email) o `senzaEmail`, così il browser conta chi ha l'email
 * senza mai vedere un indirizzo.
 */
export const schemaInviaReportInput = z.strictObject({
  repartoId: schemaIdDocumento,
  idBimestre: schemaIdBimestre,
  dipendenteIds: z.array(schemaIdDocumento).min(1).max(MAX_DIPENDENTI_PER_INVIO).nullable(),
  anteprima: z.boolean().optional(),
});
export type InviaReportInput = z.input<typeof schemaInviaReportInput>;

export const ESITI_INVIO = ['accodato', 'senzaEmail', 'errore'] as const;

export const schemaInviaReportOutput = z.strictObject({
  esiti: z.array(z.strictObject({ dipendenteId: schemaIdDocumento, esito: z.enum(ESITI_INVIO) })),
});
export type InviaReportOutput = z.infer<typeof schemaInviaReportOutput>;
