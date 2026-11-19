// Contratto della callable convalidaMese (ARCHITETTURA §8): condiviso da browser e Functions.
import { z } from 'zod';
import { eChiaveMese } from '../codici';
import type { ChiaveMese } from '../tipi';
import { CHIAVI_GIORNO } from '../tipi';
import { schemaIdDocumento } from './utenti';

export const schemaChiaveMese = z
  .string()
  .refine((valore): valore is ChiaveMese => eChiaveMese(valore));

export const schemaConvalidaMeseInput = z.strictObject({
  repartoId: schemaIdDocumento,
  chiaveMese: schemaChiaveMese,
});
export type ConvalidaMeseInput = z.input<typeof schemaConvalidaMeseInput>;

/** `convalidatoIl` in millisecondi dall'epoca: il browser lo mostra con le funzioni di `formato.ts`. */
export const schemaConvalidaMeseOutput = z.strictObject({ convalidatoIl: z.number().int() });
export type ConvalidaMeseOutput = z.infer<typeof schemaConvalidaMeseOutput>;

/** Il calendario copiato nel documento del mese (ARCHITETTURA §5.8), come lo legge il trigger dei riepiloghi. */
export const schemaCalendarioMese = z.object({
  festivita: z.partialRecord(z.enum(CHIAVI_GIORNO), z.object({ id: z.string(), nome: z.string() })),
  attribuzioneNotte: z.enum(['inizio', 'fine']),
});
