// La bozza della configurazione (UX §7.4): le modifiche restano locali fino a «Salva modifiche».
// Funzioni pure: partono dai dati salvati, validano con le regole del dominio e calcolano le scritture.
import {
  codiceAssenza,
  codiceTurno,
  durataConPausa,
  durataNominale,
  eNotturno,
  eOraLocale,
  ID_COLORI_TURNO,
  normalizzaCodice,
  oraLocale,
  pausaProposta,
  PALETTE_TURNI,
  TURNI_MODELLO,
  validaCodice,
  validaConfigurazioneFestivita,
  validaDescrizioneAssenza,
  validaTurno,
  type CodiceUsato,
  type ConfigurazioneFestivita,
  type IdColoreTurno,
  type MotivoErroreTurno,
} from '@turni/domain';
import type { AssenzaSalvata } from '../../../dati/assenze.repo';
import type { CampiTurno, Operazione } from '../../../dati/configurazione.repo';
import type { RepartoConfigurazione } from '../../../dati/reparti.repo';
import type { TurnoSalvato } from '../../../dati/turni.repo';
import { testiConfigurazione } from '../../../testi/it-configurazione';

/** Una riga della tabella dei turni o delle fasce. I campi sono testo, come li digita l'utente. */
export interface RigaTurno {
  /** Identità locale, stabile finché la pagina è aperta. */
  readonly chiave: number;
  /** Già presente nel database: il codice non si modifica più (è l'ID del documento). */
  readonly salvato: boolean;
  readonly codice: string;
  readonly nome: string;
  readonly colore: string;
  readonly inizio: string;
  readonly fine: string;
  readonly pausa: string;
  /** L'utente ha toccato la pausa: gli orari non la propongono più (D5). */
  readonly pausaScelta: boolean;
  readonly attivo: boolean;
}

export interface RigaAssenza {
  readonly chiave: number;
  readonly salvato: boolean;
  /** R e MA: non si modificano, non si disattivano, non si eliminano. */
  readonly predefinita: boolean;
  readonly codice: string;
  readonly descrizione: string;
  readonly effetto: 'comeRiposo' | 'neutra';
  readonly attivo: boolean;
}

export interface Bozza {
  readonly nome: string;
  readonly attribuzioneNotte: 'inizio' | 'fine';
  readonly turni: readonly RigaTurno[];
  readonly fasce: readonly RigaTurno[];
  readonly assenze: readonly RigaAssenza[];
  readonly festivita: ConfigurazioneFestivita;
  /**
   * Codici già a database all'apertura: una riga salvata tolta dalla bozza occupa il codice fino al salvataggio
   * (il documento esiste ancora e le regole non permettono di ricrearlo).
   */
  readonly codiciSalvati: readonly { readonly codice: string; readonly nome: string }[];
}

export interface DatiSalvati {
  readonly turni: readonly TurnoSalvato[];
  readonly assenze: readonly AssenzaSalvata[];
}

export type GeneraChiave = () => number;

function rigaDaSalvato(turno: TurnoSalvato, chiave: number): RigaTurno {
  return {
    chiave,
    salvato: true,
    codice: turno.codice,
    nome: turno.nome,
    colore: turno.colore ?? '',
    inizio: turno.inizio,
    fine: turno.fine,
    pausa: String(turno.pausaMinuti),
    pausaScelta: true,
    attivo: turno.attivo,
  };
}

