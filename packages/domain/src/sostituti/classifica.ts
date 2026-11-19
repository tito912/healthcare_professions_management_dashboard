// Classifica dei sostituti (SPEC «Trova sostituto», U8, L9, PIANO 3.1a criterio 4). Funzione pura: righe del mese,
// righe adiacenti, turni esclusi, riepiloghi e saldi arrivano come parametri. Restituisce dati, mai testi.
//
// Disponibilità (L9), per un turno principale scoperto:
//   - fuori servizio quel giorno (contratto della riga);
//   - assente: un'assenza neutra (malattia, ferie…) nella sua cella quel giorno; riposo e smonto non escludono;
//   - turno tra gli esclusi;
//   - già in servizio: un suo turno principale svolto (orario reale se c'è), del giorno stesso, di quello prima o di
//     quello dopo (anche a cavallo di mese), si sovrappone all'orario scoperto;
//   - ha già un turno principale quel giorno, anche senza sovrapposizione (un solo turno per cella).
//   Una sua reperibilità sovrapposta non esclude: dà l'etichetta «Reperibile».
// Per una reperibilità scoperta: fuori servizio, assente, esclusa, sovrapposizione con un turno principale o con
// un'altra sua reperibilità (giorno stesso, prima o dopo), già 2 reperibilità quel giorno.
// Il primo motivo che vale, in quest'ordine, è quello riportato.
//
// Ordine dei disponibili (criterio dei pari merito, documentato in ARCHITETTURA §14 e nell'handoff 3.1a):
//   1. chi non avrebbe 11 ore di riposo prima o dopo il turno scoperto va in fondo (marcato), con lo stesso ordine;
//   2. meno volte quel codice tra il mese corrente (dalla griglia) e i 12 mesi precedenti (dai riepiloghi);
//   3. a parità, saldo della banca ore più basso (chi è più a debito; D4); saldo sconosciuto dopo quelli noti;
//   4. a parità, l'ordine delle righe ricevute (quello della griglia, per cognome e nome).
// «Reperibile» non entra nell'ordine. I non disponibili restano nell'ordine delle righe.
import { dataDelGiorno, spostaGiorni, spostaMese } from '../calendario/mesi';
import { inServizioIl } from '../calendario/servizio';
import type { OggettoSostituzione, RigaConsuntivo } from '../consuntivo/sostituzione';
import type { CellaDoc, RiepilogoMensileDoc, RigaDoc, TurnoInCella } from '../documenti';
import { cellaVuota } from '../griglia/cella';
import { MAX_REPERIBILITA_GIORNO, MESI_STORICO_SOSTITUTI } from '../impostazioni';
import {
  giorniDaRighe,
  intervalloTurnoSvolto,
  reperibilitaSvolta,
  turnoSvolto,
  type GiornoRiga,
} from '../regole/giorni-riga';
import { avvisiRiposo } from '../regole/riposo';
import type {
  ChiaveGiorno,
  ChiaveMese,
  CodiceAssenza,
  CodiceTurno,
  DataISO,
  Minuti,
  OraLocale,
} from '../tipi';
import { intervalloReale, type IntervalloReale } from '../turni/durata';

/** Le mappe `giorni` dello stesso dipendente nel mese prima e dopo (sovrapposizioni e riposo a cavallo di mese). */
export interface RigheAdiacentiDipendente {
  readonly precedente: RigaDoc['giorni'] | null;
  readonly successiva: RigaDoc['giorni'] | null;
}

/** I campi del riepilogo mensile che servono al conteggio. */
export type RiepilogoPerClassifica = Pick<
  RiepilogoMensileDoc,
  'dipendenteId' | 'chiaveMese' | 'conteggiPerCodice'
>;

