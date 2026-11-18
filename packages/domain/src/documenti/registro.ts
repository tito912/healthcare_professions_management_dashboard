import type { ChiaveMese, IdBimestre, Istante, Ruolo } from '../tipi';

/** Operazioni registrate (ARCHITETTURA §5.13). */
export const TIPI_OPERAZIONE = [
  'utente.creato',
  'utente.stato',
  'reparto.assegnato',
  'dipendente.salvato',
  'dipendente.datiPrivatiLetti',
  'mese.convalidato',
  'mese.riaperto',
  'consuntivo.modificato',
  'riga.nonValida',
  'report.generato',
  'report.inviato',
  'report.invioRimandato',
  'pulizia.eseguita',
] as const;
export type TipoOperazione = (typeof TIPI_OPERAZIONE)[number];

/**
 * registroAttivita/{voceId} (operazioni non legate a un reparto) e
 * reparti/{repartoId}/registroAttivita/{voceId}. Scritto solo dalle Functions.
 */
export interface VoceRegistroDoc {
  il: Istante;
  tipo: TipoOperazione;
  autoreUid: string | null; // null = sistema (trigger, programmate)
  autoreNome: string | null; // «Nome Cognome» dell'utente; null = sistema
  autoreRuolo: Ruolo | 'SISTEMA';
  repartoId: string | null; // null solo nella raccolta radice
  chiaveMese: ChiaveMese | null;
  dipendenteId: string | null; // mai nome, codice fiscale o email
  dettagli: Record<string, string | number | boolean | null>; // solo codici, orari, conteggi, ID
}

/** mail/{mailId}: coda email nel formato Trigger Email (ARCHITETTURA §5.14). Mai leggibile dal browser. */
export interface MailDoc {
  to: string[];
  message: {
    subject: string;
    text: string;
    html: string;
    attachments: { filename: string; content: string; encoding: 'base64' }[];
  };
  scadeIl: Istante; // politica TTL: eliminato dopo 30 giorni (L17)
  origine: { repartoId: string; idBimestre: IdBimestre; dipendenteId: string; automatico: boolean };
  delivery?: unknown; // scritto dall'estensione, se installata
}
