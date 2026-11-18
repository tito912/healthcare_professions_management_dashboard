import type { CodiceAssenza, Istante } from '../tipi';

/** reparti/{repartoId}/assenze/{codice}: tipologie di assenza; ID = codice (ARCHITETTURA §5.4). */
export interface TipologiaAssenzaDoc {
  codice: CodiceAssenza; // = ID documento
  descrizione: string; // 1-40, es. «Ferie»
  effetto: 'comeRiposo' | 'neutra'; // D4: comeRiposo = zero ore lavorate; neutra = vale le ore dovute del giorno
  malattia: boolean; // true solo per MA
  predefinita: boolean; // true per R (Riposo, comeRiposo) e MA (Malattia, neutra): non eliminabili né disattivabili
  attivo: boolean;
  ordine: number;
  creatoIl: Istante;
  aggiornatoIl: Istante;
}
