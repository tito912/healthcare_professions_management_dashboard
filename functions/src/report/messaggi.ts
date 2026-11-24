// Oggetto e testo (semplice e HTML) dell'email con il report individuale, in italiano. I nomi compaiono solo qui e nel
// file allegato (L16, L17): la coda `mail` ha una politica TTL di 30 giorni.
import {
  etichettaBimestre,
  formattaOreDecimali,
  formattaSaldoOre,
  type ChiaveMese,
  type ConteggiReport,
  type IdBimestre,
  type SaldoProgressivo,
} from '@turni/domain';
import { elencoMesi } from './nomi';

export interface DatiEmail {
  readonly nomeReparto: string;
  readonly nomeDipendente: string;
  readonly idBimestre: IdBimestre;
  readonly mesiInclusi: readonly ChiaveMese[];
  /** Ore del bimestre e saldo da inizio anno del solo destinatario (L44). */
  readonly ore: Pick<ConteggiReport, 'minutiDovuti' | 'minutiLavorati' | 'saldoMinuti'>;
  readonly saldoProgressivo: SaldoProgressivo | null;
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

function rigaOre(dati: DatiEmail): string {
  const { ore, saldoProgressivo } = dati;
  const bimestre =
    `Ore del bimestre: dovute ${formattaOreDecimali(ore.minutiDovuti)}, ` +
    `lavorate ${formattaOreDecimali(ore.minutiLavorati)}, saldo ${formattaSaldoOre(ore.saldoMinuti)}.`;
  if (saldoProgressivo === null) {
    return bimestre;
  }
  const provvisorio = saldoProgressivo.provvisorio
    ? ' (provvisorio: comprende mesi non ancora convalidati)'
    : '';
  return `${bimestre} Saldo da inizio anno alla fine del bimestre: ${formattaSaldoOre(saldoProgressivo.minuti)} ore${provvisorio}.`;
}

export function componiEmail(dati: DatiEmail): TestoEmail {
  const bimestre = etichettaBimestre(dati.idBimestre);
  const oggetto = `Report turni ${bimestre} · ${dati.nomeReparto}`;
  const righe = [
    `Buongiorno ${dati.nomeDipendente},`,
    `in allegato trovi il riepilogo dei tuoi turni del bimestre ${bimestre} per il reparto ${dati.nomeReparto}: turni svolti (notti, sabati, domeniche e festivi), reperibilità, chiamate e ore.`,
    dati.parziale
      ? `Il riepilogo comprende solo i mesi già convalidati: ${elencoMesi(dati.mesiInclusi)}.`
      : `Mesi compresi: ${elencoMesi(dati.mesiInclusi)}.`,
    rigaOre(dati),
    'Per qualsiasi dubbio rivolgiti al coordinatore del reparto.',
    'Questo messaggio è stato generato automaticamente dal gestionale dei turni.',
  ];
  return {
    oggetto,
    testo: righe.join('\n\n'),
    html: righe.map((riga) => `<p>${escapeHtml(riga)}</p>`).join('\n'),
  };
}