/** Partenza: i dati salvati; per un reparto appena creato, senza turni né fasce, il modello (U11). */
export function bozzaIniziale(
  reparto: RepartoConfigurazione,
  salvati: DatiSalvati,
  chiave: GeneraChiave,
): Bozza {
  const turniSalvati = salvati.turni.filter((t) => t.tipo === 'turno');
  const fasceSalvate = salvati.turni.filter((t) => t.tipo === 'reperibilita');
  const usaModello = reparto.passo === 'turni' && salvati.turni.length === 0;
  const turni: RigaTurno[] = usaModello
    ? TURNI_MODELLO.map((m) => ({
        chiave: chiave(),
        salvato: false,
        codice: m.codice,
        nome: m.nome,
        colore: m.colore,
        inizio: m.inizio,
        fine: m.fine,
        pausa: String(m.pausaMinuti),
        pausaScelta: false,
        attivo: true,
      }))
    : turniSalvati.map((t) => rigaDaSalvato(t, chiave()));
  return {
    nome: reparto.nome,
    attribuzioneNotte: reparto.attribuzioneNotte,
    turni,
    fasce: fasceSalvate.map((t) => rigaDaSalvato(t, chiave())),
    assenze: salvati.assenze.map((a) => ({
      chiave: chiave(),
      salvato: true,
      predefinita: a.predefinita,
      codice: a.codice,
      descrizione: a.descrizione,
      effetto: a.effetto,
      attivo: a.attivo,
    })),
    festivita: reparto.festivita,
    codiciSalvati: [
      ...salvati.turni.map((t) => ({ codice: t.codice, nome: t.nome })),
      ...salvati.assenze.map((a) => ({ codice: a.codice, nome: a.descrizione })),
    ],
  };
}

/** Rappresentazione per confrontare la bozza con la partenza (le chiavi locali non contano). */
export function impronta(bozza: Bozza): string {
  return JSON.stringify(bozza, (campo, valore: unknown) =>
    campo === 'chiave' ? undefined : valore,
  );
}

/** Prima tinta della palette non ancora scelta da un altro turno (quando finiscono, ricomincia). */
function coloreLibero(turni: readonly RigaTurno[]): string {
  const usati = new Set(turni.map((t) => t.colore));
  return (PALETTE_TURNI.find((c) => !usati.has(c.id)) ?? PALETTE_TURNI[0])?.id ?? '';
}

export function nuovaRigaTurno(
  tipo: 'turno' | 'reperibilita',
  esistenti: readonly RigaTurno[],
  chiave: number,
): RigaTurno {
  return tipo === 'turno'
    ? {
        chiave,
        salvato: false,
        codice: '',
        nome: '',
        colore: coloreLibero(esistenti),
        inizio: '07:00',
        fine: '14:00',
        pausa: '30',
        pausaScelta: false,
        attivo: true,
      }
    : {
        chiave,
        salvato: false,
        codice: '',
        nome: '',
        colore: '',
        inizio: '14:00',
        fine: '20:00',
        pausa: '0',
        pausaScelta: true,
        attivo: true,
      };
}

export function nuovaRigaAssenza(chiave: number): RigaAssenza {
  return {
    chiave,
    salvato: false,
    predefinita: false,
    codice: '',
    descrizione: '',
    effetto: 'neutra',
    attivo: true,
  };
}

/** Cambia un campo di una riga; gli orari di un turno nuovo riproporranno la pausa (D5) finché non la si tocca. */
export function conCampo(
  riga: RigaTurno,
  tipo: 'turno' | 'reperibilita',
  campo: 'codice' | 'nome' | 'colore' | 'inizio' | 'fine' | 'pausa',
  valore: string,
): RigaTurno {
  switch (campo) {
    case 'codice':
      return { ...riga, codice: normalizzaCodice(valore) };
    case 'nome':
      return { ...riga, nome: valore };
    case 'colore':
      return { ...riga, colore: valore };
    case 'pausa':
      return { ...riga, pausa: valore, pausaScelta: true };
    case 'inizio':
    case 'fine': {
      const cambiata = campo === 'inizio' ? { ...riga, inizio: valore } : { ...riga, fine: valore };
      if (riga.pausaScelta || !eOraLocale(cambiata.inizio) || !eOraLocale(cambiata.fine)) {
        return cambiata;
      }
      return {
        ...cambiata,
        pausa: String(pausaProposta(tipo, oraLocale(cambiata.inizio), oraLocale(cambiata.fine))),
      };
    }
  }
}

/** Durata (con pausa) e notturno calcolati dal dominio; null finché gli orari non sono validi. */
export function calcoliRiga(
  riga: RigaTurno,
): { readonly durataMinuti: number; readonly notturno: boolean } | null {
  if (!eOraLocale(riga.inizio) || !eOraLocale(riga.fine)) {
    return null;
  }
  const pausa = Number(riga.pausa);
  const valida = riga.pausa.trim() !== '' && Number.isInteger(pausa) && pausa >= 0;
  const nominale = durataNominale(riga.inizio, riga.fine);
  return {
    durataMinuti: valida ? durataConPausa(riga.inizio, riga.fine, pausa) : nominale,
    notturno: eNotturno(riga.inizio, riga.fine),
  };
}

