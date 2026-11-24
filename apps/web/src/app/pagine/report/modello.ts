// Dal report ai dati della tabella (UX §7.10). Funzioni pure: i conteggi sono già calcolati (`conteggiBimestre()` del
// dominio, o `report/{idBimestre}` per un bimestre completo); qui si decide quali mesi entrano, se la tabella è
// provvisoria e come si compongono i testi.
import {
  conteggiBimestre,
  festivitaAnno,
  formattaDataDaMs,
  formattaDurata,
  formattaNomeMese,
  formattaOraDaMs,
  formattaOreDecimali,
  formattaSaldoOre,
  mesiDelBimestre,
  type ChiaveMese,
  type ConfigurazioneFestivita,
  type ConteggiReport,
  type FestivitaAnno,
  type IdBimestre,
  type RiepilogoPerReport,
  type SaldoProgressivo,
} from '@turni/domain';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import type { MesiDelBimestre, ReportSalvato, EsitoInvioSalvato } from '../../dati/report.repo';
import type { RiepilogoFestivitaAnno } from '../../dati/riepiloghi.repo';
import { testi } from '../../testi/it';

import { testiReport } from '../../testi/it-report';
import { nomeBreve } from '../comune/nome-breve';

export interface VistaBimestre {
  readonly idBimestre: IdBimestre;
  readonly mesi: readonly MesiDelBimestre[];
  /** Mesi creati (convalidati o in bozza): quelli che la tabella mostra. */
  readonly mesiMostrati: readonly ChiaveMese[];
  /** Mesi convalidati: gli unici che entrano nel file e nell'invio. */
  readonly mesiConvalidati: readonly ChiaveMese[];
  /** Mesi non ancora convalidati (in bozza o non creati): rendono la tabella provvisoria. */
  readonly mesiNonConvalidati: readonly ChiaveMese[];
  readonly provvisorio: boolean;
  readonly righe: Readonly<Record<string, ConteggiReport>>;
  readonly totali: ConteggiReport;
  readonly daDocumento: boolean;
}

/**
 * Il report da mostrare. Con entrambi i mesi convalidati e un documento `report/{id}` che li comprende entrambi si
 * usa il documento; altrimenti si sommano i riepiloghi dei mesi creati, in bozza compresi (vista provvisoria).
 */
export function vistaBimestre(
  idBimestre: IdBimestre,
  mesi: readonly MesiDelBimestre[],
  report: ReportSalvato | null,
  riepiloghi: readonly RiepilogoPerReport[],
): VistaBimestre {
  const mesiMostrati = mesi.filter((m) => m.stato !== null).map((m) => m.chiave);
  const mesiConvalidati = mesi.filter((m) => m.stato === 'convalidato').map((m) => m.chiave);
  const mesiNonConvalidati = mesi.filter((m) => m.stato !== 'convalidato').map((m) => m.chiave);
  const provvisorio = mesiNonConvalidati.length > 0;
  const daDocumento =
    !provvisorio &&
    report !== null &&
    mesiDelBimestre(idBimestre).every((m) => report.mesiInclusi.includes(m));
  if (daDocumento && report !== null) {
    return {
      idBimestre,
      mesi,
      mesiMostrati,
      mesiConvalidati,
      mesiNonConvalidati,
      provvisorio,
      righe: report.righe,
      totali: report.totali,
      daDocumento: true,
    };
  }
  const somma = conteggiBimestre(idBimestre, riepiloghi, mesiMostrati);
  return {
    idBimestre,
    mesi,
    mesiMostrati,
    mesiConvalidati,
    mesiNonConvalidati,
    provvisorio,
    righe: somma.righe,
    totali: somma.totali,
    daDocumento: false,
  };
}

/** I nomi dei mesi («novembre») per le frasi «Provvisorio: dicembre non ancora convalidato». */
export function nomiMesi(mesi: readonly ChiaveMese[]): readonly string[] {
  return mesi.map(formattaNomeMese);
}

/** Un valore della tabella: il prefisso «≈» (con il corsivo) segnala il provvisorio, mai il solo colore. */
export function valoreVista(valore: number, provvisorio: boolean): string {
  return `${provvisorio ? '≈' : ''}${valore}`;
}

