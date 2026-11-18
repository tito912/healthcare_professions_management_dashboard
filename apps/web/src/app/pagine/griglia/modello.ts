// Dal documento di una riga e dalla configurazione a ciò che la griglia disegna (UX §8.2, §8.3, §9.6, §10).
// Funzioni pure: nessun accesso a Firestore, a signal o al DOM, così si provano a tabella. Le regole di calcolo
// (avvisi, totali) arrivano dal dominio già fatte: qui si compongono solo i testi e gli stili.
import {
  classificaGiorno,
  coloreTurno,
  chiaveMeseDi,
  durataNominale,
  eCellaVuota,
  eChiaveGiorno,
  festivitaDelMese,
  formattaData,
  formattaDurata,
  formattaGiornoCompleto,
  formattaIntervalloGiorni,
  formattaOreCompatte,
  formattaOreDecimali,
  formattaSaldoOre,
  giorniDelMese,
  giornoDellaSettimana,
  chiaveGiornoDi,
  inServizioIl,
  type CalendarioMese,
  type CellaDoc,
  type ChiaveGiorno,
  type ChiaveMese,
  type DataISO,
  type Festivita,
  type IdColoreTurno,
  type MotivoRifiuto,
  type OraLocale,
  type PeriodoServizio,
  type Segnalazione,
  type TipoGiorno,
  type TotaliRiga,
} from '@turni/domain';
import { testi } from '../../testi/it';
import { COLORI } from '../../ui/token';
import type { ConfigurazioneVista } from './vista';

// --- colonne (i giorni) ---------------------------------------------------------------------------

export interface ColonnaGiorno {
  readonly giorno: ChiaveGiorno;
  readonly data: DataISO;
  readonly numero: number;
  /** 1 = lunedì … 7 = domenica. */
  readonly giornoSettimana: number;
  readonly tipo: TipoGiorno;
  readonly festivita: Festivita | null;
  readonly oggi: boolean;
  /** «martedì 3 novembre 2026»: tooltip ed etichetta accessibile della colonna. */
  readonly etichetta: string;
}

/** Tutti i giorni del mese con la classificazione (feriale, sabato, domenica, festivo) e «oggi». */
export function colonneDelMese(
  chiave: ChiaveMese,
  calendario: CalendarioMese,
  oggi: DataISO,
): readonly ColonnaGiorno[] {
  const festivita = festivitaDelMese(chiave, calendario.festivita);
  return giorniDelMese(chiave).map((data) => {
    const classificazione = classificaGiorno(data, festivita);
    return {
      giorno: chiaveGiornoDi(data),
      data,
      numero: Number(data.slice(8)),
      giornoSettimana: giornoDellaSettimana(data),
      tipo: classificazione.tipo,
      festivita: classificazione.festivita,
      oggi: data === oggi,
      etichetta: formattaGiornoCompleto(data),
    };
  });
}

export type SfondoColonna = 'feriale' | 'weekend' | 'festivo';

export function sfondoDiColonna(colonna: ColonnaGiorno): SfondoColonna {
  if (colonna.tipo === 'festivoNazionale' || colonna.tipo === 'festivoLocale') {
    return 'festivo';
  }
  return colonna.tipo === 'sabato' || colonna.tipo === 'domenica' ? 'weekend' : 'feriale';
}

// --- configurazione letta dalla cella ----------------------------------------------------------

export interface TurnoDiVista {
  readonly nome: string;
  readonly colore: IdColoreTurno | null;
}

export interface ConfigVista {
  readonly turni: ReadonlyMap<string, TurnoDiVista>;
  readonly assenze: ReadonlyMap<string, { readonly descrizione: string }>;
}

// --- testi degli avvisi ------------------------------------------------------------------------

function numeroDelGiorno(data: DataISO, chiave: ChiaveMese): string {
  const giorno = String(Number(data.slice(8)));
  return chiaveMeseDi(data) === chiave ? giorno : `${giorno}/${data.slice(5, 7)}`;
}

function unitaTesto(unita: number): string {
  return Number.isInteger(unita) ? String(unita) : unita.toFixed(1).replace('.', ',');
}

