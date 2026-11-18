// Festività (D14, L36): le nazionali si calcolano, il coordinatore le esclude e aggiunge le locali.
import { DateTime } from 'luxon';
import { dataISO } from '../codici';
import { FUSO } from '../impostazioni';
import type { ConfigurazioneFestivita, FestivitaLocale } from '../documenti';
import { ID_FESTIVITA_NAZIONALI, type DataISO, type IdFestivitaNazionale } from '../tipi';
import { giorniMassimiNelMese } from './mesi';

export type TipoFestivita = 'nazionale' | 'locale';

/** Una festività in un anno preciso. `id` è l'ID nazionale o quello della locale (stabile negli anni). */
export interface Festivita {
  readonly id: string;
  readonly nome: string;
  readonly data: DataISO;
  readonly tipo: TipoFestivita;
}

export const NOMI_FESTIVITA_NAZIONALI: Readonly<Record<IdFestivitaNazionale, string>> = {
  capodanno: 'Capodanno',
  epifania: 'Epifania',
  pasqua: 'Pasqua',
  pasquetta: 'Lunedì dell’Angelo',
  liberazione: 'Festa della Liberazione',
  lavoro: 'Festa dei Lavoratori',
  repubblica: 'Festa della Repubblica',
  ferragosto: 'Assunzione di Maria',
  'san-francesco': 'San Francesco d’Assisi',
  ognissanti: 'Ognissanti',
  immacolata: 'Immacolata Concezione',
  natale: 'Natale',
  'santo-stefano': 'Santo Stefano',
};

/** Primo anno in cui il 4 ottobre è festa nazionale (Legge 151/2025). */
export const PRIMO_ANNO_SAN_FRANCESCO = 2026;
/** Massimo di festività locali per reparto (come firestore.rules). */
export const MAX_FESTIVITA_LOCALI = 20;
/** Anni di cui l'interfaccia calcola le festività. */
export const ANNO_MINIMO_FESTIVITA = 2000;
export const ANNO_MASSIMO_FESTIVITA = 2099;

const REGEX_ID_LOCALE = /^loc-[a-z0-9-]{1,30}$/;

function formatta(data: DateTime): DataISO {
  return dataISO(data.toFormat('yyyy-LL-dd'));
}

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function dataPasqua(anno: number): DataISO {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return formatta(DateTime.fromObject({ year: anno, month: mese, day: giorno }, { zone: FUSO }));
}

function ordina(elenco: readonly Festivita[]): readonly Festivita[] {
  return [...elenco].sort(
    (x, y) => x.data.localeCompare(y.data) || x.nome.localeCompare(y.nome, 'it'),
  );
}

function nazionale(id: IdFestivitaNazionale, data: DataISO): Festivita {
  return { id, nome: NOMI_FESTIVITA_NAZIONALI[id], data, tipo: 'nazionale' };
}

/**
 * Le festività nazionali dell'anno in ordine di data: Pasqua e lunedì dell'Angelo calcolati, il 4 ottobre
 * solo dal 2026. `oggi` non serve: il calendario dipende solo dall'anno.
 */
export function festivitaNazionali(anno: number): readonly Festivita[] {
  const pasqua = DateTime.fromISO(dataPasqua(anno), { zone: FUSO });
  const giorno = (mese: number, giornoDelMese: number): DataISO =>
    formatta(DateTime.fromObject({ year: anno, month: mese, day: giornoDelMese }, { zone: FUSO }));
  const elenco: Festivita[] = [
    nazionale('capodanno', giorno(1, 1)),
    nazionale('epifania', giorno(1, 6)),
    nazionale('pasqua', formatta(pasqua)),
    nazionale('pasquetta', formatta(pasqua.plus({ days: 1 }))),
    nazionale('liberazione', giorno(4, 25)),
    nazionale('lavoro', giorno(5, 1)),
    nazionale('repubblica', giorno(6, 2)),
    nazionale('ferragosto', giorno(8, 15)),
    nazionale('ognissanti', giorno(11, 1)),
    nazionale('immacolata', giorno(12, 8)),
    nazionale('natale', giorno(12, 25)),
    nazionale('santo-stefano', giorno(12, 26)),
  ];
  if (anno >= PRIMO_ANNO_SAN_FRANCESCO) {
    elenco.push(nazionale('san-francesco', giorno(10, 4)));
  }
  return ordina(elenco);
}

