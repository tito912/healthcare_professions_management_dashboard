// Costruttori per i test del dominio: configurazione di esempio e celle scritte con i codici.
// Non è esportato da index.ts e non conta nella copertura (vitest.config.mts).
import { chiaveMese, codiceAssenza, codiceTurno, dataISO, oraLocale } from './codici';
import type {
  AssenzaInCella,
  CellaDoc,
  Chiamata,
  ContrattoRiga,
  OrarioReale,
  ReperibilitaInCella,
  RigaDoc,
  TipologiaAssenzaDoc,
  TurnoDoc,
  TurnoInCella,
} from './documenti';
import type { ChiaveGiorno, ChiaveMese, DataISO, OraLocale } from './tipi';

export type TurnoDiProva = Pick<
  TurnoDoc,
  'codice' | 'tipo' | 'nome' | 'inizio' | 'fine' | 'pausaMinuti' | 'notturno' | 'attivo' | 'ordine'
>;
export type AssenzaDiProva = Pick<
  TipologiaAssenzaDoc,
  'codice' | 'descrizione' | 'effetto' | 'malattia' | 'attivo' | 'ordine'
>;

export const d = (testo: string): DataISO => dataISO(testo);
export const o = (testo: string): OraLocale => oraLocale(testo);
export const m = (testo: string): ChiaveMese => chiaveMese(testo);

function turno(
  codice: string,
  tipo: 'turno' | 'reperibilita',
  nome: string,
  inizio: string,
  fine: string,
  pausaMinuti: number,
  notturno: boolean,
  ordine: number,
  attivo = true,
): TurnoDiProva {
  return {
    codice: codiceTurno(codice),
    tipo,
    nome,
    inizio: o(inizio),
    fine: o(fine),
    pausaMinuti,
    notturno,
    attivo,
    ordine,
  };
}

/** Configurazione di esempio: tre turni, uno di 24 ore, uno disattivato; fasce da 4, 6 e 12 ore. */
export const TURNI: readonly TurnoDiProva[] = [
  turno('M1', 'turno', 'Mattina', '07:00', '14:00', 30, false, 1),
  turno('P1', 'turno', 'Pomeriggio', '14:00', '22:00', 30, false, 2),
  turno('N1', 'turno', 'Notte', '22:00', '07:00', 0, true, 3),
  turno('G1', 'turno', 'Guardia 24 ore', '08:00', '08:00', 0, true, 4),
  turno('S1', 'turno', 'Sera', '18:00', '00:00', 30, false, 5),
  turno('X1', 'turno', 'Vecchio turno', '09:00', '15:00', 30, false, 6, false),
  turno('R1', 'reperibilita', 'Reperibilità pomeriggio', '14:00', '20:00', 0, false, 7),
  turno('R2', 'reperibilita', 'Reperibilità notte', '20:00', '08:00', 0, true, 8),
  turno('R3', 'reperibilita', 'Reperibilità 8-12', '08:00', '12:00', 0, false, 9),
  turno('R4', 'reperibilita', 'Reperibilità 12-16', '12:00', '16:00', 0, false, 10),
  turno('R5', 'reperibilita', 'Reperibilità 16-20', '16:00', '20:00', 0, false, 11),
  turno('R9', 'reperibilita', 'Reperibilità dismessa', '08:00', '20:00', 0, false, 12, false),
];

function assenza(
  codice: string,
  descrizione: string,
  effetto: 'comeRiposo' | 'neutra',
  malattia: boolean,
  ordine: number,
  attivo = true,
): AssenzaDiProva {
  return { codice: codiceAssenza(codice), descrizione, effetto, malattia, attivo, ordine };
}

export const ASSENZE: readonly AssenzaDiProva[] = [
  assenza('R', 'Riposo', 'comeRiposo', false, 1),
  assenza('MA', 'Malattia', 'neutra', true, 2),
  assenza('F', 'Ferie', 'neutra', false, 3),
  assenza('S', 'Smonto', 'comeRiposo', false, 4),
  assenza('PX', 'Permesso dismesso', 'neutra', false, 5, false),
];

