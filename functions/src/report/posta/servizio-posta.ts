// Interfaccia di invio delle email (D12): il fornitore si sceglie dopo, il codice accoda e basta. Chi cambia servizio
// scrive un'altra implementazione e la passa a `inviaReport` e `reportBimestrale`; nulla dipende dall'estensione.
import type { MailDoc } from '@turni/domain';

export interface AllegatoPosta {
  readonly nomeFile: string;
  readonly contenutoBase64: string;
}

export interface MessaggioPosta {
  /** ID del documento in coda; null = ID automatico. Un ID fisso rende l'accodamento idempotente. */
  readonly id: string | null;
  readonly a: string;
  readonly oggetto: string;
  readonly testo: string;
  readonly html: string;
  readonly allegati: readonly AllegatoPosta[];
  /** Istante (ms) dopo il quale la coda elimina il messaggio (L17). */
  readonly scadeIlMs: number;
  readonly origine: MailDoc['origine'];
}

export interface EsitoAccodamento {
  readonly mailId: string;
  /** False se un messaggio con lo stesso ID era già in coda: non si accoda due volte. */
  readonly nuova: boolean;
}

export interface ServizioPosta {
  accoda(messaggio: MessaggioPosta): Promise<EsitoAccodamento>;
}
