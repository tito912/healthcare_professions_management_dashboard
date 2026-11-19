// `ServizioPosta` che scrive nella raccolta `mail` nel formato dell'estensione Trigger Email (ARCHITETTURA §5.14).
// Sugli emulatori il documento resta in coda ed è la prova dell'invio: l'estensione, se installata, lo spedisce.
import { Timestamp } from 'firebase-admin/firestore';
import { rifCodaMail } from '../rif';
import type { EsitoAccodamento, MessaggioPosta, ServizioPosta } from './servizio-posta';

const CODICE_GIA_ESISTENTE = 6;

function eGiaEsistente(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === CODICE_GIA_ESISTENTE;
}

export class PostaTriggerEmail implements ServizioPosta {
  /** `mittente` vuoto = quello configurato nell'estensione. */
  constructor(private readonly mittente: string = '') {}

  async accoda(messaggio: MessaggioPosta): Promise<EsitoAccodamento> {
    const riferimento =
      messaggio.id === null ? rifCodaMail().doc() : rifCodaMail().doc(messaggio.id);
    const documento = {
      to: [messaggio.a],
      ...(this.mittente === '' ? {} : { from: this.mittente }),
      message: {
        subject: messaggio.oggetto,
        text: messaggio.testo,
        html: messaggio.html,
        attachments: messaggio.allegati.map((allegato) => ({
          filename: allegato.nomeFile,
          content: allegato.contenutoBase64,
          encoding: 'base64' as const,
        })),
      },
      scadeIl: Timestamp.fromMillis(messaggio.scadeIlMs),
      origine: messaggio.origine,
    };
    try {
      await riferimento.create(documento);
      return { mailId: riferimento.id, nuova: true };
    } catch (e) {
      if (eGiaEsistente(e)) {
        return { mailId: riferimento.id, nuova: false };
      }
      throw e;
    }
  }
}