/** Data di una festività locale in un anno, o null se non esiste in quell'anno (29 febbraio). */
export function dataFestivitaLocale(anno: number, locale: FestivitaLocale): DataISO | null {
  const data = DateTime.fromObject(
    { year: anno, month: locale.mese, day: locale.giorno },
    { zone: FUSO },
  );
  return data.isValid ? formatta(data) : null;
}

/** Le festività del reparto in un anno: nazionali non escluse più le locali, in ordine di data. */
export function festivitaReparto(
  anno: number,
  configurazione: ConfigurazioneFestivita,
): readonly Festivita[] {
  const nazionali = festivitaNazionali(anno).filter(
    (f) => !configurazione.nazionaliEscluse.some((id) => id === f.id),
  );
  const locali: Festivita[] = [];
  for (const locale of configurazione.locali) {
    const data = dataFestivitaLocale(anno, locale);
    if (data !== null) {
      locali.push({ id: locale.id, nome: locale.nome, data, tipo: 'locale' });
    }
  }
  return ordina([...nazionali, ...locali]);
}

/** Le nazionali escluse che esistono nell'anno: l'elenco da cui «Ripristina». */
export function nazionaliEscluseNellAnno(
  anno: number,
  configurazione: ConfigurazioneFestivita,
): readonly Festivita[] {
  return festivitaNazionali(anno).filter((f) =>
    configurazione.nazionaliEscluse.some((id) => id === f.id),
  );
}

export type MotivoErroreFestivita =
  | 'nomeVuoto'
  | 'nomeTroppoLungo'
  | 'giornoNonValido'
  | 'meseNonValido'
  | 'dataInesistente'
  | 'idNonValido';

/** Errore di una festività locale (nome 1-60, giorno e mese esistenti, id 'loc-…'); null se è valida. */
export function validaFestivitaLocale(locale: FestivitaLocale): MotivoErroreFestivita | null {
  const nome = locale.nome.trim();
  if (nome === '') {
    return 'nomeVuoto';
  }
  if (nome.length > 60) {
    return 'nomeTroppoLungo';
  }
  if (!Number.isInteger(locale.mese) || locale.mese < 1 || locale.mese > 12) {
    return 'meseNonValido';
  }
  if (!Number.isInteger(locale.giorno) || locale.giorno < 1 || locale.giorno > 31) {
    return 'giornoNonValido';
  }
  if (locale.giorno > giorniMassimiNelMese(locale.mese)) {
    return 'dataInesistente';
  }
  return REGEX_ID_LOCALE.test(locale.id) ? null : 'idNonValido';
}

/** Errore dell'intera configurazione (lo verifica il browser: le regole controllano solo tipo e numero). */
export function validaConfigurazioneFestivita(
  configurazione: ConfigurazioneFestivita,
): MotivoErroreFestivita | 'troppeLocali' | 'idRipetuto' | 'nazionaleSconosciuta' | null {
  if (configurazione.locali.length > MAX_FESTIVITA_LOCALI) {
    return 'troppeLocali';
  }
  if (
    configurazione.nazionaliEscluse.some((id) => !ID_FESTIVITA_NAZIONALI.some((n) => n === id)) ||
    new Set(configurazione.nazionaliEscluse).size !== configurazione.nazionaliEscluse.length
  ) {
    return 'nazionaleSconosciuta';
  }
  if (new Set(configurazione.locali.map((l) => l.id)).size !== configurazione.locali.length) {
    return 'idRipetuto';
  }
  for (const locale of configurazione.locali) {
    const errore = validaFestivitaLocale(locale);
    if (errore !== null) {
      return errore;
    }
  }
  return null;
}

/**
 * ID di una festività locale: 'loc-' più il nome ridotto a minuscole, cifre e trattini, più un suffisso
 * (casuale, scelto dal chiamante) che lo rende unico. Al massimo 30 caratteri dopo 'loc-'.
 */
export function idFestivitaLocale(nome: string, suffisso: string): string {
  const pulito = (testo: string): string =>
    testo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const coda = pulito(suffisso).slice(0, 8);
  const radice = pulito(nome)
    .slice(0, 29 - coda.length)
    .replace(/-+$/g, '');
  return `loc-${[radice, coda].filter((parte) => parte !== '').join('-') || 'f'}`;
}