export interface DatiClassifica {
  readonly chiaveMese: ChiaveMese;
  readonly giorno: ChiaveGiorno;
  /** Il dipendente con il turno o la fascia scoperti: non compare nella classifica. */
  readonly assenteId: string;
  readonly oggetto: OggettoSostituzione;
  /** Le righe del mese (con le modifiche non salvate), nell'ordine della griglia: i candidati sono queste. */
  readonly righe: readonly RigaConsuntivo[];
  /** Per dipendente; un dipendente senza voce non ha righe adiacenti. */
  readonly righeAdiacenti: Readonly<Record<string, RigheAdiacentiDipendente>>;
  /** Turni e fasce esclusi, dal documento del dipendente; un dipendente senza voce non ne ha. */
  readonly turniEsclusi: Readonly<Record<string, readonly CodiceTurno[]>>;
  /** Riepiloghi dei mesi precedenti (si usano solo i 12 prima del mese; gli altri si scartano). */
  readonly riepiloghi: readonly RiepilogoPerClassifica[];
  /**
   * Saldo della banca ore per dipendente; senza voce è sconosciuto. Per i pari merito va passato il
   * `saldoDefinitivoMinuti` della banca ore dell'anno corrente (solo mesi convalidati): `saldoAnnoMinuti` include i
   * mesi in bozza, anche futuri e ancora vuoti, dove una cella vuota in un feriale vale come un riposo (L32) e
   * farebbe passare avanti chi ha solo un mese appena creato (review 3.1a, rilievo 2).
   * Limite noto: il riporto dall'anno prima è `saldoAnnoMinuti`, quindi può contenere mesi in bozza (review 3.1b,
   * rilievo 2).
   */
  readonly saldi: Readonly<Record<string, Minuti>>;
}

/** Minuti di riposo sotto le 11 ore prima e dopo il turno scoperto; null dove le 11 ore ci sono. */
export interface RiposoInsufficiente {
  readonly prima: Minuti | null;
  readonly dopo: Minuti | null;
}

export interface CandidatoDisponibile {
  readonly dipendenteId: string;
  /** Volte in cui ha svolto quel codice nel mese corrente e nei 12 precedenti. */
  readonly volte: number;
  readonly saldoMinuti: Minuti | null;
  /** In reperibilità in una fascia che si sovrappone all'orario scoperto (solo per i turni principali). */
  readonly reperibile: boolean;
  /** Null se le 11 ore di riposo prima e dopo ci sono; si valuta solo per i turni principali. */
  readonly riposo: RiposoInsufficiente | null;
}

export type MotivoNonDisponibile =
  | { readonly codice: 'fuoriServizio' }
  | { readonly codice: 'assente'; readonly codiceAssenza: CodiceAssenza }
  | { readonly codice: 'turnoEscluso'; readonly codiceTurno: CodiceTurno }
  | {
      readonly codice: 'giaInServizio';
      readonly tipo: 'turno' | 'reperibilita';
      /** Giorno della cella del turno o della fascia che si sovrappone. */
      readonly giorno: DataISO;
      readonly codiceTurno: CodiceTurno;
      readonly inizio: OraLocale;
      readonly fine: OraLocale;
    }
  | {
      readonly codice: 'haGiaTurno';
      readonly codiceTurno: CodiceTurno;
      readonly inizio: OraLocale;
      readonly fine: OraLocale;
    }
  | { readonly codice: 'massimoReperibilita' };

export interface CandidatoNonDisponibile {
  readonly dipendenteId: string;
  readonly motivo: MotivoNonDisponibile;
}

export interface ClassificaSostituti {
  readonly disponibili: readonly CandidatoDisponibile[];
  readonly nonDisponibili: readonly CandidatoNonDisponibile[];
}

/** Il turno o la fascia da coprire, con il suo intervallo reale (orario pianificato, col cambio d'ora). */
interface BaseScoperto {
  readonly data: DataISO;
  readonly codice: CodiceTurno;
  readonly intervallo: IntervalloReale;
}
export type Scoperto =
  /** `turno`: il turno da copiare nella cella del sostituto. */
  | (BaseScoperto & { readonly tipo: 'turno'; readonly turno: TurnoInCella })
  | (BaseScoperto & { readonly tipo: 'reperibilita' });