export function testoSegnalazione(
  s: Segnalazione,
  contesto: { readonly nome: string; readonly chiaveMese: ChiaveMese },
): string {
  const t = testi.griglia.segnalazioni;
  switch (s.codice) {
    case 'riposoInsufficiente':
      return t.riposo(
        formattaOreCompatte(s.minutiRiposo),
        numeroDelGiorno(s.giornoPrecedente, contesto.chiaveMese),
        numeroDelGiorno(s.giorno, contesto.chiaveMese),
      );
    case 'reperibilitaOltreLimite':
      return t.reperibilitaMese(unitaTesto(s.unita));
    case 'reperibilitaSovrapposta':
      return t.reperibilitaSovrapposta(s.codiceReperibilita, s.codiceTurno);
    case 'turnoEsclusoAssegnato':
      return t.turnoEscluso(s.codiceTurno, contesto.nome);
    case 'turnoScoperto':
      return t.turnoScoperto(s.codiceTurno);
    case 'reperibilitaScoperta':
      return t.reperibilitaScoperta(s.codiceReperibilita);
    case 'cellaSaltata':
      return t.cellaSaltata(testoMotivo(s.motivo, s.codiceInserito ?? '', contesto.nome));
    default:
      return t.problemi[s.codice];
  }
}

/** Il motivo di un rifiuto come lo vede chi digita («N1 escluso per Rossi M.», UX §9.2). */
export function testoMotivo(
  motivo: MotivoRifiuto,
  codice: string,
  nome: string,
  contratto: PeriodoServizio | null = null,
): string {
  const m = testi.griglia.motivi;
  switch (motivo) {
    case 'vuoto':
      return m.vuoto;
    case 'codiceInesistente':
      return m.codiceInesistente(codice);
    case 'codiceDisattivato':
      return m.codiceDisattivato(codice);
    case 'turnoEscluso':
      return m.turnoEscluso(codice, nome);
    case 'massimoReperibilita':
      return m.massimoReperibilita;
    case 'reperibilitaGiaPresente':
      return m.reperibilitaGiaPresente(codice);
    case 'fuoriServizio':
      return contratto?.dataAssunzione != null
        ? testi.griglia.cella.fuoriServizioAssunzione(formattaData(contratto.dataAssunzione))
        : testi.griglia.cella.fuoriServizioCessazione(
            formattaData(contratto?.dataCessazione ?? ''),
          );
    case 'consuntivo':
      return m.consuntivo;
    case 'testoNonValido':
      return m.testoNonValido;
  }
}

// --- celle -------------------------------------------------------------------------------------

export interface ChipVista {
  readonly codice: string;
  readonly categoria: 'turno' | 'riposo' | 'assenza' | 'scoperto';
  /** Valore CSS di `background`. */
  readonly sfondo: string;
  readonly testo: string;
  readonly bordo: string | null;
  readonly bordoTratteggiato: boolean;
  readonly grassetto: boolean;
  /** Il codice sta su una pastiglia bianca (turno scoperto: il fondo è a righe). */
  readonly pastiglia: boolean;
  /** «07:00–14:00» sotto il codice (solo vista 1 settimana). */
  readonly orario: string | null;
  /** «MA scoperto» (viste a settimane). */
  readonly nota: string | null;
}

export interface StrisciaVoce {
  readonly codice: string;
  readonly testo: string;
  readonly tooltip: string;
  /** «☎ 45′» (vista 1 settimana). */
  readonly chiamata: string | null;
}

export interface SegniCella {
  readonly chiamata: boolean;
  readonly sostituzione: boolean;
  readonly orarioVariato: boolean;
}

export interface CellaVista {
  readonly giorno: ChiaveGiorno;
  readonly sfondo: SfondoColonna;
  readonly oggi: boolean;
  /** Tooltip «Fuori servizio: …»; null se il dipendente è in servizio. */
  readonly fuoriServizio: string | null;
  readonly chip: ChipVista | null;
  readonly striscia: readonly StrisciaVoce[];
  readonly segni: SegniCella;
  readonly livello: 'blocco' | 'avviso' | null;
  /** I testi degli avvisi della cella, uniti: `aria-describedby` e tooltip. */
  readonly avvisi: string;
  readonly etichetta: string;
  readonly tooltip: string;
  readonly grezza: boolean;
}

