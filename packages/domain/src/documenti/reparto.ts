import type { IdFestivitaNazionale, Istante } from '../tipi';

/** reparti/{repartoId} (ARCHITETTURA §5.2). */
export interface RepartoDoc {
  nome: string; // 1-60
  coordinatoreUid: string; // unico coordinatore; cambia solo con assegnaReparto
  configurazione: { passo: 'turni' | 'dipendenti' | 'completata' }; // creazione guidata ripresa da qui
  impostazioni: { attribuzioneNotte: 'inizio' | 'fine' }; // D6, predefinito 'inizio'
  festivita: ConfigurazioneFestivita; // D14
  creatoIl: Istante;
  creatoDa: string;
  aggiornatoIl: Istante;
  aggiornatoDa: string;
}

export interface ConfigurazioneFestivita {
  nazionaliEscluse: IdFestivitaNazionale[]; // nazionali rimosse dal coordinatore
  locali: FestivitaLocale[]; // max 20
}

export interface FestivitaLocale {
  id: string; // 'loc-' + 1-30 caratteri [a-z0-9-], stabile negli anni (storico)
  nome: string; // 1-60, es. «San Giovanni Battista»
  giorno: number; // 1-31
  mese: number; // 1-12; ricorre ogni anno
}
