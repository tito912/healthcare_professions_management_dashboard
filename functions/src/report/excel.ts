// File Excel del report (exceljs): quello del reparto (una riga per dipendente, intestazioni, totali, legenda dei
// codici con i colori della palette) e quello individuale (una riga per mese e il totale del bimestre). Le durate
// delle chiamate sono testo come a schermo («1 h 30»); i conteggi sono numeri.
import {
  coloreTurno,
  formattaDurata,
  formattaMese,
  formattaOreDecimali,
  formattaSaldoOre,
  type ChiaveMese,
  type ConteggiReport,
  type IdBimestre,
  type SaldoProgressivo,
} from '@turni/domain';
import { Workbook, type Worksheet } from 'exceljs';
import type { VoceLegenda } from './calcolo';
import { elencoMesi, titoloReport } from './nomi';

export const INTESTAZIONI_CONTEGGI = [
  'Turni svolti',
  'di cui notti',
  'di cui sabati',
  'di cui domeniche e festivi',
  'Reperibilità svolte',
  'Chiamate',
  'Durata chiamate',
  'Ore dovute',
  'Ore lavorate',
  'Saldo bimestre',
  'Saldo da inizio anno',
] as const;

const BORDO = { style: 'thin' as const, color: { argb: 'FF9CA3AF' } };
const CORNICE = { top: BORDO, left: BORDO, bottom: BORDO, right: BORDO };

/** Durata complessiva delle chiamate: «1 h 30», o un trattino se non ce ne sono. */
export function testoDurataChiamate(minuti: number): string {
  return minuti === 0 ? '—' : formattaDurata(minuti);
}

/** Saldo da inizio anno (L44): «+3,5», con «≈» se provvisorio, un trattino senza banca ore. */
export function testoSaldoProgressivo(saldo: SaldoProgressivo | null | undefined): string {
  return saldo === null || saldo === undefined
    ? '—'
    : `${saldo.provvisorio ? '≈' : ''}${formattaSaldoOre(saldo.minuti)}`;
}

function valoriConteggi(
  conteggi: ConteggiReport,
  saldoProgressivo: SaldoProgressivo | null | undefined,
): (number | string)[] {
  return [
    conteggi.turniSvolti,
    conteggi.notti,
    conteggi.sabati,
    conteggi.domenicheEFestivi,
    conteggi.reperibilitaSvolte,
    conteggi.chiamate,
    testoDurataChiamate(conteggi.minutiChiamate),
    formattaOreDecimali(conteggi.minutiDovuti),
    formattaOreDecimali(conteggi.minutiLavorati),
    formattaSaldoOre(conteggi.saldoMinuti),
    testoSaldoProgressivo(saldoProgressivo),
  ];
}

function argb(colore: string): string {
  return `FF${colore.replace('#', '').toUpperCase()}`;
}

function intestazione(foglio: Worksheet, riga: number, prima: string): void {
  const celle = foglio.getRow(riga);
  celle.values = [prima, ...INTESTAZIONI_CONTEGGI];
  celle.eachCell((cella) => {
    cella.font = { bold: true };
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    cella.border = CORNICE;
    cella.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  celle.height = 32;
}

function rigaDati(
  foglio: Worksheet,
  riga: number,
  etichetta: string,
  conteggi: ConteggiReport,
  saldoProgressivo: SaldoProgressivo | null | undefined,
  evidenzia = false,
): void {
  const celle = foglio.getRow(riga);
  celle.values = [etichetta, ...valoriConteggi(conteggi, saldoProgressivo)];
  celle.eachCell((cella, colonna) => {
    cella.border = CORNICE;
    cella.alignment = { horizontal: colonna === 1 ? 'left' : 'center' };
    if (evidenzia) {
      cella.font = { bold: true };
      cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    }
  });
}

/** Legenda dei codici sotto la tabella: il codice di ogni turno ha lo sfondo del suo colore. Restituisce l'ultima riga. */
function scriviLegenda(foglio: Worksheet, daRiga: number, legenda: readonly VoceLegenda[]): number {
  foglio.getCell(daRiga, 1).value = 'Legenda dei codici';
  foglio.getCell(daRiga, 1).font = { bold: true };
  const titoli = foglio.getRow(daRiga + 1);
  titoli.values = ['Codice', 'Nome', 'Dalle', 'Alle', 'Tipo'];
  titoli.eachCell((cella) => {
    cella.font = { bold: true };
    cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    cella.border = CORNICE;
  });
  let riga = daRiga + 2;
  for (const voce of legenda) {
    const celle = foglio.getRow(riga);
    celle.values = [
      voce.codice,
      voce.nome,
      voce.inizio,
      voce.fine,
      voce.tipo === 'turno' ? 'Turno' : 'Reperibilità',
    ];
    celle.eachCell((cella) => {
      cella.border = CORNICE;
    });
    const colore = voce.colore === null ? undefined : coloreTurno(voce.colore);
    if (colore !== undefined) {
      const codice = foglio.getCell(riga, 1);
      codice.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(colore.sfondo) } };
      codice.font = { bold: true, color: { argb: argb(colore.testo) } };
      codice.border = {
        top: { style: 'thin', color: { argb: argb(colore.bordo) } },
        left: { style: 'thin', color: { argb: argb(colore.bordo) } },
        bottom: { style: 'thin', color: { argb: argb(colore.bordo) } },
        right: { style: 'thin', color: { argb: argb(colore.bordo) } },
      };
    }
    riga += 1;
  }
  return riga - 1;
}

