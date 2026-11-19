// Modello puro del Registro attività (UX §7.12): da una voce alla riga mostrata, senza Angular né Firestore.
import { formattaDataDaMs, formattaOraDaMs } from '@turni/domain';
import type { VoceRegistro } from '../../dati/registro.repo';
import { testiRegistro } from '../../testi/it-registro';

export interface RigaRegistro {
  readonly id: string;
  readonly dataOra: string;
  readonly utente: string;
  readonly reparto: string;
  readonly operazione: string;
  readonly dettagli: string;
}

export interface ContestoRegistro {
  /** Nome del reparto dato l'ID; undefined se il reparto non è tra quelli noti. */
  readonly nomeReparto: (repartoId: string) => string | undefined;
  /** Nome del dipendente dato reparto e ID: stringa se esiste, `null` se non esiste più, undefined se non ancora noto. */
  readonly nomeDipendente: (repartoId: string, dipendenteId: string) => string | null | undefined;
  /** Nome dell'utente (ADMIN o coordinatore) dato l'uid; undefined se non si conosce. */
  readonly nomeUtente: (uid: string) => string | undefined;
}

/** Nome di un collega citato in una voce: `null` = non esiste più, undefined = non ancora noto. */
type NomeCollega = (idCollega: string) => string | null | undefined;

/** Campi del consuntivo il cui valore è l'ID di un collega, o un elenco `fascia:ID` separato da virgole. */
const CAMPI_COLLEGA = new Set(['sostituisce', 'copertoDa']);
const CAMPI_COLLEGA_PER_FASCIA = new Set(['reperibilitaSostituisce', 'reperibilitaCopertaDa']);

function nomeDelCollega(id: string, nomeCollega: NomeCollega): string {
  const nome = nomeCollega(id);
  return nome === undefined
    ? testiRegistro.collegaInCaricamento
    : (nome ?? testiRegistro.dipendenteRimosso);
}

/** Valore di un campo del consuntivo; per i campi che contengono ID di colleghi li sostituisce con i nomi. */
function valoreConsuntivo(
  campo: string,
  v: string | number | boolean | null | undefined,
  nomeCollega: NomeCollega | undefined,
): string {
  if (nomeCollega === undefined || typeof v !== 'string' || v === '') {
    return valore(v);
  }
  if (CAMPI_COLLEGA.has(campo)) {
    return nomeDelCollega(v, nomeCollega);
  }
  if (CAMPI_COLLEGA_PER_FASCIA.has(campo)) {
    return v
      .split(',')
      .map((parte) => {
        const separatore = parte.indexOf(':');
        return separatore < 0
          ? parte
          : `${parte.slice(0, separatore)}:${nomeDelCollega(parte.slice(separatore + 1), nomeCollega)}`;
      })
      .join(',');
  }
  return valore(v);
}

function valore(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') {
    return testiRegistro.valoreVuoto;
  }
  return typeof v === 'boolean' ? (v ? 'sì' : 'no') : String(v);
}

function numero(v: string | number | boolean | null | undefined): number {
  return typeof v === 'number' ? v : 0;
}

/** «05/11» da giorno '05' e mese 'AAAA-MM'. */
function giornoMese(
  giorno: string | number | boolean | null | undefined,
  chiaveMese: string | null,
): string {
  const g = valore(giorno);
  return chiaveMese === null ? g : `${g}/${chiaveMese.slice(5, 7)}`;
}

/** Testo dei dettagli: solo codici, orari, conteggi e ID già presenti nella voce, mai altri dati. */
export function testoDettagli(voce: VoceRegistro, nomeCollega?: NomeCollega): string {
  const d = voce.dettagli;
  if (voce.tipo === 'pulizia.eseguita') {
    const base =
      d['modalitaProva'] === true
        ? testiRegistro.pulizia.prova(numero(d['dipendentiTrovati']), numero(d['fileScaduti']))
        : testiRegistro.pulizia.eseguita(
            numero(d['dipendentiEliminati']),
            numero(d['fileEliminati']),
          );
    return numero(d['errori']) > 0
      ? base + testiRegistro.pulizia.conErrori(numero(d['errori']))
      : base;
  }
  if (voce.tipo === 'consuntivo.modificato') {
    const campo = typeof d['campo'] === 'string' ? d['campo'] : '';
    return testiRegistro.consuntivo(
      giornoMese(d['giorno'], voce.chiaveMese),
      testiRegistro.campi[campo] ?? campo,
      valoreConsuntivo(campo, d['prima'], nomeCollega),
      valoreConsuntivo(campo, d['dopo'], nomeCollega),
    );
  }
  const parti = Object.entries(d).map(
    ([chiave, v]) =>
      `${testiRegistro.chiaviDettaglio[chiave] ?? chiave}: ${
        chiave === 'motivo' && typeof v === 'string' ? (testiRegistro.motivi[v] ?? v) : valore(v)
      }`,
  );
  if (voce.chiaveMese !== null) {
    parti.unshift(voce.chiaveMese);
  }
  return parti.join(' · ');
}

/**
 * Chi ha fatto l'operazione (audit 4.4, I2): il nome scritto nella voce, altrimenti quello dell'utente con quell'uid.
 * «Sistema» solo per le voci senza autore (`autoreUid` nullo): una voce con autore mai si attribuisce al sistema.
 */
function utenteDiVoce(voce: VoceRegistro, contesto: ContestoRegistro): string {
  if (voce.autoreNome !== null) {
    return voce.autoreNome;
  }
  if (voce.autoreUid === null) {
    return testiRegistro.sistema;
  }
  return contesto.nomeUtente(voce.autoreUid) ?? testiRegistro.utenteNonDisponibile;
}

export function rigaDiVoce(voce: VoceRegistro, contesto: ContestoRegistro): RigaRegistro {
  const reparto =
    voce.repartoId === null
      ? testiRegistro.nessunReparto
      : (contesto.nomeReparto(voce.repartoId) ?? testiRegistro.reparto.sconosciuto);
  const repartoVoce = voce.repartoId;
  let dettagli = testoDettagli(
    voce,
    repartoVoce === null ? undefined : (id) => contesto.nomeDipendente(repartoVoce, id),
  );
  if (voce.dipendenteId !== null && voce.repartoId !== null) {
    const nome = contesto.nomeDipendente(voce.repartoId, voce.dipendenteId);
    if (nome !== undefined) {
      dettagli = `${nome ?? testiRegistro.dipendenteRimosso}${dettagli === '' ? '' : ` · ${dettagli}`}`;
    }
  }
  return {
    id: voce.id,
    dataOra: `${formattaDataDaMs(voce.ilMs)} ${formattaOraDaMs(voce.ilMs)}`,
    utente: utenteDiVoce(voce, contesto),
    reparto,
    operazione: testiRegistro.operazioni[voce.tipo],
    dettagli,
  };
}
