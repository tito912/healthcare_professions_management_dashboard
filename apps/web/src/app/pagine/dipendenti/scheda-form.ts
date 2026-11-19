// Modulo della scheda del dipendente (UX §7.5) come dati puri: stato del form, validazione con le regole del
// dominio e costruzione dell'input di `salvaDipendente`. Nessuna dipendenza da Angular né da Firebase, così si
// prova senza il componente. Il form tiene tutto come testo, come arriva dai campi.
import {
  cessazioneDaConfermare,
  dataISO,
  dataNascitaPlausibile,
  eCodiceTurno,
  eDataISO,
  leggiOreSettimanali,
  LUNGHEZZA_CODICE_FISCALE,
  ORE_SETTIMANALI_PREDEFINITE,
  normalizzaCodiceFiscale,
  periodoServizioValido,
  validaCodiceFiscale,
  validaEmail,
  type AnagraficaInput,
  type CodiceTurno,
  type DataISO,
  type LeggiDatiPrivatiOutput,
  type SalvaDipendenteInput,
} from '@turni/domain';
import { testi } from '../../testi/it';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';

export interface FormDipendente {
  readonly nome: string;
  readonly cognome: string;
  readonly codiceFiscale: string;
  readonly dataNascita: string;
  readonly email: string;
  /** Ore settimanali come testo («36», «37,5»). */
  readonly ore: string;
  readonly turniEsclusi: readonly string[];
  readonly dataAssunzione: string;
  readonly dataCessazione: string;
  readonly attivo: boolean;
}

export type CampoForm =
  | 'nome'
  | 'cognome'
  | 'codiceFiscale'
  | 'dataNascita'
  | 'email'
  | 'ore'
  | 'dataAssunzione'
  | 'dataCessazione';

export type ErroriForm = Partial<Record<CampoForm, string>>;

export function formVuoto(): FormDipendente {
  return {
    nome: '',
    cognome: '',
    codiceFiscale: '',
    dataNascita: '',
    email: '',
    ore: String(ORE_SETTIMANALI_PREDEFINITE),
    turniEsclusi: [],
    dataAssunzione: '',
    dataCessazione: '',
    attivo: true,
  };
}

/** Ore come le scrive una persona: «36», «37,5». */
function oreComeTesto(ore: number): string {
  return String(ore).replace('.', ',');
}

/** Form di un dipendente esistente; i dati riservati si completano quando il server li ha restituiti. */
export function formDa(
  dipendente: DipendenteSalvato,
  privati: LeggiDatiPrivatiOutput | null,
): FormDipendente {
  return {
    nome: dipendente.nome,
    cognome: dipendente.cognome,
    codiceFiscale: privati?.codiceFiscale ?? '',
    dataNascita: privati?.dataNascita ?? '',
    email: privati?.email ?? '',
    ore: oreComeTesto(dipendente.oreSettimanali),
    turniEsclusi: [...dipendente.turniEsclusi],
    dataAssunzione: dipendente.dataAssunzione ?? '',
    dataCessazione: dipendente.dataCessazione ?? '',
    attivo: dipendente.attivo,
  };
}

/** Testo che identifica il contenuto del form: serve a sapere se ci sono modifiche non salvate. */
export function improntaForm(form: FormDipendente): string {
  return JSON.stringify({
    ...form,
    nome: form.nome.trim(),
    cognome: form.cognome.trim(),
    codiceFiscale: normalizzaCodiceFiscale(form.codiceFiscale),
    email: form.email.trim().toLowerCase(),
    turniEsclusi: [...form.turniEsclusi].sort(),
  });
}

/** Messaggio per un codice fiscale non valido (mentre si digita e al salvataggio); null se valido. */
export function erroreCodiceFiscale(testo: string): string | null {
  const esito = validaCodiceFiscale(testo);
  if (esito.valido) {
    return null;
  }
  switch (esito.motivo) {
    case 'vuoto':
      return testi.dipendenti.errori.cfVuoto;
    case 'lunghezza':
      return testi.dipendenti.errori.cfLunghezza;
    case 'formato':
      return testi.dipendenti.errori.cfFormato;
    case 'controllo':
      return testi.dipendenti.errori.cfControllo;
  }
}

/**
 * Il codice fiscale si segnala mentre si digita solo quando è completo (16 caratteri) o quando il campo è già
 * stato lasciato: così non si mostra un errore a chi sta ancora scrivendo.
 */
export function codiceFiscaleDaSegnalare(testo: string, toccato: boolean): boolean {
  return toccato || normalizzaCodiceFiscale(testo).length >= LUNGHEZZA_CODICE_FISCALE;
}

export interface ContestoForm {
  /** true = nuovo dipendente. */
  readonly nuovo: boolean;
  /** true se i dati riservati del dipendente esistente sono stati letti e si possono modificare. */
  readonly privatiCaricati: boolean;
  /** Giorno corrente 'AAAA-MM-GG', dal dominio. */
  readonly oggi: string;
}

/** Dati riservati nella forma normalizzata, per confrontarli con quelli letti dal server. */
interface PrivatiNormalizzati {
  readonly codiceFiscale: string;
  readonly dataNascita: DataISO;
  readonly email: string | null;
}

export type EsitoForm =
  | {
      readonly valido: true;
      readonly anagrafica: AnagraficaInput;
      /** null = dati riservati non cambiati (o non letti): il server li lascia invariati. */
      readonly privati: PrivatiNormalizzati | null;
    }
  | { readonly valido: false; readonly errori: ErroriForm };