/** Il turno principale o la fascia della cella dell'assente, o null se la cella non li ha o il giorno non esiste. */
export function scopertoDi(
  chiaveMese: ChiaveMese,
  giorno: ChiaveGiorno,
  cella: CellaDoc | undefined,
  oggetto: OggettoSostituzione,
): Scoperto | null {
  const data = dataDelGiorno(chiaveMese, giorno);
  if (data === null || cella === undefined) {
    return null;
  }
  if (oggetto.tipo === 'turno') {
    return cella.turno === null
      ? null
      : {
          tipo: 'turno',
          data,
          codice: cella.turno.codice,
          intervallo: intervalloReale(data, cella.turno.inizio, cella.turno.fine),
          turno: cella.turno,
        };
  }
  const fascia = cella.reperibilita.find((r) => r.codice === oggetto.codice);
  return fascia === undefined
    ? null
    : {
        tipo: 'reperibilita',
        data,
        codice: fascia.codice,
        intervallo: intervalloReale(data, fascia.inizio, fascia.fine),
      };
}

export interface CandidatoDaValutare {
  readonly riga: RigaConsuntivo;
  readonly adiacenti: RigheAdiacentiDipendente | null;
  readonly turniEsclusi: readonly CodiceTurno[];
}

export type ValutazioneCandidato =
  | { readonly esito: 'nonDisponibile'; readonly motivo: MotivoNonDisponibile }
  | {
      readonly esito: 'disponibile';
      readonly reperibile: boolean;
      readonly riposo: RiposoInsufficiente | null;
    };

function siSovrappongono(a: IntervalloReale, b: IntervalloReale): boolean {
  return a.inizioMs < b.fineMs && b.inizioMs < a.fineMs;
}

/** Le celle del candidato nel mese e nei due adiacenti, in ordine di data. */
function giorniDelCandidato(chiaveMese: ChiaveMese, candidato: CandidatoDaValutare): GiornoRiga[] {
  return giorniDaRighe([
    { chiaveMese: spostaMese(chiaveMese, -1), giorni: candidato.adiacenti?.precedente ?? {} },
    { chiaveMese, giorni: candidato.riga.giorni },
    { chiaveMese: spostaMese(chiaveMese, 1), giorni: candidato.adiacenti?.successiva ?? {} },
  ]);
}

/** Il primo turno principale svolto (giorno prima, stesso, dopo) che si sovrappone all'intervallo, come motivo. */
function turnoSovrapposto(
  vicini: readonly GiornoRiga[],
  intervallo: IntervalloReale,
): MotivoNonDisponibile | null {
  for (const { giorno, cella } of vicini) {
    const svolto = intervalloTurnoSvolto(giorno, cella);
    if (svolto !== null && cella.turno !== null && siSovrappongono(svolto, intervallo)) {
      const orario = cella.orarioReale ?? cella.turno;
      return {
        codice: 'giaInServizio',
        tipo: 'turno',
        giorno,
        codiceTurno: cella.turno.codice,
        inizio: orario.inizio,
        fine: orario.fine,
      };
    }
  }
  return null;
}

/** La prima reperibilità a carico del candidato (giorno prima, stesso, dopo) che si sovrappone all'intervallo. */
function reperibilitaSovrapposta(
  vicini: readonly GiornoRiga[],
  intervallo: IntervalloReale,
): MotivoNonDisponibile | null {
  for (const { giorno, cella } of vicini) {
    for (const fascia of cella.reperibilita) {
      if (
        reperibilitaSvolta(cella, fascia) &&
        siSovrappongono(intervalloReale(giorno, fascia.inizio, fascia.fine), intervallo)
      ) {
        return {
          codice: 'giaInServizio',
          tipo: 'reperibilita',
          giorno,
          codiceTurno: fascia.codice,
          inizio: fascia.inizio,
          fine: fascia.fine,
        };
      }
    }
  }
  return null;
}

