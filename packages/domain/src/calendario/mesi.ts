// Aiuti sui mesi e sui giorni del calendario (Europe/Rome). Le date sono `DataISO` ('AAAA-MM-GG'): si
// confrontano come stringhe e si spostano solo con Luxon, mai con l'aritmetica dei millisecondi.
import { DateTime } from 'luxon';
import { chiaveMese, dataISO } from '../codici';
import { CHIAVI_GIORNO, type ChiaveGiorno, type ChiaveMese, type DataISO } from '../tipi';
import { FUSO } from '../impostazioni';

/** Giorni del mese (anno e mese 1-12); 0 se i valori non sono validi. */
export function giorniNelMese(anno: number, mese: number): number {
  const data = DateTime.fromObject({ year: anno, month: mese }, { zone: FUSO });
  return data.isValid ? (data.daysInMonth ?? 0) : 0;
}

/** Giorni che un mese può avere in un anno qualsiasi: febbraio conta 29 (per le ricorrenze annuali). */
export function giorniMassimiNelMese(mese: number): number {
  return giorniNelMese(2024, mese);
}

/** Chiave 'AAAA-MM' di un anno e un mese (1-12). */
export function chiaveMeseDa(anno: number, mese: number): ChiaveMese {
  return chiaveMese(`${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}`);
}

function inizioMese(chiave: ChiaveMese): DateTime {
  return DateTime.fromFormat(chiave, 'yyyy-LL', { zone: FUSO });
}

function daLuxon(data: DateTime): DataISO {
  return dataISO(data.toFormat('yyyy-LL-dd'));
}

function aLuxon(data: DataISO): DateTime {
  return DateTime.fromISO(data, { zone: FUSO });
}

/** Vero per le chiavi della mappa `giorni`: '01'…'31'. */
export function eChiaveGiorno(valore: string): valore is ChiaveGiorno {
  return CHIAVI_GIORNO.some((chiave) => chiave === valore);
}

/** Tutti i giorni del mese, dal primo all'ultimo (29 febbraio compreso negli anni bisestili). */
export function giorniDelMese(chiave: ChiaveMese): readonly DataISO[] {
  const primo = inizioMese(chiave);
  const quanti = primo.daysInMonth ?? 0;
  return CHIAVI_GIORNO.slice(0, quanti).map((giorno) => dataISO(`${chiave}-${giorno}`));
}

/** La data del giorno `giorno` del mese, o null se il mese non ha quel giorno (31 novembre, 29 febbraio 2026). */
export function dataDelGiorno(chiave: ChiaveMese, giorno: ChiaveGiorno): DataISO | null {
  const quanti = inizioMese(chiave).daysInMonth ?? 0;
  return Number(giorno) <= quanti ? dataISO(`${chiave}-${giorno}`) : null;
}

/** Chiave a due cifre del giorno di una data. */
export function chiaveGiornoDi(data: DataISO): ChiaveGiorno {
  const giorno = data.slice(8, 10);
  const trovata = CHIAVI_GIORNO.find((chiave) => chiave === giorno);
  if (trovata === undefined) {
    throw new Error(`Data non valida: ${data}`);
  }
  return trovata;
}

/** Mese 'AAAA-MM' di una data. */
export function chiaveMeseDi(data: DataISO): ChiaveMese {
  return chiaveMese(data.slice(0, 7));
}

/** Il mese `mesi` mesi dopo (o prima, se negativo). */
export function spostaMese(chiave: ChiaveMese, mesi: number): ChiaveMese {
  return chiaveMese(inizioMese(chiave).plus({ months: mesi }).toFormat('yyyy-LL'));
}

/** La data `giorni` giorni di calendario dopo (o prima): il giorno del cambio d'ora conta come gli altri. */
export function spostaGiorni(data: DataISO, giorni: number): DataISO {
  return daLuxon(aLuxon(data).plus({ days: giorni }));
}

/** Giorno della settimana ISO: 1 = lunedì … 7 = domenica. */
export function giornoDellaSettimana(data: DataISO): number {
  return aLuxon(data).weekday;
}
