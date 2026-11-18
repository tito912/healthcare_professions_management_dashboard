// Classificazione del giorno (D6, L11): feriale, sabato, domenica, festivo nazionale o locale.
import type { CalendarioMese } from '../documenti';
import { ID_FESTIVITA_NAZIONALI, type ChiaveMese, type DataISO, type OraLocale } from '../tipi';
import { eNotturno } from '../turni/notturno';
import type { Festivita } from './festivita';
import { dataDelGiorno, eChiaveGiorno, giornoDellaSettimana, spostaGiorni } from './mesi';

export type TipoGiorno = 'feriale' | 'sabato' | 'domenica' | 'festivoNazionale' | 'festivoLocale';

export interface ClassificazioneGiorno {
  readonly tipo: TipoGiorno;
  /** La festività del giorno, se c'è (anche quando cade di sabato o di domenica). */
  readonly festivita: Festivita | null;
}

const SABATO = 6;
const DOMENICA = 7;

/**
 * Tipo del giorno con priorità festivo > domenica > sabato (L11): un sabato festivo è festivo.
 * `festivita` sono le festività del reparto (`festivitaReparto()` o `festivitaDelMese()`); può contenere più anni.
 */
export function classificaGiorno(
  data: DataISO,
  festivita: readonly Festivita[],
): ClassificazioneGiorno {
  const festa = festivita.find((f) => f.data === data) ?? null;
  if (festa !== null) {
    return {
      tipo: festa.tipo === 'nazionale' ? 'festivoNazionale' : 'festivoLocale',
      festivita: festa,
    };
  }
  const giorno = giornoDellaSettimana(data);
  if (giorno === DOMENICA) {
    return { tipo: 'domenica', festivita: null };
  }
  return { tipo: giorno === SABATO ? 'sabato' : 'feriale', festivita: null };
}

/** Vero per sabato, domenica e festivi: i giorni senza ore dovute (D4). */
export function eGiornoNonLavorativo(data: DataISO, festivita: readonly Festivita[]): boolean {
  return classificaGiorno(data, festivita).tipo !== 'feriale';
}

/**
 * Le festività copiate nel documento del mese (`calendario.festivita`) come elenco con la data. Il tipo si
 * ricava dall'id: nazionale se è uno degli id nazionali, altrimenti locale. I giorni che il mese non ha si scartano.
 */
export function festivitaDelMese(
  chiave: ChiaveMese,
  festivita: CalendarioMese['festivita'],
): readonly Festivita[] {
  const elenco: Festivita[] = [];
  for (const [giorno, festa] of Object.entries(festivita)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiave, giorno) : null;
    if (data === null || festa === undefined) {
      continue;
    }
    const nazionale = ID_FESTIVITA_NAZIONALI.some((id) => id === festa.id);
    elenco.push({ id: festa.id, nome: festa.nome, data, tipo: nazionale ? 'nazionale' : 'locale' });
  }
  return elenco.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Giorno a cui si attribuisce un turno per sabati, domeniche e festivi (D6). Solo i turni notturni (L8: 22:00-07:00,
 * 24 ore) cambiano giorno con `'fine'`; un turno che termina alle 00:00 resta nel giorno in cui inizia.
 * Le ore restano sempre al mese del giorno di inizio (L10): questa funzione serve solo alla classificazione.
 */
export function giornoDiAttribuzione(
  giorno: DataISO,
  turno: { readonly inizio: OraLocale; readonly fine: OraLocale },
  attribuzioneNotte: 'inizio' | 'fine',
): DataISO {
  return attribuzioneNotte === 'fine' && eNotturno(turno.inizio, turno.fine)
    ? spostaGiorni(giorno, 1)
    : giorno;
}

/** Categoria di un turno nei conteggi (L11): ogni turno in una sola, festivo > domenica > sabato. */
export type CategoriaTurno = 'feriale' | 'sabato' | 'domenica' | 'festivo';

export function categoriaDelTurno(
  giorno: DataISO,
  turno: { readonly inizio: OraLocale; readonly fine: OraLocale },
  attribuzioneNotte: 'inizio' | 'fine',
  festivita: readonly Festivita[],
): CategoriaTurno {
  const tipo = classificaGiorno(
    giornoDiAttribuzione(giorno, turno, attribuzioneNotte),
    festivita,
  ).tipo;
  return tipo === 'festivoNazionale' || tipo === 'festivoLocale' ? 'festivo' : tipo;
}
