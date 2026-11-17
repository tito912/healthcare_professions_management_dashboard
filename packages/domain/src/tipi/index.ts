// Tipi di base del dominio (ARCHITETTURA §4). I tipi «marcati» sono stringhe a runtime: si ottengono
// solo dalle funzioni di validazione del dominio (per i codici: codici.ts), mai con un cast.

type Marca<T, M extends string> = T & { readonly __marca: M };

/** Data di calendario a Europe/Rome, 'AAAA-MM-GG'. Confrontabile come stringa. */
export type DataISO = Marca<string, 'DataISO'>;
/** Ora locale a Europe/Rome, 'HH:mm' da 00:00 a 23:59. Confrontabile come stringa. */
export type OraLocale = Marca<string, 'OraLocale'>;
/** Mese, 'AAAA-MM'. È anche l'ID del documento del mese. */
export type ChiaveMese = Marca<string, 'ChiaveMese'>;
/** Bimestre solare, 'AAAA-B1' (gen-feb) … 'AAAA-B6' (nov-dic). */
export type IdBimestre = Marca<string, 'IdBimestre'>;
/** Codice di turno o di reperibilità (D9): una lettera maiuscola e una cifra, /^[A-Z][0-9]$/. */
export type CodiceTurno = Marca<string, 'CodiceTurno'>;
/** Codice di assenza (D9): una o due lettere maiuscole, /^[A-Z]{1,2}$/. Non può collidere con CodiceTurno. */
export type CodiceAssenza = Marca<string, 'CodiceAssenza'>;
/** Minuti interi (durate, saldi). Mai ore decimali nei calcoli: le ore si formattano solo per lo schermo. */
export type Minuti = number;

/** Istante: forma comune al Timestamp dell'SDK web e dell'Admin SDK. Si converte solo nel dominio. */
export interface Istante {
  readonly seconds: number;
  readonly nanoseconds: number;
  toMillis(): number;
}

/** Giorni del mese a due cifre: chiavi della mappa `giorni` di una riga e di `calendario.festivita`. */
export const CHIAVI_GIORNO = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
  '21',
  '22',
  '23',
  '24',
  '25',
  '26',
  '27',
  '28',
  '29',
  '30',
  '31',
] as const;
/** Giorno del mese a due cifre: chiave della mappa `giorni` di una riga. */
export type ChiaveGiorno = (typeof CHIAVI_GIORNO)[number];

/** Ruoli del custom claim `ruolo` (unico claim nel token). */
export const RUOLI = ['ADMIN', 'COORDINATORE'] as const;
export type Ruolo = (typeof RUOLI)[number];

export const LIVELLI = ['blocco', 'avviso', 'nota'] as const;
export type Livello = (typeof LIVELLI)[number];

/** Colori della palette dei turni (UX §5.1). Ripetuti identici in firestore.rules (`coloriTurno()`). */
export const ID_COLORI_TURNO = [
  'arancio',
  'ambra',
  'sabbia',
  'lime',
  'verde',
  'acqua',
  'azzurro',
  'lavanda',
  'rosa',
  'corallo',
  'blu-notte',
  'ardesia',
] as const;
export type IdColoreTurno = (typeof ID_COLORI_TURNO)[number];

/** Festività nazionali calcolate dal dominio (D14). Ripetute identiche in firestore.rules (`festivitaNazionali()`). */
export const ID_FESTIVITA_NAZIONALI = [
  'capodanno',
  'epifania',
  'pasqua',
  'pasquetta',
  'liberazione',
  'lavoro',
  'repubblica',
  'ferragosto',
  'san-francesco',
  'ognissanti',
  'immacolata',
  'natale',
  'santo-stefano',
] as const;
export type IdFestivitaNazionale = (typeof ID_FESTIVITA_NAZIONALI)[number];
