import { Routes } from '@angular/router';
import { meseCorrente } from '@turni/domain';
import {
  guardiaAnonimo,
  guardiaAutenticato,
  guardiaRuolo,
  modificheNonSalvateGuard,
} from './core/guardie';
import { testi } from './testi/it';

// Le pagine si caricano in modo differito: il bundle iniziale resta quello di accesso e ossatura
// (la pagina Utenti porta con sé zod e i contratti delle callable).
export const routes: Routes = [
  {
    path: 'accesso',
    canActivate: [guardiaAnonimo],
    title: `${testi.accesso.titoloPagina} · ${testi.app.titolo}`,
    loadComponent: () => import('./pagine/accesso/accesso').then((m) => m.Accesso),
  },
  {
    path: '',
    canActivate: [guardiaAutenticato],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: `${testi.home.titolo} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/home/home').then((m) => m.Home),
      },
      {
        path: 'utenti',
        canActivate: [guardiaRuolo('ADMIN')],
        title: `${testi.utenti.titolo} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/utenti/utenti').then((m) => m.Utenti),
      },
      {
        path: 'reparti/nuovo',
        canActivate: [guardiaRuolo('COORDINATORE')],
        title: `${testi.nuovoReparto.titolo} · ${testi.app.titolo}`,
        loadComponent: () =>
          import('./pagine/reparto/nuovo/nuovo-reparto').then((m) => m.NuovoReparto),
      },
      {
        path: 'reparti/:rid',
        pathMatch: 'full',
        redirectTo: ({ params }) => `/reparti/${params['rid'] ?? ''}/mesi/${meseCorrente()}`,
      },
      {
        path: 'reparti/:rid/mesi/:chiaveMese',
        title: `${testi.reparto.sezioni.mesi} · ${testi.app.titolo}`,
        canDeactivate: [modificheNonSalvateGuard],
        loadComponent: () => import('./pagine/griglia/griglia.page').then((m) => m.GrigliaPage),
      },
      {
        path: 'reparti/:rid/configurazione',
        title: `${testi.configurazione.titolo} · ${testi.app.titolo}`,
        canDeactivate: [modificheNonSalvateGuard],
        loadComponent: () =>
          import('./pagine/reparto/configurazione/configurazione').then((m) => m.Configurazione),
      },
      {
        path: 'reparti/:rid/dipendenti',
        loadChildren: () => import('./pagine/dipendenti/rotte').then((m) => m.ROTTE_DIPENDENTI),
      },
      {
        path: 'reparti/:rid/banca-ore',
        title: `${testi.bancaOre.titolo} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/banca-ore/banca-ore').then((m) => m.BancaOre),
      },
      {
        path: 'reparti/:rid/banca-ore/:did',
        title: `${testi.dettaglioDipendente.titolo} · ${testi.app.titolo}`,
        loadComponent: () =>
          import('./pagine/dettaglio-dipendente/dettaglio-dipendente').then(
            (m) => m.DettaglioDipendente,
          ),
      },
      {
        path: 'reparti/:rid/report',
        title: `${testi.menu.report} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/report/report').then((m) => m.Report),
      },
      {
        path: 'report',
        canActivate: [guardiaRuolo('ADMIN')],
        title: `${testi.menu.reportTutti} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/report/report-tutti').then((m) => m.ReportTutti),
      },
      {
        path: 'registro',
        title: `${testi.segnaposto.registro} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.registro },
        loadComponent: () =>
          import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'errore',
        title: `${testi.errore.titolo} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/errore/errore').then((m) => m.Errore),
      },
      {
        path: '**',
        title: `${testi.errore.nonTrovataTitolo} · ${testi.app.titolo}`,
        loadComponent: () => import('./pagine/errore/errore').then((m) => m.NonTrovata),
      },
    ],
  },
];