export function durataVista(minuti: number, provvisorio: boolean): string {
  return minuti === 0 ? '—' : `${provvisorio ? '≈' : ''}${formattaDurata(minuti)}`;
}

export interface CelleConteggi {
  readonly turni: string;
  readonly notti: string;
  readonly sabati: string;
  readonly domeniche: string;
  readonly reperibilita: string;
  readonly chiamate: string;
  readonly durata: string;
  readonly oreDovute: string;
  readonly oreLavorate: string;
  readonly saldoBimestre: string;
  readonly saldoAnno: string;
}

/** Saldo da inizio anno: «+3,5», con «≈» se provvisorio, un trattino senza banca ore (o per i totali). */
export function saldoAnnoVista(saldo: SaldoProgressivo | null | undefined): string {
  return saldo === null || saldo === undefined
    ? '—'
    : `${saldo.provvisorio ? '≈' : ''}${formattaSaldoOre(saldo.minuti)}`;
}

export function celleConteggi(
  conteggi: ConteggiReport,
  provvisorio: boolean,
  saldoAnno: SaldoProgressivo | null = null,
): CelleConteggi {
  return {
    turni: valoreVista(conteggi.turniSvolti, provvisorio),
    notti: valoreVista(conteggi.notti, provvisorio),
    sabati: valoreVista(conteggi.sabati, provvisorio),
    domeniche: valoreVista(conteggi.domenicheEFestivi, provvisorio),
    reperibilita: valoreVista(conteggi.reperibilitaSvolte, provvisorio),
    chiamate: valoreVista(conteggi.chiamate, provvisorio),
    durata: durataVista(conteggi.minutiChiamate, provvisorio),
    oreDovute: `${provvisorio ? '≈' : ''}${formattaOreDecimali(conteggi.minutiDovuti)}`,
    oreLavorate: `${provvisorio ? '≈' : ''}${formattaOreDecimali(conteggi.minutiLavorati)}`,
    saldoBimestre: `${provvisorio ? '≈' : ''}${formattaSaldoOre(conteggi.saldoMinuti)}`,
    saldoAnno: saldoAnnoVista(saldoAnno),
  };
}

/** Data e ora di un invio, per «accodato 06/01/2027 08:00». */
export function dataOraInvio(ms: number): string {
  return `${formattaDataDaMs(ms)} ${formattaOraDaMs(ms)}`;
}

export interface UltimoInvioVista {
  readonly testo: string;
  readonly esito: EsitoInvioSalvato['esito'] | null;
}

export function ultimoInvioVista(invio: EsitoInvioSalvato | undefined): UltimoInvioVista {
  if (invio === undefined) {
    return { testo: testiReport.ultimoInvio.nessuno, esito: null };
  }
  switch (invio.esito) {
    case 'accodato':
      return {
        testo: testiReport.ultimoInvio.accodato(dataOraInvio(invio.ilMs)),
        esito: 'accodato',
      };
    case 'senzaEmail':
      return { testo: testiReport.ultimoInvio.senzaEmail, esito: 'senzaEmail' };
    case 'errore':
      return { testo: testiReport.ultimoInvio.errore, esito: 'errore' };
  }
}

export interface RigaReportVista {
  readonly id: string;
  readonly nome: string;
  readonly nomeCompleto: string;
  readonly celle: CelleConteggi;
  readonly ultimoInvio: UltimoInvioVista;
}

/**
 * Una riga per dipendente che ha un conteggio nei mesi mostrati, in ordine di cognome e nome; i dipendenti non più in
 * anagrafica in fondo come «Dipendente rimosso» (L3).
 */
