// Aiuti sui mesi del calendario (Europe/Rome).
import { DateTime } from 'luxon';
import { chiaveMese } from '../codici';
import type { ChiaveMese } from '../tipi';
import { FUSO } from '../impostazioni';

/** Giorni del mese (anno e mese 1-12); 0 se i valori non sono validi. */
export function giorniNelMese(anno: number, mese: number): number {
  const data = DateTime.fromObject({ year: anno, month: mese }, { zone: FUSO });
  return data.isValid ? (data.daysInMonth ?? 0) : 0;
}

/** Giorni che un mese può avere in un anno qualsiasi: febbraio conta 29 (per le ricorrenze annuali). */
export function giorniMassimiNelMese(mese: number): number {
  return giorniNelMese(2024, mese);
}

/** Chiave 'AAAA-MM' di un anno e un mese (1-12). */
export function chiaveMeseDa(anno: number, mese: number): ChiaveMese {
  return chiaveMese(`${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}`);
}