// ---------------------------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------------------------

export interface ErroriRigaTurno {
  codice?: string;
  nome?: string;
  colore?: string;
  inizio?: string;
  fine?: string;
  pausa?: string;
}

export interface ErroriRigaAssenza {
  codice?: string;
  descrizione?: string;
}

export interface ErroriBozza {
  readonly nome: string | null;
  readonly turni: ReadonlyMap<number, ErroriRigaTurno>;
  readonly fasce: ReadonlyMap<number, ErroriRigaTurno>;
  readonly assenze: ReadonlyMap<number, ErroriRigaAssenza>;
  readonly festivita: string | null;
  /** Nessun turno attivo: impedisce solo «Salva e continua». */
  readonly nessunTurno: boolean;
  /** Nessun campo da correggere (non considera `nessunTurno`). */
  readonly valida: boolean;
}

const MESSAGGI_TURNO: Record<MotivoErroreTurno, string> = {
  nomeVuoto: testiConfigurazione.errori.nomeVuoto,
  nomeTroppoLungo: testiConfigurazione.errori.nomeLungo,
  coloreMancante: testiConfigurazione.errori.coloreMancante,
  oraNonValida: testiConfigurazione.errori.oraNonValida,
  pausaNonValida: testiConfigurazione.errori.pausaNonValida,
  pausaTroppoLunga: testiConfigurazione.errori.pausaTroppoLunga,
};

function messaggioCodice(
  esito: ReturnType<typeof validaCodice>,
  tipo: 'turno' | 'assenza',
): string | null {
  if (esito.valido) {
    return null;
  }
  switch (esito.motivo) {
    case 'vuoto':
      return testiConfigurazione.errori.codiceVuoto;
    case 'formato':
    case 'altroGruppo':
      return tipo === 'turno'
        ? testiConfigurazione.errori.codiceTurno
        : testiConfigurazione.errori.codiceAssenza;
    case 'duplicato':
      return testiConfigurazione.errori.codiceUsato(
        esito.usatoDa?.codice ?? '',
        esito.usatoDa?.nome ?? '',
      );
  }
}

/** Tutti i codici in uso nella bozza (turni, fasce, assenze) con il nome per i messaggi. */
function codiciInUso(bozza: Bozza): readonly (CodiceUsato & { readonly chiave: number })[] {
  const righeTurno = [...bozza.turni, ...bozza.fasce].map((r) => ({
    chiave: r.chiave,
    codice: normalizzaCodice(r.codice),
    nome: r.nome.trim(),
  }));
  const righeAssenza = bozza.assenze.map((r) => ({
    chiave: r.chiave,
    codice: normalizzaCodice(r.codice),
    nome: r.descrizione.trim(),
  }));
  const presenti = new Set(
    [...bozza.turni, ...bozza.fasce, ...bozza.assenze]
      .filter((r) => r.salvato)
      .map((r) => normalizzaCodice(r.codice)),
  );
  // Righe salvate eliminate dalla bozza: il codice resta occupato fino al salvataggio dell'eliminazione.
  const eliminate = bozza.codiciSalvati
    .filter((c) => !presenti.has(c.codice))
    .map((c) => ({
      chiave: -1,
      codice: c.codice,
      nome: `${c.nome} (eliminato, non ancora salvato: salva prima l’eliminazione o scegli un altro codice)`,
    }));
  return [...righeTurno, ...righeAssenza, ...eliminate].filter((r) => r.codice !== '');
}