export function righeReport(
  dipendenti: readonly DipendenteSalvato[],
  vista: VistaBimestre,
  report: ReportSalvato | null,
  saldiAnno: ReadonlyMap<string, SaldoProgressivo> = new Map(),
): readonly RigaReportVista[] {
  const perId = new Map(dipendenti.map((d) => [d.id, d]));
  const righe: { chiave: string; riga: RigaReportVista }[] = [];
  for (const [id, conteggi] of Object.entries(vista.righe)) {
    const d = perId.get(id);
    righe.push({
      chiave: d === undefined ? '￿' : `${d.cognome} ${d.nome}`.toLowerCase(),
      riga: {
        id,
        nome: d === undefined ? testi.dipendenteRimosso : nomeBreve(d.cognome, d.nome),
        nomeCompleto: d === undefined ? testi.dipendenteRimosso : `${d.cognome} ${d.nome}`,
        celle: celleConteggi(conteggi, vista.provvisorio, saldiAnno.get(id) ?? null),
        ultimoInvio: ultimoInvioVista(report?.invii[id]),
      },
    });
  }
  return righe
    .sort((a, b) => a.chiave.localeCompare(b.chiave, 'it') || a.riga.id.localeCompare(b.riga.id))
    .map((x) => x.riga);
}

// --- Festività dell'anno ---------------------------------------------------------------------------------------

export interface ColonnaFestivitaVista {
  readonly id: string;
  readonly nome: string;
  /** «25/12»: giorno e mese della festività nell'anno. */
  readonly data: string;
  readonly nonPiuInElenco: boolean;
}

export interface RigaFestivitaVista {
  readonly id: string;
  readonly nome: string;
  readonly nomeCompleto: string;
  /** Una cella per colonna: i codici dei turni lavorati, o null. */
  readonly celle: readonly (string | null)[];
  readonly totale: number;
}

export interface VistaFestivita {
  readonly colonne: readonly ColonnaFestivitaVista[];
  readonly righe: readonly RigaFestivitaVista[];
  /** Almeno un mese dell'anno con festività lavorate è ancora in bozza. */
  readonly conBozza: boolean;
}

function giornoMese(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/**
 * Righe = dipendenti in servizio nell'anno (o che hanno lavorato una festività), colonne = festività del reparto
 * dell'anno più quelle lavorate non più in elenco; ultima colonna il totale (UX §7.10).
 */
export function vistaFestivita(
  anno: number,
  configurazione: ConfigurazioneFestivita,
  dipendenti: readonly DipendenteSalvato[],
  riepiloghi: readonly RiepilogoFestivitaAnno[],
): VistaFestivita {
  const dati: FestivitaAnno = festivitaAnno(anno, configurazione, riepiloghi);
  const colonne = dati.colonne.map((c) => ({
    id: c.id,
    nome: c.nome ?? testiReport.festivita.festivitaRimossa,
    data: giornoMese(c.data),
    nonPiuInElenco: c.tipo === 'nonPiuInElenco',
  }));
  const primo = `${anno}-01-01`;
  const ultimo = `${anno}-12-31`;
  const righe: { chiave: string; riga: RigaFestivitaVista }[] = [];
  const costruisci = (id: string, nome: string, completo: string, chiave: string): void => {
    const dati1 = dati.righe[id];
    righe.push({
      chiave,
      riga: {
        id,
        nome,
        nomeCompleto: completo,
        celle: colonne.map((c) => {
          const codici = dati1?.perFestivita[c.id];
          return codici === undefined ? null : codici.join(', ');
        }),
        totale: dati1?.totale ?? 0,
      },
    });
  };
  const conosciuti = new Set(dipendenti.map((d) => d.id));
  for (const d of dipendenti) {
    const inServizio =
      (d.dataAssunzione === null || d.dataAssunzione <= ultimo) &&
      (d.dataCessazione === null || d.dataCessazione >= primo);
    if (inServizio || dati.righe[d.id] !== undefined) {
      costruisci(
        d.id,
        nomeBreve(d.cognome, d.nome),
        `${d.cognome} ${d.nome}`,
        `${d.cognome} ${d.nome}`.toLowerCase(),
      );
    }
  }
  for (const id of Object.keys(dati.righe)) {
    if (!conosciuti.has(id)) {
      costruisci(id, testi.dipendenteRimosso, testi.dipendenteRimosso, '￿');
    }
  }
  const bozze = riepiloghi.some(
    (r) => r.anno === anno && r.statoMese === 'bozza' && r.festivitaLavorate.length > 0,
  );
  return {
    colonne,
    righe: righe
      .sort((a, b) => a.chiave.localeCompare(b.chiave, 'it') || a.riga.id.localeCompare(b.riga.id))
      .map((x) => x.riga),
    conBozza: bozze,
  };
}
