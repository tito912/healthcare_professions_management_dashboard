import { Routes } from '@angular/router';
import { meseCorrente } from '@turni/domain';
import { guardiaAnonimo, guardiaAutenticato, guardiaRuolo } from './core/guardie';
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
        title: `${testi.segnaposto.nuovoReparto} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.nuovoReparto },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'reparti/:rid',
        pathMatch: 'full',
        redirectTo: ({ params }) => `/reparti/${params['rid'] ?? ''}/mesi/${meseCorrente()}`,
      },
      {
        path: 'reparti/:rid/mesi/:chiaveMese',
        title: `${testi.reparto.sezioni.mesi} · ${testi.app.titolo}`,
        loadComponent: () =>
          import('./pagine/reparto/griglia-segnaposto').then((m) => m.GrigliaSegnaposto),
      },
      {
        path: 'reparti/:rid/configurazione',
        title: `${testi.segnaposto.configurazione} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.configurazione },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'reparti/:rid/dipendenti',
        title: `${testi.segnaposto.dipendenti} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.dipendenti },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'reparti/:rid/banca-ore',
        title: `${testi.segnaposto.bancaOre} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.bancaOre },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'reparti/:rid/report',
        title: `${testi.segnaposto.report} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.report },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'report',
        canActivate: [guardiaRuolo('ADMIN')],
        title: `${testi.segnaposto.reportTutti} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.reportTutti },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
      },
      {
        path: 'registro',
        title: `${testi.segnaposto.registro} · ${testi.app.titolo}`,
        data: { titolo: testi.segnaposto.registro },
        loadComponent: () => import('./pagine/reparto/segnaposto-rotta').then((m) => m.SegnapostoRotta),
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