/**
 * Riposo con il turno scoperto aggiunto alla cella del candidato (al posto di un riposo o di uno smonto): gli avvisi
 * di `avvisiRiposo()` sul turno nuovo (prima) e sul turno successivo che segue il turno nuovo (dopo).
 */
function riposoConTurno(
  giorni: readonly GiornoRiga[],
  data: DataISO,
  cella: CellaDoc,
  turno: TurnoInCella,
): RiposoInsufficiente | null {
  const simulata: CellaDoc = {
    ...cella,
    turno,
    assenza: null,
    orarioReale: null,
    sostituisce: null,
    copertoDa: null,
  };
  const simulati = [...giorni.filter((g) => g.giorno !== data), { giorno: data, cella: simulata }];
  const avvisi = avvisiRiposo(simulati);
  const prima = avvisi.find((a) => a.giorno === data)?.minutiRiposo ?? null;
  const dopo =
    avvisi.find((a) => a.giorno !== data && a.giornoPrecedente === data && a.origine === 'turno')
      ?.minutiRiposo ?? null;
  return prima === null && dopo === null ? null : { prima, dopo };
}

/**
 * Disponibilità di un candidato per il turno o la fascia scoperti (L9), con il primo motivo che lo esclude, oppure
 * «Reperibile» e il riposo insufficiente. La usano `classificaSostituti()` e `validaModifica()`.
 */
export function valutaCandidato(
  chiaveMese: ChiaveMese,
  scoperto: Scoperto,
  candidato: CandidatoDaValutare,
): ValutazioneCandidato {
  const { data, intervallo } = scoperto;
  const nonDisponibile = (motivo: MotivoNonDisponibile): ValutazioneCandidato => ({
    esito: 'nonDisponibile',
    motivo,
  });
  if (!inServizioIl(candidato.riga.contratto, data)) {
    return nonDisponibile({ codice: 'fuoriServizio' });
  }
  const tutti = giorniDelCandidato(chiaveMese, candidato);
  const cella = tutti.find((g) => g.giorno === data)?.cella ?? cellaVuota();
  if (cella.assenza?.effetto === 'neutra') {
    return nonDisponibile({ codice: 'assente', codiceAssenza: cella.assenza.codice });
  }
  if (candidato.turniEsclusi.includes(scoperto.codice)) {
    return nonDisponibile({ codice: 'turnoEscluso', codiceTurno: scoperto.codice });
  }
  const giorniVicini = new Set([spostaGiorni(data, -1), data, spostaGiorni(data, 1)]);
  const vicini = tutti.filter((g) => giorniVicini.has(g.giorno));
  const sovrapposto = turnoSovrapposto(vicini, intervallo);
  if (sovrapposto !== null) {
    return nonDisponibile(sovrapposto);
  }
  if (scoperto.tipo === 'reperibilita') {
    const altraFascia = reperibilitaSovrapposta(vicini, intervallo);
    if (altraFascia !== null) {
      return nonDisponibile(altraFascia);
    }
    if (cella.reperibilita.length >= MAX_REPERIBILITA_GIORNO) {
      return nonDisponibile({ codice: 'massimoReperibilita' });
    }
    return { esito: 'disponibile', reperibile: false, riposo: null };
  }
  if (cella.turno !== null) {
    return nonDisponibile({
      codice: 'haGiaTurno',
      codiceTurno: cella.turno.codice,
      inizio: cella.turno.inizio,
      fine: cella.turno.fine,
    });
  }
  return {
    esito: 'disponibile',
    reperibile: reperibilitaSovrapposta(vicini, intervallo) !== null,
    riposo: riposoConTurno(tutti, data, cella, scoperto.turno),
  };
}

