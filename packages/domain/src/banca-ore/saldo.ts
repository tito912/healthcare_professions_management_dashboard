// Ore lavorate, saldo del mese e banca ore dell'anno (D4, PIANO 3.1a criteri 2-3).
//   ore lavorate = durate reali dei turni svolti (orario reale se c'è, altrimenti il pianificato) meno la pausa del
//                  turno previsto (L37); assenze, turni scoperti o coperti da un collega, reperibilità e chiamate no;
//                  le sostituzioni contano per chi le fa; la notte dell'ultimo giorno resta nel mese d'inizio (L10);
//   ore dovute   = `oreDovuteMese()` (ore settimanali ÷ 5 per ogni feriale non festivo di servizio; le assenze neutre
//                  tolgono le dovute del giorno, così valgono le ore dovute senza entrare nelle lavorate);
//   saldo        = lavorate − dovute;
//   saldo anno   = riporto dall'anno precedente + somma dei saldi dei mesi presenti; a fine anno diventa il riporto.
import { oreDovuteGiorno, oreDovuteMese, type ContrattoOre } from './ore-dovute';
import type { Festivita } from '../calendario/festivita';
import { numeroDelBimestre } from '../calendario/bimestri';
import { dataDelGiorno, eChiaveGiorno } from '../calendario/mesi';
import type { BancaOreDoc, CellaDoc, MeseBancaOre, RiepilogoMensileDoc } from '../documenti';
import { intervalloTurnoSvolto } from '../regole/giorni-riga';
import type { ChiaveGiorno, ChiaveMese, DataISO, IdBimestre, Minuti } from '../tipi';
import { minutiDi } from '../turni/durata';

/** Minuti lavorati in un turno svolto (zero se la cella non ha un turno svolto): mai negativi. */
export function minutiLavoratiTurno(giorno: DataISO, cella: CellaDoc): Minuti {
  const intervallo = intervalloTurnoSvolto(giorno, cella);
  if (intervallo === null || cella.turno === null) {
    return 0;
  }
  return Math.max(0, minutiDi(intervallo) - cella.turno.pausaMinuti);
}

/** Minuti lavorati nel mese: somma dei turni svolti nelle celle del mese. */
export function minutiLavoratiMese(
  chiave: ChiaveMese,
  giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
): Minuti {
  let totale = 0;
  for (const [giorno, cella] of Object.entries(giorni)) {
    const data = eChiaveGiorno(giorno) ? dataDelGiorno(chiave, giorno) : null;
    if (data !== null && cella !== undefined) {
      totale += minutiLavoratiTurno(data, cella);
    }
  }
  return totale;
}

/** Saldo di un giorno (lavorate − dovute). Una cella assente (null) è una cella vuota: in un feriale vale come un riposo. */
export function saldoGiorno(
  data: DataISO,
  contratto: ContrattoOre,
  festivita: readonly Festivita[],
  cella: CellaDoc | null,
): Minuti {
  const lavorate = cella === null ? 0 : minutiLavoratiTurno(data, cella);
  return lavorate - oreDovuteGiorno(data, contratto, festivita, cella?.assenza ?? null);
}

export interface SaldoMese {
  readonly minutiLavorati: Minuti;
  readonly minutiDovuti: Minuti;
  /** minutiLavorati − minutiDovuti */
  readonly saldoMinuti: Minuti;
}

/** Ore lavorate, dovute e saldo del mese di una riga (D4). */
export function saldoMese(
  chiave: ChiaveMese,
  contratto: ContrattoOre,
  festivita: readonly Festivita[],
  giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
): SaldoMese {
  const minutiLavorati = minutiLavoratiMese(chiave, giorni);
  const minutiDovuti = oreDovuteMese(chiave, contratto, festivita, giorni);
  return { minutiLavorati, minutiDovuti, saldoMinuti: minutiLavorati - minutiDovuti };
}

/** Il riporto di un anno: il saldo dell'anno precedente, provvisorio se lo era. */
export interface Riporto {
  readonly minuti: Minuti;
  readonly provvisorio: boolean;
}

/** Riporto dall'anno precedente; senza banca ore dell'anno precedente è zero e definitivo (L13). */
export function riportoDa(
  annoPrecedente: Pick<BancaOreDoc, 'saldoAnnoMinuti' | 'provvisorio'> | null,
): Riporto {
  return annoPrecedente === null
    ? { minuti: 0, provvisorio: false }
    : { minuti: annoPrecedente.saldoAnnoMinuti, provvisorio: annoPrecedente.provvisorio };
}

type ChiaveMeseAnno = keyof BancaOreDoc['mesi'];

export interface SaldoAnno {
  /** Riporto + somma dei saldi di tutti i mesi presenti (in bozza e convalidati). */
  readonly saldoAnnoMinuti: Minuti;
  /** Riporto + somma dei soli mesi convalidati. */
  readonly saldoDefinitivoMinuti: Minuti;
  /** Almeno un mese in bozza o il riporto provvisorio. */
  readonly provvisorio: boolean;
}

