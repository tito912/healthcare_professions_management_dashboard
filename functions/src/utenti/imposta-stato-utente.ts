// impostaStatoUtente (ARCHITETTURA §8): disattiva o riattiva un coordinatore.
//
// Quando ha effetto la disattivazione:
// - Firestore e callable: subito. Le regole (`abilitato()`) e `richiediUtente` leggono utenti/{uid}.attivo
//   a ogni richiesta, quindi anche un token ancora valido viene respinto alla richiesta successiva.
// - Accesso e rinnovo del token: subito. L'utente Auth è disabilitato e i refresh token sono revocati:
//   non si rientra e il prossimo rinnovo del token (al più tardi dopo un'ora) fallisce, quindi il browser
//   esce. Il token già emesso resterebbe valido fino a un'ora solo per servizi che non leggono `attivo`:
//   Storage, che però nega tutto al browser.
//
// Ordine delle scritture «a prova di guasto»: disattivando si scrive prima Firestore (blocca subito i
// dati), poi Auth; riattivando prima Auth, poi Firestore. Se un passo fallisce l'utente resta di fatto
// disattivato e l'ADMIN può ripetere l'operazione, che è idempotente.
import {
  schemaImpostaStatoUtenteInput,
  type ImpostaStatoUtenteOutput,
  type UtenteDoc,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { auth, db, oraServer, rifUtente, type InScrittura } from '../comune/admin';
import { richiediAdmin, type UtenteAbilitato } from '../comune/autorizzazione';
import { codiceDi, definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';

const NOME = 'impostaStatoUtente';

export const impostaStatoUtente = definisciCallable(
  NOME,
  async (richiesta): Promise<ImpostaStatoUtenteOutput> => {
    const admin = await richiediAdmin(richiesta);
    const { uid, attivo } = validaInput(NOME, schemaImpostaStatoUtenteInput, richiesta.data);

    // Destinatario solo COORDINATORE: un ADMIN (anche sé stesso) non si disattiva da qui.
    await verificaDestinatario(uid);

    if (attivo) {
      await auth().updateUser(uid, { disabled: false });
      await scriviStato(admin, uid, true);
    } else {
      await scriviStato(admin, uid, false);
      await auth().updateUser(uid, { disabled: true });
      await auth().revokeRefreshTokens(uid);
    }

    logger.info('Stato utente impostato', { uid, attivo, autoreUid: admin.uid });
    return { uid, attivo };
  },
);

async function verificaDestinatario(uid: string): Promise<void> {
  const documento = await rifUtente(uid).get();
  if (!documento.exists) {
    throw errore('NON_TROVATO');
  }
  if (documento.get('ruolo') !== 'COORDINATORE') {
    throw errore('NON_COORDINATORE');
  }
  let ruoloNelToken: unknown;
  try {
    const record = await auth().getUser(uid);
    ruoloNelToken = record.customClaims?.['ruolo'];
  } catch (e) {
    if (codiceDi(e) === 'auth/user-not-found') {
      throw errore('NON_TROVATO');
    }
    throw e;
  }
  if (ruoloNelToken !== 'COORDINATORE') {
    throw errore('NON_COORDINATORE');
  }
}

/** Documento utente e voce del registro nella stessa transazione. */
async function scriviStato(admin: UtenteAbilitato, uid: string, attivo: boolean): Promise<void> {
  await db().runTransaction(async (transazione) => {
    const rif = rifUtente(uid);
    const documento = await transazione.get(rif);
    if (!documento.exists) {
      throw errore('NON_TROVATO');
    }
    if (documento.get('ruolo') !== 'COORDINATORE') {
      throw errore('NON_COORDINATORE');
    }
    const prima: unknown = documento.get('attivo');
    const modifica: Pick<InScrittura<UtenteDoc>, 'attivo' | 'aggiornatoIl'> = {
      attivo,
      aggiornatoIl: oraServer(),
    };
    transazione.update(rif, modifica);
    transazione.create(
      rifNuovaVoce(null),
      voceRegistro(admin, {
        tipo: 'utente.stato',
        repartoId: null,
        dettagli: { uid, attivo, prima: prima === true },
      }),
    );
  });
}
