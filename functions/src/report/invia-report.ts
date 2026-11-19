// inviaReport (ARCHITETTURA §8): solo il coordinatore del reparto. Genera il file individuale di ogni dipendente e
// accoda una email per ciascuno con `ServizioPosta` (D12). L'indirizzo si legge da `privato/dati` solo qui, sul server.
// Registra esito e data per ogni dipendente in `report/{idBimestre}.invii`; chi non ha email è `senzaEmail` e non
// blocca gli altri. L'invio è ripetibile, anche per un solo dipendente. Con `anteprima` non scrive e non accoda: dice
// solo chi riceverebbe la email.
import {
  adessoMs,
  CONTEGGI_VUOTI,
  schemaInviaReportInput,
  scadenzaMail,
  validaEmail,
  type EsitoInvio,
  type IdBimestre,
  type InviaReportOutput,
} from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { db, oraServer } from '../comune/admin';
import { richiediCoordinatoreDi, type UtenteAbilitato } from '../comune/autorizzazione';
import { datiErroreSicuri, definisciCallable } from '../comune/errori';
import { rifNuovaVoce, voceRegistro } from '../comune/registro';
import { validaInput } from '../comune/validazione';
import { rifDipendenti, rifPrivato } from '../dipendenti/rif';
import { preparaReport, nomeDipendente, salvaReport, type DatiReport } from './calcolo';
import { generaExcelIndividuale } from './excel';
import { componiEmail } from './messaggi';
import { nomeFileIndividuale } from './nomi';
import { PostaTriggerEmail } from './posta/posta-trigger-email';
import type { ServizioPosta } from './posta/servizio-posta';
import { idMailAutomatica, rifReport } from './rif';
import { POSTA_MITTENTE } from '../comune/parametri';

const NOME = 'inviaReport';
/** Email preparate insieme (ogni file individuale è piccolo, ma le letture sono indipendenti). */
const INVII_IN_PARALLELO = 10;

export interface EsitoDipendente {
  readonly dipendenteId: string;
  readonly esito: EsitoInvio['esito'];
  readonly mailId: string | null;
}

export interface OpzioniInvio {
  readonly dati: DatiReport;
  /** null = tutti i dipendenti del report. */
  readonly dipendenteIds: readonly string[] | null;
  readonly anteprima: boolean;
  readonly automatico: boolean;
  readonly posta: ServizioPosta;
}

/** L'indirizzo del dipendente, solo lato server; null se manca o non è valido. */
export async function leggiEmail(repartoId: string, dipendenteId: string): Promise<string | null> {
  const snapshot = await rifPrivato(rifDipendenti(repartoId).doc(dipendenteId)).get();
  const email: unknown = snapshot.get('email');
  if (typeof email !== 'string') {
    return null;
  }
  const esito = validaEmail(email);
  return esito.valido ? esito.email : null;
}

/** I dipendenti a cui si invia: quelli richiesti che compaiono nel report, in ordine e senza doppioni. */
export function destinatari(
  dati: DatiReport,
  dipendenteIds: readonly string[] | null,
): readonly string[] {
  const nelReport = Object.keys(dati.conteggi.righe);
  if (dipendenteIds === null) {
    return nelReport;
  }
  const richiesti = new Set(dipendenteIds);
  return nelReport.filter((id) => richiesti.has(id));
}

async function inviaA(opzioni: OpzioniInvio, dipendenteId: string): Promise<EsitoDipendente> {
  const { dati } = opzioni;
  try {
    const email = await leggiEmail(dati.repartoId, dipendenteId);
    if (email === null) {
      return { dipendenteId, esito: 'senzaEmail', mailId: null };
    }
    if (opzioni.anteprima) {
      return { dipendenteId, esito: 'accodato', mailId: null };
    }
    const persona = dati.nomi.get(dipendenteId);
    const nomeCompleto = nomeDipendente(dati, dipendenteId);
    const file = await generaExcelIndividuale({
      nomeReparto: dati.nomeReparto,
      nomeDipendente: nomeCompleto,
      idBimestre: dati.idBimestre,
      mesi: dati.conteggi.mesiInclusi.map((chiave) => ({
        chiave,
        conteggi: dati.conteggi.perMese[chiave]?.[dipendenteId] ?? CONTEGGI_VUOTI,
      })),
      totale: dati.conteggi.righe[dipendenteId] ?? CONTEGGI_VUOTI,
      legenda: dati.legenda,
    });
    const testo = componiEmail({
      nomeReparto: dati.nomeReparto,
      nomeDipendente: persona?.nome ?? nomeCompleto,
      idBimestre: dati.idBimestre,
      mesiInclusi: dati.conteggi.mesiInclusi,
      parziale: dati.conteggi.mesiInclusi.length < 2,
    });
    const esitoPosta = await opzioni.posta.accoda({
      id: opzioni.automatico
        ? idMailAutomatica(dati.repartoId, dati.idBimestre, dipendenteId)
        : null,
      a: email,
      oggetto: testo.oggetto,
      testo: testo.testo,
      html: testo.html,
      allegati: [
        {
          nomeFile: nomeFileIndividuale(dati.idBimestre),
          contenutoBase64: file.toString('base64'),
        },
      ],
      scadeIlMs: scadenzaMail(adessoMs()),
      origine: {
        repartoId: dati.repartoId,
        idBimestre: dati.idBimestre,
        dipendenteId,
        automatico: opzioni.automatico,
      },
    });
    return { dipendenteId, esito: 'accodato', mailId: esitoPosta.mailId };
  } catch (e) {
    logger.error('Invio del report non riuscito', {
      repartoId: dati.repartoId,
      idBimestre: dati.idBimestre,
      dipendenteId,
      ...datiErroreSicuri(e),
    });
    return { dipendenteId, esito: 'errore', mailId: null };
  }
}