function impostaColonne(foglio: Worksheet): void {
  foglio.columns = [{ width: 30 }, ...INTESTAZIONI_CONTEGGI.map(() => ({ width: 16 }))];
}

export interface DatiExcelReparto {
  readonly nomeReparto: string;
  readonly idBimestre: IdBimestre;
  readonly mesiInclusi: readonly ChiaveMese[];
  readonly righe: readonly {
    readonly nome: string;
    readonly conteggi: ConteggiReport;
    readonly saldoProgressivo: SaldoProgressivo | null;
  }[];
  readonly totali: ConteggiReport;
  readonly legenda: readonly VoceLegenda[];
}

/** Il file del reparto: titolo, mesi inclusi, una riga per dipendente, riga dei totali e legenda. */
export async function generaExcelReparto(dati: DatiExcelReparto): Promise<Buffer> {
  const cartella = new Workbook();
  const foglio = cartella.addWorksheet('Report');
  impostaColonne(foglio);
  foglio.getCell('A1').value = titoloReport(dati.nomeReparto, dati.idBimestre);
  foglio.getCell('A1').font = { bold: true, size: 14 };
  foglio.getCell('A2').value = `Mesi inclusi (solo i convalidati): ${elencoMesi(dati.mesiInclusi)}`;
  intestazione(foglio, 4, 'Dipendente');
  let riga = 5;
  for (const r of dati.righe) {
    rigaDati(foglio, riga, r.nome, r.conteggi, r.saldoProgressivo);
    riga += 1;
  }
  rigaDati(foglio, riga, 'Totale', dati.totali, undefined, true);
  scriviLegenda(foglio, riga + 2, dati.legenda);
  foglio.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await cartella.xlsx.writeBuffer());
}

export interface DatiExcelIndividuale {
  readonly nomeReparto: string;
  readonly nomeDipendente: string;
  readonly idBimestre: IdBimestre;
  readonly mesi: readonly { readonly chiave: ChiaveMese; readonly conteggi: ConteggiReport }[];
  readonly totale: ConteggiReport;
  /** Saldo da inizio anno a fine bimestre: compare nella riga del totale (L44). */
  readonly saldoProgressivo: SaldoProgressivo | null;
  readonly legenda: readonly VoceLegenda[];
}

/** Il file di un dipendente: una riga per mese incluso e il totale del bimestre, più la legenda. */
export async function generaExcelIndividuale(dati: DatiExcelIndividuale): Promise<Buffer> {
  const cartella = new Workbook();
  const foglio = cartella.addWorksheet('Report');
  impostaColonne(foglio);
  foglio.getCell('A1').value = titoloReport(dati.nomeReparto, dati.idBimestre);
  foglio.getCell('A1').font = { bold: true, size: 14 };
  foglio.getCell('A2').value = dati.nomeDipendente;
  foglio.getCell('A2').font = { bold: true };
  foglio.getCell('A3').value =
    `Mesi inclusi (solo i convalidati): ${elencoMesi(dati.mesi.map((m) => m.chiave))}`;
  intestazione(foglio, 5, 'Mese');
  let riga = 6;
  for (const mese of dati.mesi) {
    rigaDati(foglio, riga, formattaMese(mese.chiave), mese.conteggi, undefined);
    riga += 1;
  }
  rigaDati(foglio, riga, 'Totale bimestre', dati.totale, dati.saldoProgressivo, true);
  scriviLegenda(foglio, riga + 2, dati.legenda);
  foglio.views = [{ state: 'frozen', ySplit: 5 }];
  return Buffer.from(await cartella.xlsx.writeBuffer());
}
