// Conteggi del report bimestrale (ARCHITETTURA §5.12): per dipendente, la somma dei riepiloghi mensili del
// bimestre. I riepiloghi hanno già le regole: turni svolti senza assenze né turni scoperti, sostituzioni a chi le fa,
// notti, sabati e domeniche con l'attribuzione del reparto (D6), festivi come domeniche (L11), reperibilità svolte,
// chiamate e durata. Questa funzione è pura: chi la chiama decide quali mesi entrano (il server solo i convalidati,
// la vista provvisoria del browser anche quelli in bozza).
import type { ConteggiReport, RiepilogoMensileDoc } from '../documenti';
import type { ChiaveMese, IdBimestre } from '../tipi';
import { mesiDelBimestre } from '../calendario/bimestri';

/** I campi di un riepilogo che servono al report. */
export type RiepilogoPerReport = Pick<
  RiepilogoMensileDoc,
  | 'dipendenteId'
  | 'chiaveMese'
  | 'turniSvolti'
  | 'notti'
  | 'sabati'
  | 'domenicheEFestivi'
  | 'reperibilitaSvolte'
  | 'chiamate'
  | 'minutiChiamate'
>;

export const CONTEGGI_VUOTI: ConteggiReport = {
  turniSvolti: 0,
  notti: 0,
  sabati: 0,
  domenicheEFestivi: 0,
  reperibilitaSvolte: 0,
  chiamate: 0,
  minutiChiamate: 0,
};

export function sommaConteggi(a: ConteggiReport, b: ConteggiReport): ConteggiReport {
  return {
    turniSvolti: a.turniSvolti + b.turniSvolti,
    notti: a.notti + b.notti,
    sabati: a.sabati + b.sabati,
    domenicheEFestivi: a.domenicheEFestivi + b.domenicheEFestivi,
    reperibilitaSvolte: a.reperibilitaSvolte + b.reperibilitaSvolte,
    chiamate: a.chiamate + b.chiamate,
    minutiChiamate: a.minutiChiamate + b.minutiChiamate,
  };
}

function conteggiDi(riepilogo: RiepilogoPerReport): ConteggiReport {
  return {
    turniSvolti: riepilogo.turniSvolti,
    notti: riepilogo.notti,
    sabati: riepilogo.sabati,
    domenicheEFestivi: riepilogo.domenicheEFestivi,
    reperibilitaSvolte: riepilogo.reperibilitaSvolte,
    chiamate: riepilogo.chiamate,
    minutiChiamate: riepilogo.minutiChiamate,
  };
}

export interface ConteggiBimestre {
  /** I mesi del bimestre che sono entrati nel conteggio, in ordine. */
  readonly mesiInclusi: readonly ChiaveMese[];
  /** Un elemento per ogni dipendente con un riepilogo in almeno un mese incluso (anche con tutti zeri). */
  readonly righe: Readonly<Record<string, ConteggiReport>>;
  /** Gli stessi conteggi mese per mese, per il file individuale. */
  readonly perMese: Readonly<Record<string, Readonly<Record<string, ConteggiReport>>>>;
  readonly totali: ConteggiReport;
}

/**
 * Somma i riepiloghi dei mesi indicati in `mesiInclusi` (quelli che non sono del bimestre si ignorano). I riepiloghi
 * di altri mesi si ignorano; con due riepiloghi dello stesso dipendente e mese vale l'ultimo, come in `bancaOreAnno()`.
 */
export function conteggiBimestre(
  id: IdBimestre,
  riepiloghi: readonly RiepilogoPerReport[],
  mesiInclusi: readonly ChiaveMese[],
): ConteggiBimestre {
  const mesiDelPeriodo = mesiDelBimestre(id);
  const inclusi = mesiDelPeriodo.filter((mese) => mesiInclusi.includes(mese));
  const ultimoPerChiave = new Map<string, RiepilogoPerReport>();
  for (const riepilogo of riepiloghi) {
    if (inclusi.includes(riepilogo.chiaveMese)) {
      ultimoPerChiave.set(`${riepilogo.chiaveMese}_${riepilogo.dipendenteId}`, riepilogo);
    }
  }
  const righe: Record<string, ConteggiReport> = {};
  const perMese: Record<string, Record<string, ConteggiReport>> = Object.fromEntries(
    inclusi.map((mese) => [mese, {}]),
  );
  let totali = CONTEGGI_VUOTI;
  for (const riepilogo of ultimoPerChiave.values()) {
    const conteggi = conteggiDi(riepilogo);
    righe[riepilogo.dipendenteId] = sommaConteggi(
      righe[riepilogo.dipendenteId] ?? CONTEGGI_VUOTI,
      conteggi,
    );
    const delMese = perMese[riepilogo.chiaveMese];
    if (delMese !== undefined) {
      delMese[riepilogo.dipendenteId] = conteggi;
    }
    totali = sommaConteggi(totali, conteggi);
  }
  return { mesiInclusi: inclusi, righe, perMese, totali };
}
