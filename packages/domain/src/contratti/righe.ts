// Forma delle celle e del contratto di una riga (ARCHITETTURA §5.9), verificata a runtime da `validaRiga()`.
// Il browser e il trigger dei riepiloghi (step 2.3) leggono righe che le regole Firestore controllano solo al
// primo livello (L4): qui si verifica ogni campo. Le regole di significato stanno in griglia/valida-riga.ts.
import { z } from 'zod';
import { eCodiceAssenza, eOraLocale } from '../codici';
import { eOreSettimanaliValide, periodoServizioValido } from '../dipendenti/validazione';
import type { CodiceAssenza, OraLocale } from '../tipi';
import { PAUSA_MASSIMA_MINUTI } from '../turni/pausa';
import { schemaCodiceTurno, schemaDataISO } from './dipendenti';
import { schemaIdDocumento } from './utenti';

/** Durata massima di una chiamata: un giorno (il limite vero è la durata della fascia, in validaRiga). */
export const DURATA_MASSIMA_CHIAMATA_MINUTI = 1440;

export const schemaOraLocale = z
  .string()
  .refine((valore): valore is OraLocale => eOraLocale(valore));
export const schemaCodiceAssenza = z
  .string()
  .refine((valore): valore is CodiceAssenza => eCodiceAssenza(valore));
// Un ID di documento, non testo libero: finisce nel registro attività (review 3.1b, rilievo 3).
const schemaIdCollega = schemaIdDocumento.nullable();

export const schemaTurnoInCella = z.strictObject({
  codice: schemaCodiceTurno,
  inizio: schemaOraLocale,
  fine: schemaOraLocale,
  pausaMinuti: z.int().min(0).max(PAUSA_MASSIMA_MINUTI),
  notturno: z.boolean(),
});

export const schemaAssenzaInCella = z.strictObject({
  codice: schemaCodiceAssenza,
  effetto: z.enum(['comeRiposo', 'neutra']),
  malattia: z.boolean(),
});

export const schemaChiamata = z.strictObject({
  durataMinuti: z.int().min(1).max(DURATA_MASSIMA_CHIAMATA_MINUTI),
  oraInizio: schemaOraLocale.nullable(),
});

export const schemaReperibilitaInCella = z.strictObject({
  codice: schemaCodiceTurno,
  inizio: schemaOraLocale,
  fine: schemaOraLocale,
  chiamate: z.array(schemaChiamata),
  sostituisce: schemaIdCollega,
  copertaDa: schemaIdCollega,
});

export const schemaOrarioReale = z.strictObject({ inizio: schemaOraLocale, fine: schemaOraLocale });

export const schemaCella = z.strictObject({
  turno: schemaTurnoInCella.nullable(),
  assenza: schemaAssenzaInCella.nullable(),
  reperibilita: z.array(schemaReperibilitaInCella),
  orarioReale: schemaOrarioReale.nullable(),
  sostituisce: schemaIdCollega,
  copertoDa: schemaIdCollega,
});

export const schemaContrattoRiga = z
  .strictObject({
    oreSettimanali: z.number().refine(eOreSettimanaliValide),
    dataAssunzione: schemaDataISO.nullable(),
    dataCessazione: schemaDataISO.nullable(),
  })
  .refine((c) => periodoServizioValido(c.dataAssunzione, c.dataCessazione));