function dataOpzionale(testo: string): DataISO | null | 'non valida' {
  if (testo === '') {
    return null;
  }
  return eDataISO(testo) ? testo : 'non valida';
}

/** Valida l'intero form con le regole del dominio. Con `privatiOriginali` si manda `privati` solo se cambiano. */
export function validaForm(
  form: FormDipendente,
  contesto: ContestoForm,
  privatiOriginali: LeggiDatiPrivatiOutput | null,
): EsitoForm {
  const errori: Record<string, string> = {};
  const nome = form.nome.trim();
  const cognome = form.cognome.trim();
  if (nome === '' || nome.length > 60) {
    errori['nome'] = testi.dipendenti.errori.nome;
  }
  if (cognome === '' || cognome.length > 60) {
    errori['cognome'] = testi.dipendenti.errori.cognome;
  }

  const ore = leggiOreSettimanali(form.ore);
  if (ore === null) {
    errori['ore'] = testi.dipendenti.errori.ore;
  }

  const assunzione = dataOpzionale(form.dataAssunzione);
  const cessazione = dataOpzionale(form.dataCessazione);
  if (assunzione === 'non valida') {
    errori['dataAssunzione'] = testi.dipendenti.errori.data;
  }
  if (cessazione === 'non valida') {
    errori['dataCessazione'] = testi.dipendenti.errori.data;
  }
  if (assunzione !== 'non valida' && cessazione !== 'non valida') {
    if (!form.attivo && cessazione === null) {
      errori['dataCessazione'] = testi.dipendenti.errori.cessazioneObbligatoria;
    } else if (!periodoServizioValido(assunzione, cessazione)) {
      errori['dataCessazione'] = testi.dipendenti.errori.cessazionePrimaAssunzione;
    }
  }

  // Dati riservati: sempre per un nuovo dipendente; per uno esistente solo se il server li ha restituiti.
  let privati: PrivatiNormalizzati | null = null;
  if (contesto.nuovo || contesto.privatiCaricati) {
    const erroreCf = erroreCodiceFiscale(form.codiceFiscale);
    if (erroreCf !== null) {
      errori['codiceFiscale'] = erroreCf;
    }
    let nascita: DataISO | null = null;
    if (form.dataNascita === '') {
      errori['dataNascita'] = testi.dipendenti.errori.nascitaVuota;
    } else if (
      !eDataISO(form.dataNascita) ||
      !dataNascitaPlausibile(form.dataNascita, contesto.oggi)
    ) {
      errori['dataNascita'] = testi.dipendenti.errori.nascitaNonValida;
    } else {
      nascita = form.dataNascita;
    }
    let email: string | null = null;
    if (form.email.trim() !== '') {
      const esito = validaEmail(form.email);
      if (esito.valido) {
        email = esito.email;
      } else {
        errori['email'] = testi.dipendenti.errori.email;
      }
    }
    const cf = validaCodiceFiscale(form.codiceFiscale);
    if (cf.valido && nascita !== null && errori['email'] === undefined) {
      const nuovi: PrivatiNormalizzati = { codiceFiscale: cf.codice, dataNascita: nascita, email };
      const invariati =
        privatiOriginali !== null &&
        normalizzaCodiceFiscale(privatiOriginali.codiceFiscale) === nuovi.codiceFiscale &&
        privatiOriginali.dataNascita === nuovi.dataNascita &&
        (privatiOriginali.email?.trim().toLowerCase() ?? null) === nuovi.email;
      privati = !contesto.nuovo && invariati ? null : nuovi;
    }
  }

  if (
    Object.keys(errori).length > 0 ||
    ore === null ||
    assunzione === 'non valida' ||
    cessazione === 'non valida'
  ) {
    return { valido: false, errori };
  }
  const turni: CodiceTurno[] = [...form.turniEsclusi].sort().filter(eCodiceTurno);
  return {
    valido: true,
    anagrafica: {
      nome,
      cognome,
      oreSettimanali: ore,
      turniEsclusi: turni,
      dataAssunzione: assunzione,
      dataCessazione: cessazione,
      attivo: form.attivo,
    },
    privati,
  };
}

/**
 * Vero se la cessazione del form è nuova (diversa da quella già salvata) e più vecchia di un anno: il coordinatore
 * deve confermarla prima dell'invio, perché un refuso nell'anno farebbe cancellare il dipendente (audit 4.4, I1).
 */
export function cessazioneDaConfermareNelForm(
  esito: Extract<EsitoForm, { valido: true }>,
  cessazioneSalvata: string | null,
  oggi: string,
): boolean {
  const cessazione = esito.anagrafica.dataCessazione;
  return (
    cessazione !== null &&
    eDataISO(cessazione) &&
    cessazione !== cessazioneSalvata &&
    cessazioneDaConfermare(cessazione, dataISO(oggi))
  );
}

/** Input della callable `salvaDipendente` da un form valido. */
export function inputSalvataggio(
  repartoId: string,
  dipendenteId: string | null,
  esito: Extract<EsitoForm, { valido: true }>,
  cessazioneConfermata = false,
): SalvaDipendenteInput {
  return {
    repartoId,
    dipendenteId,
    anagrafica: esito.anagrafica,
    privati: esito.privati,
    ...(cessazioneConfermata ? { cessazioneConfermata: true } : {}),
  };
}