const SENZA_SEGNI: SegniCella = { chiamata: false, sostituzione: false, orarioVariato: false };

function fasciaBreve(ora: OraLocale): string {
  return ora.endsWith(':00') ? ora.slice(0, 2) : ora;
}

function chipDiTurno(
  cella: CellaDoc,
  config: ConfigVista,
  vista: ConfigurazioneVista,
): ChipVista | null {
  const { turno, assenza } = cella;
  const stileTurno = coloreTurno(config.turni.get(turno?.codice ?? '')?.colore ?? '');
  if (
    turno !== null &&
    assenza !== null &&
    assenza.effetto === 'neutra' &&
    cella.copertoDa === null
  ) {
    // Turno scoperto: righe diagonali del colore del turno e bianco, bordo tratteggiato, codice su pastiglia.
    const colore = stileTurno?.sfondo ?? COLORI.sfondoNeutro;
    return {
      codice: turno.codice,
      categoria: 'scoperto',
      sfondo: `repeating-linear-gradient(45deg, ${colore} 0 4px, ${COLORI.sfondo} 4px 8px)`,
      testo: COLORI.testo,
      bordo: COLORI.testoNeutro,
      bordoTratteggiato: true,
      grassetto: true,
      pastiglia: true,
      orario: null,
      nota: vista.striscia === 'ore' ? null : `${assenza.codice} ${testi.griglia.cella.scoperto}`,
    };
  }
  if (assenza !== null) {
    const comeRiposo = assenza.effetto === 'comeRiposo';
    return {
      codice: assenza.codice,
      categoria: comeRiposo ? 'riposo' : 'assenza',
      sfondo: COLORI.sfondoNeutro,
      testo: comeRiposo ? COLORI.testoSecondario : COLORI.testoNeutro,
      bordo: comeRiposo ? null : COLORI.bordoNeutro,
      bordoTratteggiato: false,
      grassetto: !comeRiposo,
      pastiglia: false,
      orario: null,
      nota: null,
    };
  }
  if (turno === null) {
    return null;
  }
  return {
    codice: turno.codice,
    categoria: 'turno',
    sfondo: stileTurno?.sfondo ?? COLORI.sfondoNeutro,
    testo: stileTurno?.testo ?? COLORI.testoNeutro,
    bordo: stileTurno?.bordo ?? COLORI.bordo,
    bordoTratteggiato: stileTurno === undefined,
    grassetto: true,
    pastiglia: false,
    orario: vista.orarioSottoCodice ? `${turno.inizio}–${turno.fine}` : null,
    nota: null,
  };
}

function striscia(
  cella: CellaDoc,
  config: ConfigVista,
  vista: ConfigurazioneVista,
): readonly StrisciaVoce[] {
  return cella.reperibilita.map((r) => {
    const nome = config.turni.get(r.codice)?.nome ?? '';
    const tooltip = `${r.codice} ${nome} · ${r.inizio}–${r.fine} · ${formattaDurata(durataNominale(r.inizio, r.fine))}`;
    const chiamata = r.chiamate[0];
    switch (vista.striscia) {
      case 'ore': {
        const mostraMinuti = vista.mostraMinutiStriscia && !r.inizio.endsWith(':00');
        return {
          codice: r.codice,
          testo: mostraMinuti ? r.inizio : r.inizio.slice(0, 2),
          tooltip,
          chiamata: null,
        };
      }
      case 'righe':
        return {
          codice: r.codice,
          testo: `${r.codice} ${fasciaBreve(r.inizio)}–${fasciaBreve(r.fine)}`,
          tooltip,
          chiamata: null,
        };
      case 'righeComplete':
        return {
          codice: r.codice,
          testo: `${r.codice} ${r.inizio}–${r.fine}`,
          tooltip,
          chiamata: chiamata === undefined ? null : `☎ ${chiamata.durataMinuti}′`,
        };
    }
  });
}

