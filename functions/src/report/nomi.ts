// Nomi dei file e testi comuni del report. I nomi dei dipendenti compaiono solo nei file Excel e nelle email (L16, L17).
import { etichettaBimestre, formattaMese, type ChiaveMese, type IdBimestre } from '@turni/domain';

export const DIPENDENTE_RIMOSSO = 'Dipendente rimosso';

/** Parte del nome del file: minuscolo, senza accenti né simboli («Pronto Soccorso» → «pronto-soccorso»). */
export function slug(testo: string): string {
  const pulito = testo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return pulito === '' ? 'reparto' : pulito;
}

export function nomeFileReparto(idBimestre: IdBimestre, nomeReparto: string): string {
  return `report-${idBimestre}-${slug(nomeReparto)}.xlsx`;
}

export function nomeFileIndividuale(idBimestre: IdBimestre): string {
  return `report-${idBimestre}.xlsx`;
}

/** «Novembre 2026, Dicembre 2026». */
export function elencoMesi(mesi: readonly ChiaveMese[]): string {
  return mesi.map(formattaMese).join(', ');
}

export function titoloReport(nomeReparto: string, idBimestre: IdBimestre): string {
  return `${nomeReparto} · Report ${etichettaBimestre(idBimestre)}`;
}
