// assegnaReparto (ARCHITETTURA §8): l'ADMIN cambia il coordinatore di un reparto. È l'unico modo di
// cambiare `coordinatoreUid`: le regole lo vietano al browser. Voce `reparto.assegnato` nel registro
// del reparto, nella stessa transazione.
import {
  schemaAssegnaRepartoInput,
  type AssegnaRepartoOutput,
  type RepartoDoc,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { auth, db, oraServer, rifReparto, rifUtente, type InScrittura } from '../comune/admin';
import { richiediAdmin } from '../comune/autorizzazione';
import { codiceDi, definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';

const NOME = 'assegnaReparto';

export const assegnaReparto = definisciCallable(
  NOME,
  async (richiesta): Promise<AssegnaRepartoOutput> => {
    const admin = await richiediAdmin(richiesta);
    const { repartoId, coordinatoreUid } = validaInput(
      NOME,
      schemaAssegnaRepartoInput,
      richiesta.data,
    );

    await verificaAccountCoordinatore(coordinatoreUid);

    await db().runTransaction(async (transazione) => {
      const reparto = await transazione.get(rifReparto(repartoId));
      if (!reparto.exists) {
        throw errore('NON_TROVATO');
      }
      const destinatario = await transazione.get(rifUtente(coordinatoreUid));
      if (
        !destinatario.exists ||
        destinatario.get('ruolo') !== 'COORDINATORE' ||
        destinatario.get('attivo') !== true
      ) {
        throw errore('COORDINATORE_NON_VALIDO');
      }
      const prima: unknown = reparto.get('coordinatoreUid');
      const modifica: Pick<
        InScrittura<RepartoDoc>,
        'coordinatoreUid' | 'aggiornatoIl' | 'aggiornatoDa'
      > = {
        coordinatoreUid,
        aggiornatoIl: oraServer(),
        aggiornatoDa: admin.uid,
      };
      transazione.update(reparto.ref, modifica);
      transazione.create(
        rifNuovaVoce(repartoId),
        voceRegistro(admin, {
          tipo: 'reparto.assegnato',
          repartoId,
          dettagli: { prima: typeof prima === 'string' ? prima : null, dopo: coordinatoreUid },
        }),
      );
    });

    logger.info('Reparto assegnato', { repartoId, coordinatoreUid, autoreUid: admin.uid });
    return { repartoId, coordinatoreUid };
  },
);

/** Account Auth del destinatario: esistente, abilitato e con il claim COORDINATORE. */
async function verificaAccountCoordinatore(uid: string): Promise<void> {
  try {
    const record = await auth().getUser(uid);
    if (record.disabled || record.customClaims?.['ruolo'] !== 'COORDINATORE') {
      throw errore('COORDINATORE_NON_VALIDO');
    }
  } catch (e) {
    if (codiceDi(e) === 'auth/user-not-found') {
      throw errore('COORDINATORE_NON_VALIDO');
    }
    throw e;
  }
}