function segni(cella: CellaDoc): SegniCella {
  return {
    chiamata: cella.reperibilita.some((r) => r.chiamate.length > 0),
    sostituzione:
      cella.sostituisce !== null || cella.reperibilita.some((r) => r.sostituisce !== null),
    orarioVariato:
      cella.orarioReale !== null &&
      cella.turno !== null &&
      (cella.orarioReale.inizio !== cella.turno.inizio ||
        cella.orarioReale.fine !== cella.turno.fine),
  };
}

function contenutoPerEtichetta(cella: CellaDoc, config: ConfigVista): string[] {
  const parti: string[] = [];
  const { turno, assenza } = cella;
  const descrizioneAssenza =
    assenza === null ? '' : (config.assenze.get(assenza.codice)?.descrizione ?? '');
  if (turno !== null && assenza !== null && assenza.effetto === 'neutra') {
    parti.push(
      testi.griglia.cella.turnoScoperto(
        turno.codice,
        `${assenza.codice} ${descrizioneAssenza}`.trim(),
      ),
    );
  } else if (assenza !== null) {
    parti.push(`${assenza.codice} ${descrizioneAssenza}`.trim());
  } else if (turno !== null) {
    parti.push(
      `${turno.codice} ${config.turni.get(turno.codice)?.nome ?? ''} ${turno.inizio}–${turno.fine}`.replace(
        /\s+/g,
        ' ',
      ),
    );
  }
  for (const r of cella.reperibilita) {
    parti.push(`${testi.griglia.cella.reperibilita} ${r.codice} ${r.inizio}–${r.fine}`);
  }
  return parti;
}

export interface InputCelleRiga {
  readonly nome: string;
  readonly chiaveMese: ChiaveMese;
  readonly colonne: readonly ColonnaGiorno[];
  readonly contratto: PeriodoServizio;
  readonly giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>;
  readonly grezzi: Readonly<Record<string, unknown>>;
  readonly segnalazioni: readonly Segnalazione[];
  readonly config: ConfigVista;
  readonly vista: ConfigurazioneVista;
}

/** Le segnalazioni di una riga raggruppate per giorno (quelle senza giorno non stanno in nessuna cella). */
export function segnalazioniPerGiorno(
  segnalazioni: readonly Segnalazione[],
): ReadonlyMap<DataISO, readonly Segnalazione[]> {
  const perGiorno = new Map<DataISO, Segnalazione[]>();
  for (const s of segnalazioni) {
    if (s.giorno === null || s.livello === 'nota') {
      continue;
    }
    const elenco = perGiorno.get(s.giorno) ?? [];
    elenco.push(s);
    perGiorno.set(s.giorno, elenco);
  }
  return perGiorno;
}

/** Le celle da disegnare per i giorni visibili della riga. */
export function celleDellaRiga(input: InputCelleRiga): CellaVista[] {
  const perGiorno = segnalazioniPerGiorno(input.segnalazioni);
  return input.colonne.map((colonna) => {
    const sfondo = sfondoDiColonna(colonna);
    const grezza = input.grezzi[colonna.giorno] !== undefined;
    const cella = input.giorni[colonna.giorno] ?? null;
    const servizio = inServizioIl(input.contratto, colonna.data);
    const fuoriServizio = servizio
      ? null
      : input.contratto.dataAssunzione !== null && colonna.data < input.contratto.dataAssunzione
        ? testi.griglia.cella.fuoriServizioAssunzione(formattaData(input.contratto.dataAssunzione))
        : testi.griglia.cella.fuoriServizioCessazione(
            formattaData(input.contratto.dataCessazione ?? ''),
          );
    const delGiorno = perGiorno.get(colonna.data) ?? [];
    const testiAvvisi = delGiorno.map((s) =>
      testoSegnalazione(s, { nome: input.nome, chiaveMese: input.chiaveMese }),
    );
    if (grezza) {
      testiAvvisi.push(testi.griglia.segnalazioni.problemi.cellaMalformata);
    }
    const livello: CellaVista['livello'] =
      grezza || delGiorno.some((s) => s.livello === 'blocco')
        ? 'blocco'
        : delGiorno.length > 0
          ? 'avviso'
          : null;
    const contenuto =
      cella === null || eCellaVuota(cella) ? [] : contenutoPerEtichetta(cella, input.config);
    const parti = [
      ...(contenuto.length === 0 && fuoriServizio === null
        ? [testi.griglia.cella.vuota]
        : contenuto),
    ];
    if (fuoriServizio !== null) {
      parti.push(testi.griglia.cella.fuoriServizio);
    }
    if (livello !== null) {
      parti.push(
        `${livello === 'blocco' ? testi.griglia.cella.blocco : testi.griglia.cella.avviso}: ${testiAvvisi.join('; ')}`,
      );
    }
    const striscia_ = cella === null ? [] : striscia(cella, input.config, input.vista);
    return {
      giorno: colonna.giorno,
      sfondo,
      oggi: colonna.oggi,
      fuoriServizio,
      chip: cella === null ? null : chipDiTurno(cella, input.config, input.vista),
      striscia: striscia_,
      segni: cella === null ? SENZA_SEGNI : segni(cella),
      livello,
      avvisi: testiAvvisi.join('; '),
      etichetta: `${input.nome}, ${colonna.etichetta}: ${parti.join('; ')}`,
      tooltip: fuoriServizio ?? '',
      grezza,
    };
  });
}