/**
 * Accoda le email e (se non è un'anteprima) registra esiti e voce di registro. Il documento del report deve esistere
 * già (`salvaReport`).
 */
export async function inviaEmailReport(
  opzioni: OpzioniInvio,
  autore: UtenteAbilitato | null,
): Promise<readonly EsitoDipendente[]> {
  const { dati } = opzioni;
  const ids = destinatari(dati, opzioni.dipendenteIds);
  const esiti: EsitoDipendente[] = [];
  for (let i = 0; i < ids.length; i += INVII_IN_PARALLELO) {
    esiti.push(
      ...(await Promise.all(ids.slice(i, i + INVII_IN_PARALLELO).map((id) => inviaA(opzioni, id)))),
    );
  }
  if (opzioni.anteprima || esiti.length === 0) {
    return esiti;
  }
  const invii: Record<string, { esito: EsitoInvio['esito']; il: unknown; mailId: string | null }> =
    {};
  for (const e of esiti) {
    invii[e.dipendenteId] = { esito: e.esito, il: oraServer(), mailId: e.mailId };
  }
  const conta = (esito: EsitoInvio['esito']): number =>
    esiti.filter((e) => e.esito === esito).length;
  const lotto = db().batch();
  lotto.set(rifReport(dati.repartoId, dati.idBimestre), { invii }, { merge: true });
  lotto.create(
    rifNuovaVoce(dati.repartoId),
    voceRegistro(autore, {
      tipo: 'report.inviato',
      repartoId: dati.repartoId,
      dettagli: {
        idBimestre: dati.idBimestre,
        automatico: opzioni.automatico,
        accodati: conta('accodato'),
        senzaEmail: conta('senzaEmail'),
        errori: conta('errore'),
      },
    }),
  );
  await lotto.commit();
  return esiti;
}

/** Il servizio di posta di produzione: l'estensione Trigger Email, col mittente del parametro (D12). */
export function postaPredefinita(): ServizioPosta {
  return new PostaTriggerEmail(POSTA_MITTENTE.value());
}

export async function eseguiInvio(
  repartoId: string,
  idBimestre: IdBimestre,
  dipendenteIds: readonly string[] | null,
  anteprima: boolean,
  autore: UtenteAbilitato,
  posta: ServizioPosta,
): Promise<readonly EsitoDipendente[]> {
  const dati = await preparaReport(repartoId, idBimestre);
  if (!anteprima) {
    await salvaReport(dati, autore.uid);
  }
  return inviaEmailReport({ dati, dipendenteIds, anteprima, automatico: false, posta }, autore);
}

export const inviaReport = definisciCallable(
  NOME,
  async (richiesta): Promise<InviaReportOutput> => {
    const input = validaInput(NOME, schemaInviaReportInput, richiesta.data);
    const autore = await richiediCoordinatoreDi(richiesta, input.repartoId);
    const esiti = await eseguiInvio(
      input.repartoId,
      input.idBimestre,
      input.dipendenteIds,
      input.anteprima === true,
      autore,
      postaPredefinita(),
    );
    logger.info('Invio del report', {
      repartoId: input.repartoId,
      idBimestre: input.idBimestre,
      autoreUid: autore.uid,
      anteprima: input.anteprima === true,
      dipendenti: esiti.length,
    });
    return { esiti: esiti.map(({ dipendenteId, esito }) => ({ dipendenteId, esito })) };
  },
  { timeoutSeconds: 300, memory: '512MiB' },
);