/** Saldo dell'anno dai saldi dei mesi presenti: un mese non creato non pesa (non ha ore dovute). */
export function saldoAnno(
  riporto: Riporto,
  mesi: Readonly<
    Partial<Record<ChiaveMeseAnno, { readonly saldoMinuti: Minuti; readonly definitivo: boolean }>>
  >,
): SaldoAnno {
  let saldoAnnoMinuti = riporto.minuti;
  let saldoDefinitivoMinuti = riporto.minuti;
  let provvisorio = riporto.provvisorio;
  for (const mese of Object.values(mesi)) {
    if (mese === undefined) {
      continue;
    }
    saldoAnnoMinuti += mese.saldoMinuti;
    if (mese.definitivo) {
      saldoDefinitivoMinuti += mese.saldoMinuti;
    } else {
      provvisorio = true;
    }
  }
  return { saldoAnnoMinuti, saldoDefinitivoMinuti, provvisorio };
}

/** I campi del riepilogo mensile che servono alla banca ore. */
export type RiepilogoPerBancaOre = Pick<
  RiepilogoMensileDoc,
  | 'dipendenteId'
  | 'chiaveMese'
  | 'minutiLavorati'
  | 'minutiDovuti'
  | 'saldoMinuti'
  | 'statoMese'
  | 'valida'
>;

export interface DatiBancaOre {
  readonly dipendenteId: string;
  readonly anno: number;
  readonly riporto: Riporto;
  /** Riepiloghi del dipendente (gli altri dipendenti e gli altri anni si scartano). */
  readonly riepiloghi: readonly RiepilogoPerBancaOre[];
}

function chiaveMeseAnno(chiave: ChiaveMese): ChiaveMeseAnno | null {
  const mese = chiave.slice(5);
  const chiavi: readonly ChiaveMeseAnno[] = [
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
  ];
  return chiavi.find((c) => c === mese) ?? null;
}

/**
 * La banca ore di un anno (ARCHITETTURA §5.11) senza `calcolatoIl`, che mette chi la scrive. Un mese è definitivo se
 * il suo riepilogo è di un mese convalidato. Con due riepiloghi dello stesso mese vale l'ultimo dell'elenco (la stessa
 * regola della classifica dei sostituti).
 *
 * Un riepilogo di una riga non valida (`valida: false`: contratto non valido, celle malformate) non entra: con un
 * contratto non valido le ore dovute sono zero e il saldo coinciderebbe con tutte le ore lavorate (review 3.1a,
 * rilievo 3). Il mese escluso rende il documento provvisorio, perché il totale è incompleto; la convalida rifiuta le
 * righe non valide, quindi accade solo in bozza.
 */
export function bancaOreAnno(dati: DatiBancaOre): Omit<BancaOreDoc, 'calcolatoIl'> {
  const ultimoPerMese = new Map<ChiaveMeseAnno, RiepilogoPerBancaOre>();
  for (const riepilogo of dati.riepiloghi) {
    const chiave = chiaveMeseAnno(riepilogo.chiaveMese);
    if (
      riepilogo.dipendenteId === dati.dipendenteId &&
      riepilogo.chiaveMese.slice(0, 4) === String(dati.anno) &&
      chiave !== null
    ) {
      ultimoPerMese.set(chiave, riepilogo);
    }
  }
  const mesi: Partial<Record<ChiaveMeseAnno, MeseBancaOre>> = {};
  let mesiEsclusi = false;
  for (const [chiave, riepilogo] of ultimoPerMese) {
    if (!riepilogo.valida) {
      mesiEsclusi = true;
      continue;
    }
    mesi[chiave] = {
      minutiLavorati: riepilogo.minutiLavorati,
      minutiDovuti: riepilogo.minutiDovuti,
      saldoMinuti: riepilogo.saldoMinuti,
      definitivo: riepilogo.statoMese === 'convalidato',
    };
  }
  const saldi = saldoAnno(dati.riporto, mesi);
  return {
    dipendenteId: dati.dipendenteId,
    anno: dati.anno,
    riportoMinuti: dati.riporto.minuti,
    mesi,
    ...saldi,
    provvisorio: saldi.provvisorio || mesiEsclusi,
  };
}

export interface SaldoProgressivo {
  readonly minuti: Minuti;
  /** Vero se uno dei mesi fino a fine bimestre è in bozza. */
  readonly provvisorio: boolean;
}

/**
 * Saldo da inizio anno alla fine del bimestre (L44): riporto dell'anno precedente più i saldi dei mesi dell'anno fino
 * all'ultimo mese del bimestre compreso. I mesi non creati non pesano e quelli successivi non contano. Senza banca
 * ore (null) non c'è saldo. Il riporto provvisorio dell'anno precedente non si distingue: lo segnala solo un mese in
 * bozza fino a fine bimestre.
 */
export function saldoProgressivoAlBimestre(
  banca: Pick<BancaOreDoc, 'riportoMinuti' | 'mesi'> | null,
  bimestre: IdBimestre,
): SaldoProgressivo | null {
  if (banca === null) {
    return null;
  }
  const ultimoMese = numeroDelBimestre(bimestre) * 2;
  let minuti = banca.riportoMinuti;
  let provvisorio = false;
  for (const [chiave, mese] of Object.entries(banca.mesi)) {
    if (mese === undefined || Number(chiave) > ultimoMese) {
      continue;
    }
    minuti += mese.saldoMinuti;
    if (!mese.definitivo) {
      provvisorio = true;
    }
  }
  return { minuti, provvisorio };
}
