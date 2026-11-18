// Validazione di un turno o di una fascia di reperibilità prima del salvataggio (stessi limiti di firestore.rules).
import { eOraLocale } from '../codici';
import { ID_COLORI_TURNO } from '../tipi';
import { durataNominale } from './durata';
import { PAUSA_MASSIMA_MINUTI } from './pausa';

export const LUNGHEZZA_MASSIMA_NOME_TURNO = 40;

export interface DefinizioneTurno {
  readonly tipo: 'turno' | 'reperibilita';
  readonly nome: string;
  /** Id della palette; obbligatorio per i turni, ignorato per le reperibilità. */
  readonly colore: string | null;
  readonly inizio: string;
  readonly fine: string;
  readonly pausaMinuti: number;
}

export type CampoTurno = 'nome' | 'colore' | 'inizio' | 'fine' | 'pausa';
export type MotivoErroreTurno =
  | 'nomeVuoto'
  | 'nomeTroppoLungo'
  | 'coloreMancante'
  | 'oraNonValida'
  | 'pausaNonValida'
  | 'pausaTroppoLunga';

/** Errori per campo; l'oggetto è vuoto se la definizione è valida. */
export function validaTurno(
  definizione: DefinizioneTurno,
): Partial<Record<CampoTurno, MotivoErroreTurno>> {
  const errori: Partial<Record<CampoTurno, MotivoErroreTurno>> = {};
  const nome = definizione.nome.trim();
  if (nome === '') {
    errori.nome = 'nomeVuoto';
  } else if (nome.length > LUNGHEZZA_MASSIMA_NOME_TURNO) {
    errori.nome = 'nomeTroppoLungo';
  }
  if (definizione.tipo === 'turno' && !ID_COLORI_TURNO.some((id) => id === definizione.colore)) {
    errori.colore = 'coloreMancante';
  }
  if (!eOraLocale(definizione.inizio)) {
    errori.inizio = 'oraNonValida';
  }
  if (!eOraLocale(definizione.fine)) {
    errori.fine = 'oraNonValida';
  }
  const pausa = definizione.pausaMinuti;
  if (
    !Number.isInteger(pausa) ||
    pausa < 0 ||
    (definizione.tipo === 'reperibilita' && pausa !== 0)
  ) {
    errori.pausa = 'pausaNonValida';
  } else if (pausa > PAUSA_MASSIMA_MINUTI) {
    errori.pausa = 'pausaTroppoLunga';
  } else if (
    eOraLocale(definizione.inizio) &&
    eOraLocale(definizione.fine) &&
    pausa >= durataNominale(definizione.inizio, definizione.fine)
  ) {
    errori.pausa = 'pausaTroppoLunga';
  }
  return errori;
}