export const CONFIGURAZIONE = { turni: TURNI, assenze: ASSENZE } as const;

function trovaTurno(codice: string): TurnoDiProva {
  const trovato = TURNI.find((t) => t.codice === codice);
  if (trovato === undefined) {
    throw new Error(`turno di prova sconosciuto: ${codice}`);
  }
  return trovato;
}

function trovaAssenza(codice: string): AssenzaDiProva {
  const trovata = ASSENZE.find((a) => a.codice === codice);
  if (trovata === undefined) {
    throw new Error(`assenza di prova sconosciuta: ${codice}`);
  }
  return trovata;
}

export function turnoDiProva(codice: string): TurnoInCella {
  const t = trovaTurno(codice);
  return {
    codice: t.codice,
    inizio: t.inizio,
    fine: t.fine,
    pausaMinuti: t.pausaMinuti,
    notturno: t.notturno,
  };
}

export function assenzaDiProva(codice: string): AssenzaInCella {
  const a = trovaAssenza(codice);
  return { codice: a.codice, effetto: a.effetto, malattia: a.malattia };
}

export function reperibilitaDiProva(
  codice: string,
  chiamate: Chiamata[] = [],
  altro: Partial<Pick<ReperibilitaInCella, 'sostituisce' | 'copertaDa'>> = {},
): ReperibilitaInCella {
  const t = trovaTurno(codice);
  return {
    codice: t.codice,
    inizio: t.inizio,
    fine: t.fine,
    chiamate,
    sostituisce: altro.sostituisce ?? null,
    copertaDa: altro.copertaDa ?? null,
  };
}

export interface AltroCella {
  orarioReale?: OrarioReale;
  sostituisce?: string;
  copertoDa?: string;
  chiamata?: { codice: string; chiamata: Chiamata };
}

/**
 * Cella dai codici, nell'ordine in cui si scrivono: `cella('M1')`, `cella('M1', 'MA')`, `cella('R', 'R1', 'R2')`.
 * Il tipo di ogni codice si riconosce dalla configurazione di esempio.
 */
export function cella(...parti: (string | AltroCella)[]): CellaDoc {
  const risultato: CellaDoc = {
    turno: null,
    assenza: null,
    reperibilita: [],
    orarioReale: null,
    sostituisce: null,
    copertoDa: null,
  };
  for (const parte of parti) {
    if (typeof parte !== 'string') {
      risultato.orarioReale = parte.orarioReale ?? risultato.orarioReale;
      risultato.sostituisce = parte.sostituisce ?? risultato.sostituisce;
      risultato.copertoDa = parte.copertoDa ?? risultato.copertoDa;
      const chiamata = parte.chiamata;
      if (chiamata !== undefined) {
        risultato.reperibilita = risultato.reperibilita.map((r) =>
          r.codice === chiamata.codice ? { ...r, chiamate: [chiamata.chiamata] } : r,
        );
      }
      continue;
    }
    if (ASSENZE.some((a) => a.codice === parte)) {
      risultato.assenza = assenzaDiProva(parte);
    } else if (trovaTurno(parte).tipo === 'reperibilita') {
      risultato.reperibilita = [...risultato.reperibilita, reperibilitaDiProva(parte)];
    } else {
      risultato.turno = turnoDiProva(parte);
    }
  }
  return risultato;
}

export const CONTRATTO_PIENO: ContrattoRiga = {
  oreSettimanali: 36,
  dataAssunzione: null,
  dataCessazione: null,
};

/** Riga di prova: `giorni` con le chiavi a due cifre. */
export function riga(
  dipendenteId: string,
  giorni: Partial<Record<ChiaveGiorno, CellaDoc>>,
  contratto: ContrattoRiga = CONTRATTO_PIENO,
): Pick<RigaDoc, 'dipendenteId' | 'contratto' | 'giorni'> {
  return { dipendenteId, contratto, giorni };
}
