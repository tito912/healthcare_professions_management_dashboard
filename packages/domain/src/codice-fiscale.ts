// Codice fiscale italiano delle persone fisiche (ARCHITETTURA §5.6): normalizzazione per l'HMAC, formato,
// omocodia e carattere di controllo. Solo funzioni pure. Nessun valore finisce in un messaggio d'errore:
// l'esito dice il motivo, mai il contenuto.

/** Maiuscolo e senza spazi: la forma su cui si calcola l'HMAC dell'indice dei doppioni. */
export function normalizzaCodiceFiscale(testo: string): string {
  return testo.replace(/\s+/gu, '').toUpperCase();
}

/**
 * Perché un codice fiscale non è accettabile:
 * - `vuoto`: nessun codice;
 * - `lunghezza`: non ha 16 caratteri;
 * - `formato`: caratteri o posizioni che non rispettano la struttura (lettere, cifre, lettere del mese,
 *   giorno di nascita 1-31 o 41-71), con le sostituzioni dell'omocodia ammesse;
 * - `controllo`: il carattere di controllo non corrisponde.
 */
export type MotivoCodiceFiscaleNonValido = 'vuoto' | 'lunghezza' | 'formato' | 'controllo';

export type EsitoCodiceFiscale =
  | { readonly valido: true; readonly codice: string }
  | { readonly valido: false; readonly motivo: MotivoCodiceFiscaleNonValido };

export const LUNGHEZZA_CODICE_FISCALE = 16;

/** Lettere che sostituiscono le cifre 0-9 nei casi di omocodia (posizioni 7, 8, 10, 11, 13, 14, 15). */
const LETTERE_OMOCODIA = 'LMNPQRSTUV';
/** Posizioni (da 0) in cui l'omocodia può sostituire una cifra con una lettera. */
const POSIZIONI_NUMERICHE = [6, 7, 9, 10, 12, 13, 14] as const;
const LETTERE_MESE = 'ABCDEHLMPRST';

// Valori dei caratteri nelle posizioni dispari (1, 3, … 15) per il carattere di controllo; nelle posizioni
// pari vale il numero della cifra o la posizione della lettera nell'alfabeto (A = 0).
const VALORI_DISPARI_CIFRE = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21] as const;
const VALORI_DISPARI_LETTERE = [
  1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23,
] as const;

function eCifra(carattere: string): boolean {
  return carattere >= '0' && carattere <= '9';
}

function eLettera(carattere: string): boolean {
  return carattere >= 'A' && carattere <= 'Z';
}

function indiceLettera(carattere: string): number {
  return carattere.charCodeAt(0) - 'A'.charCodeAt(0);
}

/** Valore del carattere in posizione dispari (indice 0, 2, 4, …); undefined se non è una lettera o una cifra. */
function valoreDispari(carattere: string): number | undefined {
  return eCifra(carattere)
    ? VALORI_DISPARI_CIFRE[Number(carattere)]
    : VALORI_DISPARI_LETTERE[indiceLettera(carattere)];
}

function valorePari(carattere: string): number {
  return eCifra(carattere) ? Number(carattere) : indiceLettera(carattere);
}

/** Cifra che un carattere numerico rappresenta, con le lettere dell'omocodia; undefined se non ammesso. */
function cifraDi(carattere: string): number | undefined {
  if (eCifra(carattere)) {
    return Number(carattere);
  }
  const posizione = LETTERE_OMOCODIA.indexOf(carattere);
  return posizione >= 0 ? posizione : undefined;
}

/** Carattere di controllo atteso per i primi 15 caratteri; undefined se contengono caratteri non ammessi. */
function carattereDiControllo(primi15: string): string | undefined {
  let somma = 0;
  for (let i = 0; i < primi15.length; i += 1) {
    const carattere = primi15.charAt(i);
    const valore = i % 2 === 0 ? valoreDispari(carattere) : valorePari(carattere);
    if (valore === undefined) {
      return undefined;
    }
    somma += valore;
  }
  return String.fromCharCode('A'.charCodeAt(0) + (somma % 26));
}

/** Verifica la struttura (lettere, cifre con omocodia, mese, giorno), senza il carattere di controllo. */
function strutturaValida(codice: string): boolean {
  for (let i = 0; i < LUNGHEZZA_CODICE_FISCALE; i += 1) {
    const carattere = codice.charAt(i);
    if (i === 8) {
      if (!LETTERE_MESE.includes(carattere)) {
        return false;
      }
    } else if ((POSIZIONI_NUMERICHE as readonly number[]).includes(i)) {
      if (cifraDi(carattere) === undefined) {
        return false;
      }
    } else if (!eLettera(carattere)) {
      return false;
    }
  }
  // Giorno di nascita: 1-31 per gli uomini, 41-71 per le donne (giorno + 40).
  const giorno = (cifraDi(codice.charAt(9)) ?? 0) * 10 + (cifraDi(codice.charAt(10)) ?? 0);
  return (giorno >= 1 && giorno <= 31) || (giorno >= 41 && giorno <= 71);
}

/**
 * Valida un codice fiscale: normalizza (maiuscolo, senza spazi), controlla lunghezza e struttura
 * (con le sostituzioni dell'omocodia) e il carattere di controllo.
 */
export function validaCodiceFiscale(valore: string): EsitoCodiceFiscale {
  const codice = normalizzaCodiceFiscale(valore);
  if (codice === '') {
    return { valido: false, motivo: 'vuoto' };
  }
  if (codice.length !== LUNGHEZZA_CODICE_FISCALE) {
    return { valido: false, motivo: 'lunghezza' };
  }
  if (!strutturaValida(codice)) {
    return { valido: false, motivo: 'formato' };
  }
  if (carattereDiControllo(codice.slice(0, 15)) !== codice.charAt(15)) {
    return { valido: false, motivo: 'controllo' };
  }
  return { valido: true, codice };
}

export function eCodiceFiscaleValido(valore: string): boolean {
  return validaCodiceFiscale(valore).valido;
}