// --- totali di riga ----------------------------------------------------------------------------

export interface TotaliVista {
  readonly pianificate: string;
  readonly dovute: string;
  readonly differenza: string;
  readonly differenzaNegativa: boolean;
  readonly reperibilita: string;
  /** Oltre le 7 unità (UX §7.6): testo arancione e icona. */
  readonly reperibilitaOltre: boolean;
}

export function totaliDiVista(totali: TotaliRiga, limiteUnita: number): TotaliVista {
  return {
    pianificate: formattaOreDecimali(totali.minutiPianificati),
    dovute: formattaOreDecimali(totali.minutiDovuti),
    differenza: formattaSaldoOre(totali.differenzaMinuti),
    differenzaNegativa: totali.differenzaMinuti < 0,
    reperibilita: unitaTesto(Math.round(totali.unitaReperibilita * 10) / 10).replace(
      /^(\d+)$/,
      '$1,0',
    ),
    reperibilitaOltre: totali.unitaReperibilita > limiteUnita,
  };
}

// --- confronto con il salvato --------------------------------------------------------------------

/** Uguaglianza strutturale di due valori JSON (celle e contratti): non dipende dall'ordine delle chiavi. */
export function uguali(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((valore, indice) => uguali(valore, b[indice]))
    );
  }
  const chiaviA = Object.keys(a);
  const chiaviB = Object.keys(b);
  return (
    chiaviA.length === chiaviB.length &&
    chiaviA.every((chiave) => chiave in b && uguali(Reflect.get(a, chiave), Reflect.get(b, chiave)))
  );
}

/** Le due celle (`null` = vuota) sono la stessa: tornare al valore salvato toglie la modifica (UX §9.7). */
export function celleUguali(
  a: CellaDoc | null | undefined,
  b: CellaDoc | null | undefined,
): boolean {
  const aVuota = a == null || eCellaVuota(a);
  const bVuota = b == null || eCellaVuota(b);
  return aVuota || bVuota ? aVuota && bVuota : uguali(a, b);
}

/** I giorni la cui cella è diversa da quella salvata. */
export function giorniModificati(
  corrente: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>,
  salvato: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>> | undefined,
): ReadonlySet<ChiaveGiorno> {
  const tutti = new Set<ChiaveGiorno>(
    [...Object.keys(corrente), ...Object.keys(salvato ?? {})].filter(eChiaveGiorno),
  );
  const modificati = new Set<ChiaveGiorno>();
  for (const giorno of tutti) {
    if (!celleUguali(corrente[giorno], salvato?.[giorno])) {
      modificati.add(giorno);
    }
  }
  return modificati;
}

/** «Rossi M.»: cognome e iniziale del nome (UX §7.6). */
export function nomeBreve(cognome: string, nome: string): string {
  const iniziale = nome.trim().charAt(0).toUpperCase();
  return iniziale === '' ? cognome : `${cognome} ${iniziale}.`;
}

/** Il giorno nei testi del pannello: «3 nov». */
export function giornoBreve(data: DataISO): string {
  return formattaIntervalloGiorni(data, data);
}
