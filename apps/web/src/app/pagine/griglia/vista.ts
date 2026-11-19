// Viste della griglia (U9, UX §8.1, §9.9): mese intero, 2 settimane, 1 settimana, con le misure per ogni vista.
import {
  chiaveGiornoDi,
  giorniDelMese,
  giornoDellaSettimana,
  type ChiaveGiorno,
  type ChiaveMese,
  type DataISO,
} from '@turni/domain';

export type Vista = 'mese' | 'settimane2' | 'settimana';
export const VISTE: readonly Vista[] = ['mese', 'settimane2', 'settimana'];
export const VISTA_PREDEFINITA: Vista = 'mese';

/** Larghezze fisse delle colonne laterali (UX §8.1). */
export const LARGHEZZA_NOMI = 152;
export const LARGHEZZA_TOTALE = 44;
export const NUMERO_TOTALI = 4;
export const LARGHEZZA_TOTALI = LARGHEZZA_TOTALE * NUMERO_TOTALI;

export interface Settimana {
  readonly da: DataISO;
  readonly a: DataISO;
  readonly giorni: readonly ChiaveGiorno[];
}

/** Le settimane (lunedì-domenica) che toccano il mese, limitate ai giorni del mese: la prima e l'ultima possono essere più corte. */
export function settimaneDelMese(chiave: ChiaveMese): readonly Settimana[] {
  const settimane: { da: DataISO; a: DataISO; giorni: ChiaveGiorno[] }[] = [];
  for (const data of giorniDelMese(chiave)) {
    const ultima = settimane.at(-1);
    if (ultima === undefined || giornoDellaSettimana(data) === 1) {
      settimane.push({ da: data, a: data, giorni: [chiaveGiornoDi(data)] });
    } else {
      ultima.a = data;
      ultima.giorni.push(chiaveGiornoDi(data));
    }
  }
  return settimane;
}

/** Quante settimane mostra la vista: 1 (settimana), 2 (due settimane), 0 per il mese intero. */
export function settimaneMostrate(vista: Vista): number {
  return vista === 'settimana' ? 1 : vista === 'settimane2' ? 2 : 0;
}

/** Di quante settimane si sposta «◀ ▶»: tante quante ne mostra la vista. */
export function passoSettimane(vista: Vista): number {
  return Math.max(1, settimaneMostrate(vista));
}

/** Tiene l'indice della prima settimana mostrata dentro il mese (ferma ai bordi, UX §9.9). */
export function limitaSettimana(chiave: ChiaveMese, vista: Vista, indice: number): number {
  const ultimo = Math.max(0, settimaneDelMese(chiave).length - 1);
  const massimo = vista === 'settimane2' ? Math.max(0, ultimo - 1) : ultimo;
  return Math.min(Math.max(0, indice), massimo);
}

/** Indice della settimana che contiene il giorno. */
export function settimanaDelGiorno(chiave: ChiaveMese, giorno: ChiaveGiorno): number {
  const indice = settimaneDelMese(chiave).findIndex((s) => s.giorni.includes(giorno));
  return Math.max(0, indice);
}

/** I giorni visibili: tutti nel mese intero, altrimenti una o due settimane a partire da `settimana`. */
export function giorniVisibili(
  chiave: ChiaveMese,
  vista: Vista,
  settimana: number,
): readonly ChiaveGiorno[] {
  const settimane = settimaneDelMese(chiave);
  if (vista === 'mese') {
    return settimane.flatMap((s) => s.giorni);
  }
  const prima = limitaSettimana(chiave, vista, settimana);
  return settimane.slice(prima, prima + settimaneMostrate(vista)).flatMap((s) => s.giorni);
}

/** Come si disegna la striscia delle reperibilità (UX §8.2). */
export type ResaStriscia = 'ore' | 'righe' | 'righeComplete';

export interface ConfigurazioneVista {
  readonly larghezzaGiorno: number;
  readonly altezzaRiga: number;
  readonly altezzaChip: number;
  /** Lato dei triangoli degli angoli (5 px nella vista mese stretta, altrimenti 6). */
  readonly angolo: 5 | 6;
  readonly striscia: ResaStriscia;
  /** Corpo del testo della striscia in px: 10 a 1366, 11 a 1920 nella vista mese, 12 nelle altre. */
  readonly fontStriscia: 10 | 11 | 12;
  /** Vista mese larga (≥ 40 px): i minuti non nulli dell'ora di inizio si mostrano («14:30»). */
  readonly mostraMinutiStriscia: boolean;
  /** Vista 1 settimana: l'orario sta sotto il codice nel chip. */
  readonly orarioSottoCodice: boolean;
  /** Il giorno è più stretto del minimo: la griglia scorre in orizzontale. */
  readonly scorrimentoOrizzontale: boolean;
  /** Intestazione compatta (numero e iniziale) nella vista mese, «lun 9» nelle viste a settimane. */
  readonly intestazioneCompatta: boolean;
}

const MISURE = {
  mese: { minimo: 28, riga: 40, chip: 24 },
  settimane2: { minimo: 60, riga: 56, chip: 26 },
  settimana: { minimo: 112, riga: 64, chip: 34 },
} as const;

/** Soglia di larghezza oltre la quale la vista mese mostra i minuti e usa il corpo da 11 px (1920 px: 48). */
const GIORNO_LARGO = 40;

/**
 * Misure della vista. `larghezzaDisponibile` è lo spazio per i giorni (finestra − 408 px a menu ridotto, UX
 * §8.1): il giorno è la sua parte intera diviso i giorni visibili, con un minimo sotto il quale si scorre.
 */
export function configurazioneVista(
  vista: Vista,
  larghezzaDisponibile: number,
  giorniMostrati: number,
): ConfigurazioneVista {
  const misure = MISURE[vista];
  const calcolata = Math.floor(larghezzaDisponibile / Math.max(1, giorniMostrati));
  const larghezzaGiorno = Math.max(misure.minimo, calcolata);
  const largo = vista === 'mese' && larghezzaGiorno >= GIORNO_LARGO;
  return {
    larghezzaGiorno,
    altezzaRiga: misure.riga,
    altezzaChip: misure.chip,
    angolo: vista === 'mese' && larghezzaGiorno < GIORNO_LARGO ? 5 : 6,
    striscia: vista === 'mese' ? 'ore' : vista === 'settimane2' ? 'righe' : 'righeComplete',
    fontStriscia: vista === 'mese' ? (largo ? 11 : 10) : 12,
    mostraMinutiStriscia: largo,
    orarioSottoCodice: vista === 'settimana',
    scorrimentoOrizzontale: calcolata < misure.minimo,
    intestazioneCompatta: vista === 'mese',
  };
}
