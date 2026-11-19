// Dalla banca ore del reparto alle righe della tabella (UX §7.8, D4). Funzioni pure: i valori sono già calcolati dal
// trigger (`bancaOreAnno()` del dominio), qui si compongono solo segno, provvisorio e testi. Valori in ore.
import { formattaSaldoOre, type Minuti } from '@turni/domain';
import type { BancaOreSalvata } from '../../dati/banca-ore.repo';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import { testi } from '../../testi/it';

import { nomeBreve } from '../comune/nome-breve';

const CHIAVI_MESE_ANNO = [
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
] as const;

/** Il mese (0 = gennaio) di una banca ore, o undefined se il documento non lo ha. */
export function meseDiBanca(
  banca: BancaOreSalvata | null | undefined,
  indice: number,
): BancaOreSalvata['mesi'][(typeof CHIAVI_MESE_ANNO)[number]] {
  const chiave = CHIAVI_MESE_ANNO[indice];
  return banca === null || banca === undefined || chiave === undefined
    ? undefined
    : banca.mesi[chiave];
}

export type Segno = 'credito' | 'debito' | 'zero';

/** Un saldo come lo mostra la tabella: «+3,5», «−7,2», «≈+1,2» (provvisorio). */
export interface SaldoVista {
  readonly testo: string;
  readonly segno: Segno;
  readonly provvisorio: boolean;
}

export function segnoDi(minuti: Minuti): Segno {
  return minuti > 0 ? 'credito' : minuti < 0 ? 'debito' : 'zero';
}

/** Credito e debito si distinguono per segno e colore; il provvisorio ha il prefisso «≈» (mai solo il colore). */
export function saldoVista(minuti: Minuti, provvisorio: boolean): SaldoVista {
  return {
    testo: `${provvisorio ? '≈' : ''}${formattaSaldoOre(minuti)}`,
    segno: segnoDi(minuti),
    provvisorio,
  };
}

export interface RigaBancaOre {
  readonly id: string;
  readonly nome: string;
  readonly nomeCompleto: string;
  /** Dodici mesi: null dove il mese non è stato creato (o escluso dal saldo). */
  readonly mesi: readonly (SaldoVista | null)[];
  readonly riporto: SaldoVista;
  readonly totale: SaldoVista;
}

/** Il nome per l'ordine e la ricerca: «cognome nome» in minuscolo. */
function chiaveNome(d: DipendenteSalvato): string {
  return `${d.cognome} ${d.nome}`.toLowerCase();
}

/**
 * Una riga per dipendente: chi è in servizio (anche senza mesi creati nell'anno) e chi ha una banca ore dell'anno
 * (anche se cessato). Ordine per cognome e nome. Un dipendente rimosso dall'anagrafica ma con una banca ore compare
 * come «Dipendente rimosso», in fondo.
 */
export function righeBancaOre(
  dipendenti: readonly DipendenteSalvato[],
  banche: readonly BancaOreSalvata[],
  ricerca: string,
): readonly RigaBancaOre[] {
  const perId = new Map(banche.map((b) => [b.dipendenteId, b]));
  const filtro = ricerca.trim().toLowerCase();
  const conosciuti = new Set(dipendenti.map((d) => d.id));
  const righe: { chiave: string; riga: RigaBancaOre }[] = [];
  const aggiungi = (id: string, nome: string, completo: string, chiave: string): void => {
    if (filtro !== '' && !completo.toLowerCase().includes(filtro)) {
      return;
    }
    const banca = perId.get(id);
    righe.push({
      chiave,
      riga: {
        id,
        nome,
        nomeCompleto: completo,
        mesi: Array.from({ length: 12 }, (_, i) => {
          const mese = meseDiBanca(banca, i);
          return mese === undefined ? null : saldoVista(mese.saldoMinuti, !mese.definitivo);
        }),
        riporto: saldoVista(banca?.riportoMinuti ?? 0, false),
        totale: saldoVista(banca?.saldoAnnoMinuti ?? 0, banca?.provvisorio ?? false),
      },
    });
  };
  for (const d of dipendenti) {
    if (d.attivo || perId.has(d.id)) {
      aggiungi(d.id, nomeBreve(d.cognome, d.nome), `${d.cognome} ${d.nome}`, chiaveNome(d));
    }
  }
  for (const banca of banche) {
    if (!conosciuti.has(banca.dipendenteId)) {
      aggiungi(banca.dipendenteId, testi.dipendenteRimosso, testi.dipendenteRimosso, '￿');
    }
  }
  return righe
    .sort((a, b) => a.chiave.localeCompare(b.chiave, 'it') || a.riga.id.localeCompare(b.riga.id))
    .map((x) => x.riga);
}
