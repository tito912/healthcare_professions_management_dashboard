import { InjectionToken } from '@angular/core';
import { dataISO, oggi, type DataISO } from '@turni/domain';
import { ambiente } from '../../environments/environment';

/**
 * Il giorno di oggi (a Europe/Rome) letto dal dominio. Un token perché i test lo fissano: le regole di calcolo
 * lo ricevono sempre come parametro (CLAUDE.md).
 */
export const DATA_OGGI = new InjectionToken<() => DataISO>('DATA_OGGI', {
  providedIn: 'root',
  factory: () => () => dataISO(oggi()),
});

/** Quanti mesi dopo quello corrente si possono creare e modificare (D8): 2 in produzione, 24 sugli emulatori. */
export const FINESTRA_MESI_MODIFICABILI = new InjectionToken<number>('FINESTRA_MESI_MODIFICABILI', {
  providedIn: 'root',
  factory: () => ambiente.finestraMesiModificabili,
});