function erroriTurno(
  riga: RigaTurno,
  tipo: 'turno' | 'reperibilita',
  inUso: readonly (CodiceUsato & { readonly chiave: number })[],
): ErroriRigaTurno {
  const errori: ErroriRigaTurno = {};
  if (!riga.salvato) {
    const altri = inUso.filter((u) => u.chiave !== riga.chiave);
    const messaggio = messaggioCodice(validaCodice(riga.codice, 'turno', altri), 'turno');
    if (messaggio !== null) {
      errori.codice = messaggio;
    }
  }
  const pausa = riga.pausa.trim() === '' ? Number.NaN : Number(riga.pausa);
  const campi = validaTurno({
    tipo,
    nome: riga.nome,
    colore: tipo === 'turno' ? riga.colore : null,
    inizio: riga.inizio,
    fine: riga.fine,
    pausaMinuti: pausa,
  });
  if (campi.nome !== undefined) {
    errori.nome = MESSAGGI_TURNO[campi.nome];
  }
  if (campi.colore !== undefined) {
    errori.colore = MESSAGGI_TURNO[campi.colore];
  }
  if (campi.inizio !== undefined) {
    errori.inizio = MESSAGGI_TURNO[campi.inizio];
  }
  if (campi.fine !== undefined) {
    errori.fine = MESSAGGI_TURNO[campi.fine];
  }
  if (campi.pausa !== undefined) {
    errori.pausa = MESSAGGI_TURNO[campi.pausa];
  }
  return errori;
}

