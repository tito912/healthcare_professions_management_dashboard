// Contratti delle callable dell'anagrafica (ARCHITETTURA §8): salvaDipendente e leggiDatiPrivati.
// Condivisi da browser (validazione prima dell'invio) e Functions (validazione che fa fede).
// Gli schemi controllano la forma; codice fiscale ed email, che hanno un errore proprio (CF_NON_VALIDO,
// EMAIL_NON_VALIDA), si verificano dopo con `validaCodiceFiscale()` e `validaEmail()`.
import { z } from 'zod';
import { eCodiceTurno, eDataISO } from '../codici';
import {
  eOreSettimanaliValide,
  LUNGHEZZA_MASSIMA_EMAIL,
  periodoServizioValido,
  DATA_NASCITA_MINIMA,
} from '../dipendenti/validazione';
import type { CodiceTurno, DataISO } from '../tipi';
import { schemaIdDocumento, schemaNomePersona } from './utenti';

export const schemaDataISO = z.string().refine((valore): valore is DataISO => eDataISO(valore));
export const schemaCodiceTurno = z
  .string()
  .refine((valore): valore is CodiceTurno => eCodiceTurno(valore));

/** Turni e fasce che un reparto può avere: oltre non si va (limite di forma, non di dominio). */
export const MAX_TURNI_ESCLUSI = 40;

export const schemaAnagrafica = z
  .strictObject({
    nome: schemaNomePersona,
    cognome: schemaNomePersona,
    oreSettimanali: z.number().refine(eOreSettimanaliValide),
    turniEsclusi: z
      .array(schemaCodiceTurno)
      .max(MAX_TURNI_ESCLUSI)
      .refine((codici) => new Set(codici).size === codici.length),
    dataAssunzione: schemaDataISO.nullable(),
    dataCessazione: schemaDataISO.nullable(),
    attivo: z.boolean(),
  })
  .superRefine((anagrafica, contesto) => {
    // «Disattiva» chiede sempre la data di cessazione (L35): senza data i 5 anni non partirebbero mai.
    if (!anagrafica.attivo && anagrafica.dataCessazione === null) {
      contesto.addIssue({ code: 'custom', path: ['dataCessazione'], message: 'obbligatoria' });
    }
    if (!periodoServizioValido(anagrafica.dataAssunzione, anagrafica.dataCessazione)) {
      contesto.addIssue({
        code: 'custom',
        path: ['dataCessazione'],
        message: 'prima dell’assunzione',
      });
    }
  });
export type Anagrafica = z.output<typeof schemaAnagrafica>;
export type AnagraficaInput = z.input<typeof schemaAnagrafica>;

/** Dati riservati inviati dal browser. Il testo dell'email vuoto vale «nessuna email». */
export const schemaDatiPrivatiInput = z.strictObject({
  codiceFiscale: z.string().max(40),
  dataNascita: schemaDataISO.refine((data) => data >= DATA_NASCITA_MINIMA),
  email: z
    .string()
    .max(LUNGHEZZA_MASSIMA_EMAIL)
    .nullable()
    .transform((email) => (email === null || email.trim() === '' ? null : email.trim())),
});

export const schemaSalvaDipendenteInput = z.strictObject({
  repartoId: schemaIdDocumento,
  /** null = nuovo dipendente. */
  dipendenteId: schemaIdDocumento.nullable(),
  anagrafica: schemaAnagrafica,
  /** Obbligatori in creazione; null in modifica = dati riservati invariati. */
  privati: schemaDatiPrivatiInput.nullable(),
  /**
   * L'utente ha confermato una data di cessazione più vecchia di un anno (`cessazioneDaConfermare`): senza
   * conferma il server risponde CESSAZIONE_DA_CONFERMARE (audit 4.4, I1).
   */
  cessazioneConfermata: z.boolean().default(false),
});
export type SalvaDipendenteInput = z.input<typeof schemaSalvaDipendenteInput>;
export const schemaSalvaDipendenteOutput = z.strictObject({ dipendenteId: schemaIdDocumento });
export type SalvaDipendenteOutput = z.infer<typeof schemaSalvaDipendenteOutput>;

export const schemaLeggiDatiPrivatiInput = z.strictObject({
  repartoId: schemaIdDocumento,
  dipendenteId: schemaIdDocumento,
});
export type LeggiDatiPrivatiInput = z.input<typeof schemaLeggiDatiPrivatiInput>;
export interface LeggiDatiPrivatiOutput {
  codiceFiscale: string;
  dataNascita: DataISO;
  email: string | null;
}
