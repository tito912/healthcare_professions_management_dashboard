// Dai dati del dipendente nell'anno alle tre tabelle del dettaglio (UX §7.9): ore per mese, variazioni di orario,
// assenze per tipologia. Funzioni pure; le regole (ore, variazioni) sono quelle del dominio.
import {
  dataDelGiorno,
  eChiaveGiorno,
  eChiaveMese,
  formattaData,
  formattaMese,
  formattaOreDecimali,
  orarioVariato,
  variazioneOrario,
  type ChiaveMese,
} from '@turni/domain';
import type { AssenzaSalvata } from '../../dati/assenze.repo';
import type { BancaOreSalvata } from '../../dati/banca-ore.repo';
import type { RiepilogoDelDipendente } from '../../dati/riepiloghi.repo';
import type { RigaSalvata } from '../../dati/righe.repo';
import { testi } from '../../testi/it';
import { testiDettaglioDipendente } from '../../testi/it-dettaglio-dipendente';
import { meseDiBanca, saldoVista, type SaldoVista } from '../banca-ore/modello';

export interface RigaOreMese {
  readonly chiave: ChiaveMese;
  readonly mese: string;
  readonly dovute: string;
  readonly lavorate: string;
  readonly saldo: SaldoVista | null;
  readonly stato: string;
}

function chiaveDelMese(anno: number, numero: number): ChiaveMese | null {
  const chiave = `${anno}-${String(numero).padStart(2, '0')}`;
  return eChiaveMese(chiave) ? chiave : null;
}

/** I dodici mesi dell'anno con dovute, lavorate, saldo e stato (convalidato, bozza, escluso, non creato). */
export function oreDeiMesi(
  anno: number,
  banca: BancaOreSalvata | null,
  riepiloghi: readonly RiepilogoDelDipendente[],
): readonly RigaOreMese[] {
  const t = testiDettaglioDipendente;
  const righe: RigaOreMese[] = [];
  for (let numero = 1; numero <= 12; numero++) {
    const chiave = chiaveDelMese(anno, numero);
    if (chiave === null) {
      continue;
    }
    const mese = formattaMese(chiave).split(' ')[0] ?? chiave;
    const doc = meseDiBanca(banca, numero - 1);
    if (doc !== undefined) {
      righe.push({
        chiave,
        mese,
        dovute: formattaOreDecimali(doc.minutiDovuti),
        lavorate: formattaOreDecimali(doc.minutiLavorati),
        saldo: saldoVista(doc.saldoMinuti, !doc.definitivo),
        stato: doc.definitivo ? t.statoConvalidato : t.statoBozza,
      });
      continue;
    }
    const esiste = riepiloghi.some((r) => r.chiaveMese === chiave);
    righe.push({
      chiave,
      mese,
      dovute: '—',
      lavorate: '—',
      saldo: null,
      stato: esiste ? t.statoEscluso : t.statoNonCreato,
    });
  }
  return righe;
}

export interface RigaVariazione {
  readonly chiave: string;
  readonly data: string;
  readonly turno: string;
  readonly previsto: string;
  readonly reale: string;
  readonly differenza: string;
}

/** Le variazioni di orario di una riga: turni svolti con l'orario reale diverso dal previsto (stessa regola del dominio). */
export function variazioniDellaRiga(
  chiaveMese: ChiaveMese,
  riga: RigaSalvata,
): readonly RigaVariazione[] {
  const elenco: RigaVariazione[] = [];
  for (const [giorno, cella] of Object.entries(riga.giorni)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiaveMese, giorno) : null;
    if (
      data === null ||
      cella === undefined ||
      cella.turno === null ||
      cella.assenza !== null ||
      cella.orarioReale === null ||
      !orarioVariato(cella.turno, cella.orarioReale)
    ) {
      continue;
    }
    const minuti = variazioneOrario(data, cella.turno, cella.orarioReale);
    elenco.push({
      chiave: `${chiaveMese}-${giorno}`,
      data: formattaData(data),
      turno: cella.turno.codice,
      previsto: `${cella.turno.inizio}–${cella.turno.fine}`,
      reale: `${cella.orarioReale.inizio}–${cella.orarioReale.fine}`,
      differenza:
        minuti === 0 ? testi.variazioneOraria.stessaDurata : testi.variazioneOraria.minuti(minuti),
    });
  }
  return elenco.sort((a, b) => a.chiave.localeCompare(b.chiave));
}

export interface RigaAssenza {
  readonly codice: string;
  readonly descrizione: string;
  /** Giorni per mese (dodici valori). */
  readonly mesi: readonly number[];
  readonly totale: number;
}

/** Giorni di assenza per tipologia e mese; solo le tipologie usate nell'anno, nell'ordine della configurazione. */
export function assenzePerTipologia(
  riepiloghi: readonly RiepilogoDelDipendente[],
  assenze: readonly AssenzaSalvata[],
): readonly RigaAssenza[] {
  const perCodice = new Map<string, number[]>();
  for (const r of riepiloghi) {
    const indice = Number(r.chiaveMese.slice(5, 7)) - 1;
    for (const [codice, giorni] of Object.entries(r.assenzePerCodice)) {
      const mesi = perCodice.get(codice) ?? Array.from({ length: 12 }, () => 0);
      mesi[indice] = (mesi[indice] ?? 0) + giorni;
      perCodice.set(codice, mesi);
    }
  }
  const ordine = new Map(assenze.map((a, i) => [a.codice as string, i]));
  return [...perCodice.entries()]
    .map(([codice, mesi]) => ({
      codice,
      descrizione: assenze.find((a) => a.codice === codice)?.descrizione ?? codice,
      mesi,
      totale: mesi.reduce((somma, n) => somma + n, 0),
    }))
    .filter((r) => r.totale > 0)
    .sort(
      (a, b) =>
        (ordine.get(a.codice) ?? 999) - (ordine.get(b.codice) ?? 999) ||
        a.codice.localeCompare(b.codice),
    );
}
