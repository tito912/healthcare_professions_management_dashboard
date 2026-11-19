// Contratto della callable convalidaMese (ARCHITETTURA §8): condiviso da browser e Functions.
import { z } from 'zod';
import { eChiaveMese } from '../codici';
import type { ChiaveMese } from '../tipi';
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