export function validaBozza(bozza: Bozza): ErroriBozza {
  const inUso = codiciInUso(bozza);
  const turni = new Map<number, ErroriRigaTurno>();
  const fasce = new Map<number, ErroriRigaTurno>();
  const assenze = new Map<number, ErroriRigaAssenza>();
  for (const riga of bozza.turni) {
    const errori = erroriTurno(riga, 'turno', inUso);
    if (Object.keys(errori).length > 0) {
      turni.set(riga.chiave, errori);
    }
  }
  for (const riga of bozza.fasce) {
    const errori = erroriTurno(riga, 'reperibilita', inUso);
    if (Object.keys(errori).length > 0) {
      fasce.set(riga.chiave, errori);
    }
  }
  for (const riga of bozza.assenze) {
    if (riga.predefinita) {
      continue;
    }
    const errori: ErroriRigaAssenza = {};
    if (!riga.salvato) {
      const altri = inUso.filter((u) => u.chiave !== riga.chiave);
      const messaggio = messaggioCodice(validaCodice(riga.codice, 'assenza', altri), 'assenza');
      if (messaggio !== null) {
        errori.codice = messaggio;
      }
    }
    const motivo = validaDescrizioneAssenza(riga.descrizione);
    if (motivo !== null) {
      errori.descrizione =
        motivo === 'descrizioneVuota'
          ? testiConfigurazione.errori.descrizioneVuota
          : testiConfigurazione.errori.descrizioneLunga;
    }
    if (Object.keys(errori).length > 0) {
      assenze.set(riga.chiave, errori);
    }
  }
  const nome = bozza.nome.trim();
  const erroreNome =
    nome === '' || nome.length > 60 ? testiConfigurazione.errori.nomeRepartoNonValido : null;
  const erroreFestivita =
    validaConfigurazioneFestivita(bozza.festivita) === null
      ? null
      : testiConfigurazione.errori.festivita;
  return {
    nome: erroreNome,
    turni,
    fasce,
    assenze,
    festivita: erroreFestivita,
    nessunTurno: !bozza.turni.some((t) => t.attivo),
    valida:
      erroreNome === null &&
      erroreFestivita === null &&
      turni.size === 0 &&
      fasce.size === 0 &&
      assenze.size === 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Scritture
// ---------------------------------------------------------------------------------------------

function coloreDa(valore: string): IdColoreTurno | null {
  return ID_COLORI_TURNO.find((id) => id === valore) ?? null;
}

/** I campi da scrivere per una riga già validata; il `notturno` è sempre quello calcolato dal dominio (L8). */
function campiDaRiga(riga: RigaTurno, tipo: 'turno' | 'reperibilita', ordine: number): CampiTurno {
  const inizio = oraLocale(riga.inizio);
  const fine = oraLocale(riga.fine);
  return {
    tipo,
    nome: riga.nome.trim(),
    colore: tipo === 'turno' ? coloreDa(riga.colore) : null,
    inizio,
    fine,
    pausaMinuti: tipo === 'turno' ? Number(riga.pausa) : 0,
    notturno: eNotturno(inizio, fine),
    attivo: riga.attivo,
    ordine,
  };
}

function uguali(a: CampiTurno, b: TurnoSalvato): boolean {
  return (
    a.nome === b.nome &&
    a.colore === b.colore &&
    a.inizio === b.inizio &&
    a.fine === b.fine &&
    a.pausaMinuti === b.pausaMinuti &&
    a.notturno === b.notturno &&
    a.attivo === b.attivo &&
    a.ordine === b.ordine
  );
}

/**
 * Le scritture che portano i dati salvati alla bozza. Presuppone una bozza valida. Turni e fasce condividono
 * la raccolta: l'ordine continua dai turni alle fasce. Le righe salvate che non compaiono più nella bozza si
 * eliminano (l'interfaccia lo permette solo prima di completare la configurazione, L29: le regole lo impongono).
 */
export function pianoDiSalvataggio(bozza: Bozza, salvati: DatiSalvati): readonly Operazione[] {
  const operazioni: Operazione[] = [];
  const righe = [
    ...bozza.turni.map((riga) => ({ riga, tipo: 'turno' as const })),
    ...bozza.fasce.map((riga) => ({ riga, tipo: 'reperibilita' as const })),
  ];
  righe.forEach(({ riga, tipo }, indice) => {
    const campi = campiDaRiga(riga, tipo, indice);
    const codice = codiceTurno(normalizzaCodice(riga.codice));
    const precedente = salvati.turni.find((t) => t.codice === codice);
    if (!riga.salvato || precedente === undefined) {
      operazioni.push({ tipo: 'creaTurno', codice, campi });
    } else if (!uguali(campi, precedente)) {
      operazioni.push({
        tipo: 'aggiornaTurno',
        codice,
        campi: {
          nome: campi.nome,
          colore: campi.colore,
          inizio: campi.inizio,
          fine: campi.fine,
          pausaMinuti: campi.pausaMinuti,
          notturno: campi.notturno,
          attivo: campi.attivo,
          ordine: campi.ordine,
        },
      });
    }
  });
  for (const precedente of salvati.turni) {
    if (!righe.some(({ riga }) => normalizzaCodice(riga.codice) === precedente.codice)) {
      operazioni.push({ tipo: 'eliminaTurno', codice: precedente.codice });
    }
  }

  const personalizzate = bozza.assenze.filter((a) => !a.predefinita);
  personalizzate.forEach((riga, indice) => {
    const codice = codiceAssenza(normalizzaCodice(riga.codice));
    const campi = {
      descrizione: riga.descrizione.trim(),
      effetto: riga.effetto,
      attivo: riga.attivo,
      ordine: indice + 2,
    };
    const precedente = salvati.assenze.find((a) => a.codice === codice);
    if (!riga.salvato || precedente === undefined) {
      operazioni.push({ tipo: 'creaAssenza', codice, campi });
    } else if (
      precedente.descrizione !== campi.descrizione ||
      precedente.effetto !== campi.effetto ||
      precedente.attivo !== campi.attivo ||
      precedente.ordine !== campi.ordine
    ) {
      operazioni.push({ tipo: 'aggiornaAssenza', codice, campi });
    }
  });
  for (const precedente of salvati.assenze) {
    if (
      !precedente.predefinita &&
      !personalizzate.some((a) => normalizzaCodice(a.codice) === precedente.codice)
    ) {
      operazioni.push({ tipo: 'eliminaAssenza', codice: precedente.codice });
    }
  }
  return operazioni;
}

/** Codici dei turni già salvati di cui la bozza cambia inizio, fine o pausa: chiedono conferma (UX §7.4). */
export function turniConOrarioCambiato(bozza: Bozza, salvati: DatiSalvati): readonly string[] {
  const cambiati: string[] = [];
  for (const riga of [...bozza.turni, ...bozza.fasce]) {
    const precedente = salvati.turni.find((t) => t.codice === normalizzaCodice(riga.codice));
    if (!riga.salvato || precedente === undefined) {
      continue;
    }
    const pausa = riga.pausa.trim() === '' ? Number.NaN : Number(riga.pausa);
    if (
      precedente.inizio !== riga.inizio ||
      precedente.fine !== riga.fine ||
      (precedente.tipo === 'turno' && precedente.pausaMinuti !== pausa)
    ) {
      cambiati.push(precedente.codice);
    }
  }
  return cambiati;
}
