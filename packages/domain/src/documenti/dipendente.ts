import type { CodiceTurno, DataISO, Istante } from '../tipi';

/** reparti/{repartoId}/dipendenti/{dipendenteId} (ARCHITETTURA §5.5). Scritto solo da salvaDipendente. */
export interface DipendenteDoc {
  nome: string; // 1-60
  cognome: string; // 1-60
  oreSettimanali: number; // 1-48, multipli di 0,5; default 36 (L39)
  turniEsclusi: CodiceTurno[]; // turni e reperibilità esclusi
  dataAssunzione: DataISO | null; // null = in servizio da prima dell'avvio
  dataCessazione: DataISO | null; // ultimo giorno di servizio; avvia il conteggio dei 5 anni
  attivo: boolean; // false ⇒ dataCessazione != null ("Disattiva" chiede la data)
  creatoIl: Istante;
  aggiornatoIl: Istante;
  aggiornatoDa: string;
}

/**
 * reparti/{repartoId}/dipendenti/{dipendenteId}/privato/dati (ARCHITETTURA §5.6).
 * Mai leggibile né scrivibile dal browser: solo salvaDipendente e leggiDatiPrivati.
 */
export interface DatiPrivatiDoc {
  codiceFiscaleCifrato: string; // base64 del ciphertext KMS; AAD = `${dipendenteId}:codiceFiscale`
  dataNascitaCifrata: string; // base64 del ciphertext KMS di una DataISO; AAD = `${dipendenteId}:dataNascita`
  hmacCodiceFiscale: string; // hex, HMAC-SHA256(chiave segreta, codice fiscale maiuscolo senza spazi)
  email: string | null; // in chiaro, mai leggibile dal browser
  chiaveKms: string; // versione della chiave usata; 'emulatore-non-sicura' sull'emulatore
  aggiornatoIl: Istante;
}

/** indiceCodiciFiscali/{hmac}: unicità del codice fiscale (ARCHITETTURA §5.7). */
export interface IndiceCodiceFiscaleDoc {
  repartoId: string;
  dipendenteId: string;
  creatoIl: Istante;
}
