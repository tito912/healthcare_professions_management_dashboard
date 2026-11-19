// Oggetto e testo (semplice e HTML) dell'email con il report individuale, in italiano. I nomi compaiono solo qui e nel
// file allegato (L16, L17): la coda `mail` ha una politica TTL di 30 giorni.
import { etichettaBimestre, type ChiaveMese, type IdBimestre } from '@turni/domain';
import { elencoMesi } from './nomi';

export interface DatiEmail {
  readonly nomeReparto: string;
  readonly nomeDipendente: string;
  readonly idBimestre: IdBimestre;
  readonly mesiInclusi: readonly ChiaveMese[];
  /** Vero se nel bimestre ci sono mesi non inclusi (non ancora convalidati). */
  readonly parziale: boolean;
}

export interface TestoEmail {
  readonly oggetto: string;
  readonly testo: string;
  readonly html: string;
}

function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function componiEmail(dati: DatiEmail): TestoEmail {
  const bimestre = etichettaBimestre(dati.idBimestre);
  const oggetto = `Report turni ${bimestre} · ${dati.nomeReparto}`;
  const righe = [
    `Buongiorno ${dati.nomeDipendente},`,
    `in allegato trovi il riepilogo dei tuoi turni del bimestre ${bimestre} per il reparto ${dati.nomeReparto}: turni svolti (notti, sabati, domeniche e festivi), reperibilità e chiamate.`,
    dati.parziale
      ? `Il riepilogo comprende solo i mesi già convalidati: ${elencoMesi(dati.mesiInclusi)}.`
      : `Mesi compresi: ${elencoMesi(dati.mesiInclusi)}.`,
    'Per qualsiasi dubbio rivolgiti al coordinatore del reparto.',
    'Questo messaggio è stato generato automaticamente dal gestionale dei turni.',
  ];
  return {
    oggetto,
    testo: righe.join('\n\n'),
    html: righe.map((riga) => `<p>${escapeHtml(riga)}</p>`).join('\n'),
  };
}
