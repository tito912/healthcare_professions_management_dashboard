// creaCoordinatore (ARCHITETTURA §8): utente Auth con password casuale, claim { ruolo: 'COORDINATORE' },
// documento utenti/{uid} e voce `utente.creato` nel registro radice. L'email per scegliere la password la
// invia il browser con sendPasswordResetEmail: nessun SMTP nelle Functions.
import {
  schemaCreaCoordinatoreInput,
  type CreaCoordinatoreOutput,
  type UtenteDoc,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { auth, db, oraServer, rifUtente, type InScrittura } from '../comune/admin';
import { richiediAdmin } from '../comune/autorizzazione';
import { codiceDi, datiErroreSicuri, definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import { passwordCasuale } from './password';

const NOME = 'creaCoordinatore';

export const creaCoordinatore = definisciCallable(
  NOME,
  async (richiesta): Promise<CreaCoordinatoreOutput> => {
    const admin = await richiediAdmin(richiesta);
    const input = validaInput(NOME, schemaCreaCoordinatoreInput, richiesta.data);

    const uid = await creaUtenteAuth(input.email);
    try {
      await auth().setCustomUserClaims(uid, { ruolo: 'COORDINATORE' });
      const utente: InScrittura<UtenteDoc> = {
        nome: input.nome,
        cognome: input.cognome,
        email: input.email,
        ruolo: 'COORDINATORE',
        attivo: true,
        creatoIl: oraServer(),
        creatoDa: admin.uid,
        aggiornatoIl: oraServer(),
      };
      const batch = db().batch();
      batch.create(rifUtente(uid), utente);
      batch.create(
        rifNuovaVoce(null),
        voceRegistro(admin, {
          tipo: 'utente.creato',
          repartoId: null,
          dettagli: { uid, ruolo: 'COORDINATORE' },
        }),
      );
      await batch.commit();
    } catch (e) {
      // Senza documento utenti/{uid} l'account non servirebbe a nulla: si elimina, così l'ADMIN
      // può riprovare con la stessa email.
      await annullaCreazione(uid);
      throw e;
    }

    logger.info('Coordinatore creato', { uid, autoreUid: admin.uid });
    return { uid };
  },
);

async function creaUtenteAuth(email: string): Promise<string> {
  try {
    const record = await auth().createUser({
      email,
      password: passwordCasuale(),
      emailVerified: false,
      disabled: false,
    });
    return record.uid;
  } catch (e) {
    const codice = codiceDi(e);
    if (codice === 'auth/email-already-exists') {
      throw errore('EMAIL_GIA_USATA');
    }
    if (codice === 'auth/invalid-email') {
      throw errore('INPUT_NON_VALIDO');
    }
    throw e;
  }
}

async function annullaCreazione(uid: string): Promise<void> {
  try {
    await auth().deleteUser(uid);
  } catch (e) {
    logger.error('Eliminazione dell’utente Auth non riuscita dopo un errore', {
      uid,
      ...datiErroreSicuri(e),
    });
  }
}
