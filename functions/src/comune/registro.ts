// Voci del registro attività (ARCHITETTURA §5.13). Le operazioni legate a un reparto vanno in
// reparti/{id}/registroAttivita, le altre nella raccolta radice. Solo ID, codici e conteggi in `dettagli`:
// mai nomi di dipendenti, codici fiscali, date di nascita o email.
import type { ChiaveMese, TipoOperazione, VoceRegistroDoc } from '@turni/domain';
import type { DocumentReference } from 'firebase-admin/firestore';
import { db, oraServer, rifReparto, type InScrittura } from './admin';
import type { UtenteAbilitato } from './autorizzazione';

export interface DatiVoce {
  readonly tipo: TipoOperazione;
  readonly repartoId: string | null;
  readonly chiaveMese?: ChiaveMese;
  readonly dipendenteId?: string;
  readonly dettagli: VoceRegistroDoc['dettagli'];
}

/** Documento della voce; `autore` null = sistema (trigger, funzioni programmate). */
export function voceRegistro(
  autore: UtenteAbilitato | null,
  dati: DatiVoce,
): InScrittura<VoceRegistroDoc> {
  return {
    il: oraServer(),
    tipo: dati.tipo,
    autoreUid: autore?.uid ?? null,
    autoreNome: autore?.nomeCompleto ?? null,
    autoreRuolo: autore?.ruolo ?? 'SISTEMA',
    repartoId: dati.repartoId,
    chiaveMese: dati.chiaveMese ?? null,
    dipendenteId: dati.dipendenteId ?? null,
    dettagli: dati.dettagli,
  };
}

/** Riferimento a una voce nuova (ID automatico) nella raccolta giusta per il reparto. */
export function rifNuovaVoce(repartoId: string | null): DocumentReference {
  const raccolta =
    repartoId === null
      ? db().collection('registroAttivita')
      : rifReparto(repartoId).collection('registroAttivita');
  return raccolta.doc();
}
