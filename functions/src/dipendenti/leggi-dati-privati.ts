// leggiDatiPrivati (ARCHITETTURA §8): restituisce in chiaro codice fiscale, data di nascita ed email di un
// dipendente, all'ADMIN o al coordinatore proprietario del reparto. Ogni lettura finisce nel registro attività
// (`dipendente.datiPrivatiLetti`) prima che i dati partano: se la voce non si scrive, la risposta è un errore.
import { dataISO, schemaLeggiDatiPrivatiInput, type LeggiDatiPrivatiOutput } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { richiediLettoreDi } from '../comune/autorizzazione';
import { definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import { aadCodiceFiscale, aadDataNascita, cifratoreCorrente } from './cifratura/cifratore';
import { rifDipendenti, rifPrivato } from './rif';

const NOME = 'leggiDatiPrivati';

export const leggiDatiPrivati = definisciCallable(
  NOME,
  async (richiesta): Promise<LeggiDatiPrivatiOutput> => {
    if (richiesta.auth === undefined) {
      throw errore('NON_AUTENTICATO');
    }
    const { repartoId, dipendenteId } = validaInput(
      NOME,
      schemaLeggiDatiPrivatiInput,
      richiesta.data,
    );
    const lettore = await richiediLettoreDi(richiesta, repartoId);

    const dipendente = rifDipendenti(repartoId).doc(dipendenteId);
    const [esistente, privato] = await Promise.all([
      dipendente.get(),
      rifPrivato(dipendente).get(),
    ]);
    if (!esistente.exists || !privato.exists) {
      throw errore('NON_TROVATO');
    }
    const codiceFiscaleCifrato: unknown = privato.get('codiceFiscaleCifrato');
    const dataNascitaCifrata: unknown = privato.get('dataNascitaCifrata');
    const email: unknown = privato.get('email');
    if (typeof codiceFiscaleCifrato !== 'string' || typeof dataNascitaCifrata !== 'string') {
      throw new Error('Dati riservati con forma inattesa.');
    }

    const cifratore = cifratoreCorrente();
    const [codiceFiscale, dataNascita] = await Promise.all([
      cifratore.decifra(codiceFiscaleCifrato, aadCodiceFiscale(dipendenteId)),
      cifratore.decifra(dataNascitaCifrata, aadDataNascita(dipendenteId)),
    ]);

    // Prima la traccia, poi i dati: una lettura non registrata non esiste.
    await rifNuovaVoce(repartoId).create(
      voceRegistro(lettore, {
        tipo: 'dipendente.datiPrivatiLetti',
        repartoId,
        dipendenteId,
        dettagli: { campi: 'codiceFiscale,dataNascita,email' },
      }),
    );

    logger.info('Dati riservati letti', { repartoId, dipendenteId, lettoreUid: lettore.uid });
    return {
      codiceFiscale,
      dataNascita: dataISO(dataNascita),
      email: typeof email === 'string' ? email : null,
    };
  },
);
