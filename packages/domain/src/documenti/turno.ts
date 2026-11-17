import type { CodiceTurno, IdColoreTurno, Istante, OraLocale } from '../tipi';

/** reparti/{repartoId}/turni/{codice}: turni e fasce di reperibilità; ID = codice (ARCHITETTURA §5.3). */
export interface TurnoDoc {
  codice: CodiceTurno; // = ID documento
  tipo: 'turno' | 'reperibilita';
  nome: string; // 1-40, es. «Mattina», «Reperibilità pomeriggio»
  colore: IdColoreTurno | null; // obbligatorio per 'turno', null per 'reperibilita'
  inizio: OraLocale;
  fine: OraLocale; // fine <= inizio: termina il giorno dopo; fine == inizio: 24 ore
  pausaMinuti: number; // intero 0-240; D5: 30 di default per i diurni, 0 per i notturni; sempre 0 per 'reperibilita'
  notturno: boolean; // (fine < inizio && fine != '00:00') || fine == inizio (L8); verificato dalle regole
  attivo: boolean; // disattivato: sparisce da menu e pennello, resta leggibile
  ordine: number; // ordine in menu, pennello e legenda
  creatoIl: Istante;
  aggiornatoIl: Istante;
}
