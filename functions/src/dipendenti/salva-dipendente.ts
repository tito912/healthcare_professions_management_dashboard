// salvaDipendente (ARCHITETTURA §8): crea o aggiorna un dipendente in un'unica transazione: documento
// pubblico, `privato/dati` (codice fiscale e data di nascita cifrati, HMAC, email) e indice dei codici fiscali
// (`indiceCodiciFiscali/{hmac}`, creato con `create()`: se esiste già è un doppione). Voce di registro
// `dipendente.salvato` nella stessa transazione, con i soli nomi dei campi cambiati.
//
// Dati personali: mai nei log né nei messaggi d'errore. Il doppione risponde CF_DUPLICATO senza dire dove
// si trova l'altro dipendente.
import {
  cessazioneDaConfermare,
  dataISO,
  dataNascitaPlausibile,
  oggi,
  schemaSalvaDipendenteInput,
  validaCodiceFiscale,
  validaEmail,
  type Anagrafica,
  type DatiPrivatiDoc,
  type DipendenteDoc,
  type IndiceCodiceFiscaleDoc,
  type SalvaDipendenteOutput,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import type { DocumentReference, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { db, oraServer, type InScrittura } from '../comune/admin';
import { richiediCoordinatoreDi, type UtenteAbilitato } from '../comune/autorizzazione';
import { definisciCallable, errore } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import {
  aadCodiceFiscale,
  aadDataNascita,
  cifratoreCorrente,
  type Cifratore,
} from './cifratura/cifratore';
import { chiaveHmacCorrente, hmacCodiceFiscale, segretiDellaFunzione } from './cifratura/hmac';
import { rifDipendenti, rifIndiceCodiceFiscale, rifPrivato } from './rif';

const NOME = 'salvaDipendente';

/** Dati riservati già verificati: codice fiscale normalizzato, data di nascita plausibile, email normalizzata. */
interface PrivatiValidati {
  readonly codiceFiscale: string;
  readonly dataNascita: string;
  readonly email: string | null;
}

/** Dati riservati pronti da scrivere: cifrati, con l'HMAC. */
interface PrivatiCifrati {
  readonly hmac: string;
  readonly documento: Omit<InScrittura<DatiPrivatiDoc>, 'aggiornatoIl'>;
}

export const salvaDipendente = definisciCallable(
  NOME,
  async (richiesta): Promise<SalvaDipendenteOutput> => {
    if (richiesta.auth === undefined) {
      throw errore('NON_AUTENTICATO');
    }
    const input = validaInput(NOME, schemaSalvaDipendenteInput, richiesta.data);
    const autore = await richiediCoordinatoreDi(richiesta, input.repartoId);

    const creazione = input.dipendenteId === null;
    const privati = input.privati === null ? null : verificaPrivati(input.privati);
    if (creazione && privati === null) {
      logger.warn('Dati riservati obbligatori in creazione', { funzione: NOME });
      throw errore('INPUT_NON_VALIDO');
    }

    const riferimento =
      input.dipendenteId === null
        ? rifDipendenti(input.repartoId).doc()
        : rifDipendenti(input.repartoId).doc(input.dipendenteId);
    const dipendenteId = riferimento.id;
    // Cifratura e HMAC fuori dalla transazione: sono chiamate di rete che la transazione potrebbe ripetere.
    const cifrati = privati === null ? null : await cifraPrivati(privati, dipendenteId);

    const fatto = await db().runTransaction((transazione) =>
      scrivi(transazione, {
        repartoId: input.repartoId,
        riferimento,
        creazione,
        anagrafica: input.anagrafica,
        cifrati,
        autore,
        cessazioneConfermata: input.cessazioneConfermata,
      }),
    );

    logger.info('Dipendente salvato', {
      repartoId: input.repartoId,
      dipendenteId,
      autoreUid: autore.uid,
      creato: creazione,
      scritto: fatto,
    });
    return { dipendenteId };
  },
  { secrets: segretiDellaFunzione() },
);

/** Controlli con errore proprio (CF_NON_VALIDO, EMAIL_NON_VALIDA); nei log solo il tipo di problema. */
function verificaPrivati(grezzi: {
  readonly codiceFiscale: string;
  readonly dataNascita: string;
  readonly email: string | null;
}): PrivatiValidati {
  const cf = validaCodiceFiscale(grezzi.codiceFiscale);
  if (!cf.valido) {
    logger.warn('Codice fiscale non valido', { funzione: NOME, motivo: cf.motivo });
    throw errore('CF_NON_VALIDO');
  }
  if (!dataNascitaPlausibile(grezzi.dataNascita, oggi())) {
    logger.warn('Data di nascita non plausibile', { funzione: NOME });
    throw errore('INPUT_NON_VALIDO');
  }
  let email: string | null = null;
  if (grezzi.email !== null) {
    const esito = validaEmail(grezzi.email);
    if (!esito.valido) {
      logger.warn('Email non valida', { funzione: NOME, motivo: esito.motivo });
      throw errore('EMAIL_NON_VALIDA');
    }
    email = esito.email;
  }
  return { codiceFiscale: cf.codice, dataNascita: grezzi.dataNascita, email };
}

async function cifraPrivati(
  privati: PrivatiValidati,
  dipendenteId: string,
  cifratore: Cifratore = cifratoreCorrente(),
): Promise<PrivatiCifrati> {
  const hmac = hmacCodiceFiscale(chiaveHmacCorrente(), privati.codiceFiscale);
  const [codiceFiscale, dataNascita] = await Promise.all([
    cifratore.cifra(privati.codiceFiscale, aadCodiceFiscale(dipendenteId)),
    cifratore.cifra(privati.dataNascita, aadDataNascita(dipendenteId)),
  ]);
  return {
    hmac,
    documento: {
      codiceFiscaleCifrato: codiceFiscale.cifrato,
      dataNascitaCifrata: dataNascita.cifrato,
      hmacCodiceFiscale: hmac,
      email: privati.email,
      chiaveKms: codiceFiscale.chiave,
    },
  };
}

interface ParametriScrittura {
  readonly repartoId: string;
  readonly riferimento: DocumentReference;
  readonly creazione: boolean;
  readonly anagrafica: Anagrafica;
  readonly cifrati: PrivatiCifrati | null;
  readonly autore: UtenteAbilitato;
  readonly cessazioneConfermata: boolean;
}

/** Nomi dei campi pubblici che cambiano rispetto al documento salvato. */
function campiCambiati(esistente: DocumentSnapshot, nuova: Anagrafica): string[] {
  const confronti: [string, unknown][] = [
    ['nome', nuova.nome],
    ['cognome', nuova.cognome],
    ['oreSettimanali', nuova.oreSettimanali],
    ['turniEsclusi', nuova.turniEsclusi],
    ['dataAssunzione', nuova.dataAssunzione],
    ['dataCessazione', nuova.dataCessazione],
    ['attivo', nuova.attivo],
  ];
  return confronti
    .filter(([campo, valore]) => JSON.stringify(esistente.get(campo)) !== JSON.stringify(valore))
    .map(([campo]) => campo);
}

/** Tutte le letture prima delle scritture (regola delle transazioni). Restituisce true se ha scritto. */
async function scrivi(transazione: Transaction, p: ParametriScrittura): Promise<boolean> {
  const esistente = await transazione.get(p.riferimento);
  if (!p.creazione && !esistente.exists) {
    throw errore('NON_TROVATO');
  }
  // Audit 4.4, I1: una cessazione di oltre un anno fa porterebbe alla cancellazione definitiva dopo il periodo di
  // grazia; un refuso nell'anno è la causa più probabile, quindi serve la conferma esplicita. Non si richiede se
  // la data è quella già salvata (altra modifica dello stesso dipendente).
  const cessazione = p.anagrafica.dataCessazione;
  if (
    cessazione !== null &&
    !p.cessazioneConfermata &&
    cessazioneDaConfermare(cessazione, dataISO(oggi())) &&
    (p.creazione || esistente.get('dataCessazione') !== cessazione)
  ) {
    logger.warn('Data di cessazione da confermare', { funzione: NOME, repartoId: p.repartoId });
    throw errore('CESSAZIONE_DA_CONFERMARE');
  }
  const privatoRif = rifPrivato(p.riferimento);
  const privatoEsistente =
    p.cifrati !== null && !p.creazione ? await transazione.get(privatoRif) : null;
  const hmacPrecedente: unknown = privatoEsistente?.get('hmacCodiceFiscale');

  // Indice dei codici fiscali: nuovo indice libero (altrimenti doppione) e vecchio indice da spostare.
  const cambiaIndice = p.cifrati !== null && p.cifrati.hmac !== hmacPrecedente;
  let vecchioIndice: DocumentSnapshot | null = null;
  if (p.cifrati !== null && cambiaIndice) {
    const nuovoIndice = await transazione.get(rifIndiceCodiceFiscale(p.cifrati.hmac));
    if (nuovoIndice.exists) {
      throw errore('CF_DUPLICATO');
    }
    if (typeof hmacPrecedente === 'string' && hmacPrecedente !== '') {
      vecchioIndice = await transazione.get(rifIndiceCodiceFiscale(hmacPrecedente));
    }
  }

  const cambiati = p.creazione ? [] : campiCambiati(esistente, p.anagrafica);
  if (!p.creazione && cambiati.length === 0 && p.cifrati === null) {
    return false;
  }

  // --- scritture ---------------------------------------------------------------------------------
  const pubblico = {
    nome: p.anagrafica.nome,
    cognome: p.anagrafica.cognome,
    oreSettimanali: p.anagrafica.oreSettimanali,
    turniEsclusi: p.anagrafica.turniEsclusi,
    dataAssunzione: p.anagrafica.dataAssunzione,
    dataCessazione: p.anagrafica.dataCessazione,
    attivo: p.anagrafica.attivo,
    aggiornatoIl: oraServer(),
    aggiornatoDa: p.autore.uid,
  } satisfies Omit<InScrittura<DipendenteDoc>, 'creatoIl'>;
  if (p.creazione) {
    const documento: InScrittura<DipendenteDoc> = { ...pubblico, creatoIl: oraServer() };
    transazione.create(p.riferimento, documento);
  } else {
    transazione.update(p.riferimento, pubblico);
  }

  if (p.cifrati !== null) {
    const documento: InScrittura<DatiPrivatiDoc> = {
      ...p.cifrati.documento,
      aggiornatoIl: oraServer(),
    };
    transazione.set(privatoRif, documento);
    if (cambiaIndice) {
      const indice: InScrittura<IndiceCodiceFiscaleDoc> = {
        repartoId: p.repartoId,
        dipendenteId: p.riferimento.id,
        creatoIl: oraServer(),
      };
      transazione.create(rifIndiceCodiceFiscale(p.cifrati.hmac), indice);
      // Si elimina il vecchio indice solo se è davvero di questo dipendente.
      if (
        vecchioIndice?.exists === true &&
        vecchioIndice.get('dipendenteId') === p.riferimento.id &&
        vecchioIndice.get('repartoId') === p.repartoId
      ) {
        transazione.delete(vecchioIndice.ref);
      }
    }
  }

  // Solo nomi dei campi: mai i valori, nemmeno quelli pubblici (nomi e cognomi sono dati personali).
  transazione.create(
    rifNuovaVoce(p.repartoId),
    voceRegistro(p.autore, {
      tipo: 'dipendente.salvato',
      repartoId: p.repartoId,
      dipendenteId: p.riferimento.id,
      dettagli: p.creazione
        ? { azione: 'creato' }
        : { azione: 'modificato', campi: cambiati.join(','), datiPrivati: p.cifrati !== null },
    }),
  );
  return true;
}
