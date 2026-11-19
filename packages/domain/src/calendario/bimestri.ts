// Bimestri solari (D7): gen-feb = B1 … nov-dic = B6. L'ID è 'AAAA-Bn'. Il report si invia da solo alle 8:00 del
// giorno 6 del mese successivo alla chiusura. Funzioni pure: l'ora corrente arriva come parametro (`oggi`).
import { chiaveMese, dataISO } from '../codici';
import type { ChiaveMese, DataISO, IdBimestre } from '../tipi';
import { spostaMese } from './mesi';

/** Giorno del mese successivo alla chiusura in cui parte l'invio automatico (D7). */
export const GIORNO_INVIO_REPORT = 6;

export const REGEX_ID_BIMESTRE = /^[0-9]{4}-B[1-6]$/;

const SIGLE_MESI = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];

export type NumeroBimestre = 1 | 2 | 3 | 4 | 5 | 6;

export function eIdBimestre(valore: string): valore is IdBimestre {
  return REGEX_ID_BIMESTRE.test(valore);
}

/** Costruttore del tipo marcato: lancia un errore se il formato non è valido. */
export function idBimestre(valore: string): IdBimestre {
  if (!eIdBimestre(valore)) {
    throw new Error(`Bimestre non valido: ${valore}`);
  }
  return valore;
}

function comeNumero(n: number): NumeroBimestre {
  switch (n) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return n;
    default:
      throw new Error(`Numero di bimestre non valido: ${n}`);
  }
}

/** ID del bimestre di un anno e di un numero da 1 a 6. */
export function idBimestreDa(anno: number, numero: number): IdBimestre {
  return idBimestre(`${String(anno).padStart(4, '0')}-B${comeNumero(numero)}`);
}

export function annoDelBimestre(id: IdBimestre): number {
  return Number(id.slice(0, 4));
}

export function numeroDelBimestre(id: IdBimestre): NumeroBimestre {
  return comeNumero(Number(id.slice(6)));
}

/** Il bimestre che contiene il mese. */
export function bimestreDi(chiave: ChiaveMese): IdBimestre {
  return idBimestreDa(Number(chiave.slice(0, 4)), Math.ceil(Number(chiave.slice(5, 7)) / 2));
}

/** I due mesi del bimestre, in ordine. */
export function mesiDelBimestre(id: IdBimestre): readonly [ChiaveMese, ChiaveMese] {
  const anno = annoDelBimestre(id);
  const primo = (numeroDelBimestre(id) - 1) * 2 + 1;
  return [
    chiaveMese(`${String(anno).padStart(4, '0')}-${String(primo).padStart(2, '0')}`),
    chiaveMese(`${String(anno).padStart(4, '0')}-${String(primo + 1).padStart(2, '0')}`),
  ];
}

/** Il bimestre `n` bimestri dopo (o prima, se negativo). */
export function spostaBimestre(id: IdBimestre, n: number): IdBimestre {
  const [primoMese] = mesiDelBimestre(id);
  return bimestreDi(spostaMese(primoMese, n * 2));
}

/** «nov–dic 2026», per i selettori e gli avvisi. */
export function etichettaBimestre(id: IdBimestre): string {
  const [primo, secondo] = mesiDelBimestre(id);
  const sigla = (chiave: ChiaveMese): string => SIGLE_MESI[Number(chiave.slice(5, 7)) - 1] ?? '';
  return `${sigla(primo)}–${sigla(secondo)} ${annoDelBimestre(id)}`;
}

/** Giorno dell'invio automatico: il 6 del mese dopo la chiusura del bimestre (D7). */
export function dataInvioAutomatico(id: IdBimestre): DataISO {
  const [, ultimoMese] = mesiDelBimestre(id);
  return dataISO(`${spostaMese(ultimoMese, 1)}-${String(GIORNO_INVIO_REPORT).padStart(2, '0')}`);
}

/**
 * L'ultimo bimestre il cui giorno di invio automatico è già arrivato: il 6 gennaio è il bimestre di
 * novembre-dicembre appena chiuso, fino al 5 marzo (escluso il 6) resta quello. Prima del 6 gennaio è quello
 * precedente, già dovuto dal 6 novembre.
 */
export function bimestreDaInviare(oggi: DataISO): IdBimestre {
  let candidato = spostaBimestre(bimestreDi(chiaveMese(oggi.slice(0, 7))), -1);
  while (dataInvioAutomatico(candidato) > oggi) {
    candidato = spostaBimestre(candidato, -1);
  }
  return candidato;
}
