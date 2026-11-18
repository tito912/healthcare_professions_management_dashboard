import type { Routes } from '@angular/router';
import { guardiaRuolo, modificheNonSalvateGuard } from '../../core/guardie';
import { testi } from '../../testi/it';
import { DipendentiStore } from './dipendenti.store';

const TITOLO = `${testi.dipendenti.titolo} · ${testi.app.titolo}`;

/**
 * Rotte della schermata 4 (UX §2): elenco, e la scheda come rotta figlia nello stesso pannello. Lo stato
 * (reparto, dipendenti, turni) è fornito dalla rotta, così elenco e scheda leggono gli stessi dati.
 */
export const ROTTE_DIPENDENTI: Routes = [
  {
    path: '',
    title: TITOLO,
    providers: [DipendentiStore],
    loadComponent: () => import('./dipendenti').then((m) => m.Dipendenti),
    children: [
      { path: '', pathMatch: 'full', children: [] },
      {
        path: 'nuovo',
        title: TITOLO,
        canActivate: [guardiaRuolo('COORDINATORE')],
        canDeactivate: [modificheNonSalvateGuard],
        loadComponent: () => import('./scheda-dipendente').then((m) => m.SchedaDipendente),
      },
      {
        path: ':did/anagrafica',
        title: TITOLO,
        canDeactivate: [modificheNonSalvateGuard],
        loadComponent: () => import('./scheda-dipendente').then((m) => m.SchedaDipendente),
      },
    ],
  },
];
