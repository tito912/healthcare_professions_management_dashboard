import type { Istante, Ruolo } from '../tipi';

/** utenti/{uid} (ARCHITETTURA §5.1). Scritto solo dalle Functions e da scripts/crea-primo-admin.ts. */
export interface UtenteDoc {
  nome: string; // 1-60
  cognome: string; // 1-60
  email: string; // la stessa di Firebase Auth
  ruolo: Ruolo; // copia del custom claim, per l'elenco Utenti
  attivo: boolean; // false: Auth disabilitato e token revocati; le regole lo controllano a ogni richiesta
  creatoIl: Istante;
  creatoDa: string | null; // uid dell'ADMIN; null per il primo ADMIN creato dallo script
  aggiornatoIl: Istante;
}