/** Volte del codice nelle celle del mese: turni principali svolti e reperibilità a carico del dipendente. */
function volteNelMese(giorni: RigaDoc['giorni'], codice: CodiceTurno): number {
  let volte = 0;
  for (const cella of Object.values(giorni)) {
    if (cella === undefined) {
      continue;
    }
    if (turnoSvolto(cella) && cella.turno?.codice === codice) {
      volte += 1;
    }
    volte += cella.reperibilita.filter(
      (r) => r.codice === codice && reperibilitaSvolta(cella, r),
    ).length;
  }
  return volte;
}

/**
 * Volte del codice nei riepiloghi dei 12 mesi prima di `chiaveMese`. Un riepilogo per dipendente e mese: con un
 * doppione vale l'ultimo dell'elenco, come in `bancaOreAnno()`.
 */
function volteNeiRiepiloghi(
  chiaveMese: ChiaveMese,
  codice: CodiceTurno,
  riepiloghi: readonly RiepilogoPerClassifica[],
): Map<string, number> {
  const primo = spostaMese(chiaveMese, -MESI_STORICO_SOSTITUTI);
  const ultimo = spostaMese(chiaveMese, -1);
  const ultimoPerMese = new Map<string, RiepilogoPerClassifica>();
  for (const riepilogo of riepiloghi) {
    if (riepilogo.chiaveMese >= primo && riepilogo.chiaveMese <= ultimo) {
      ultimoPerMese.set(`${riepilogo.dipendenteId}_${riepilogo.chiaveMese}`, riepilogo);
    }
  }
  const volte = new Map<string, number>();
  for (const riepilogo of ultimoPerMese.values()) {
    const n = riepilogo.conteggiPerCodice[codice] ?? 0;
    volte.set(riepilogo.dipendenteId, (volte.get(riepilogo.dipendenteId) ?? 0) + n);
  }
  return volte;
}

function confrontaSaldi(a: Minuti | null, b: Minuti | null): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return a - b;
}

/**
 * Classifica dei sostituti per il turno principale o la fascia scoperti dell'assente nel giorno dato. Null se la
 * cella dell'assente non ha quel turno o quella fascia (o il giorno non è del mese).
 */
export function classificaSostituti(dati: DatiClassifica): ClassificaSostituti | null {
  const assente = dati.righe.find((r) => r.dipendenteId === dati.assenteId);
  const scoperto =
    assente === undefined
      ? null
      : scopertoDi(dati.chiaveMese, dati.giorno, assente.giorni[dati.giorno], dati.oggetto);
  if (scoperto === null) {
    return null;
  }
  const storico = volteNeiRiepiloghi(dati.chiaveMese, scoperto.codice, dati.riepiloghi);
  const disponibili: CandidatoDisponibile[] = [];
  const nonDisponibili: CandidatoNonDisponibile[] = [];
  for (const riga of dati.righe) {
    const id = riga.dipendenteId;
    if (id === dati.assenteId) {
      continue;
    }
    const valutazione = valutaCandidato(dati.chiaveMese, scoperto, {
      riga,
      adiacenti: dati.righeAdiacenti[id] ?? null,
      turniEsclusi: dati.turniEsclusi[id] ?? [],
    });
    if (valutazione.esito === 'nonDisponibile') {
      nonDisponibili.push({ dipendenteId: id, motivo: valutazione.motivo });
      continue;
    }
    disponibili.push({
      dipendenteId: id,
      volte: (storico.get(id) ?? 0) + volteNelMese(riga.giorni, scoperto.codice),
      saldoMinuti: dati.saldi[id] ?? null,
      reperibile: valutazione.reperibile,
      riposo: valutazione.riposo,
    });
  }
  // Array.prototype.sort è stabile: a parità resta l'ordine delle righe.
  disponibili.sort(
    (a, b) =>
      Number(a.riposo !== null) - Number(b.riposo !== null) ||
      a.volte - b.volte ||
      confrontaSaldi(a.saldoMinuti, b.saldoMinuti),
  );
  return { disponibili, nonDisponibili };
}
