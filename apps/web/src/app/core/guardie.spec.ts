import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Ruolo } from '@turni/domain';
import { sessioneFinta } from '../test/finti';
import { guardiaAnonimo, guardiaAutenticato, guardiaRuolo } from './guardie';
import { Sessione } from './sessione.service';

@Component({ template: 'pagina' })
class Pagina {}

// Stessa struttura di app.routes.ts: accesso per gli anonimi, area protetta, rotte solo ADMIN o solo COORD.
const rotte: Routes = [
  { path: 'accesso', canActivate: [guardiaAnonimo], component: Pagina },
  {
    path: '',
    canActivate: [guardiaAutenticato],
    children: [
      { path: 'home', component: Pagina },
      { path: 'utenti', canActivate: [guardiaRuolo('ADMIN')], component: Pagina },
      { path: 'report', canActivate: [guardiaRuolo('ADMIN')], component: Pagina },
      { path: 'reparti/nuovo', canActivate: [guardiaRuolo('COORDINATORE')], component: Pagina },
      { path: 'reparti/:rid/mesi/:mese', component: Pagina },
    ],
  },
];

async function naviga(ruolo: Ruolo | null, url: string) {
  TestBed.resetTestingModule();
  const sessione = sessioneFinta(ruolo);
  TestBed.configureTestingModule({
    providers: [provideRouter(rotte), { provide: Sessione, useValue: sessione }],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return { url: TestBed.inject(Router).url, sessione };
}

describe('guardie di rotta', () => {
  describe('anonimo', () => {
    it.each(['/home', '/utenti', '/report', '/reparti/nuovo', '/reparti/r1/mesi/2026-11'])(
      'su %s va all’accesso con la rotta richiesta',
      async (richiesta) => {
        const { url } = await naviga(null, richiesta);
        expect(url).toBe(`/accesso?ritorno=${encodeURIComponent(richiesta)}`);
      },
    );

    it('può aprire l’accesso', async () => {
      expect((await naviga(null, '/accesso')).url).toBe('/accesso');
    });

    it('attende che la sessione sia pronta prima di decidere', async () => {
      const { sessione } = await naviga(null, '/utenti');
      expect(sessione.pronta).toHaveBeenCalled();
    });
  });

  describe('COORDINATORE', () => {
    it('è respinto da /utenti e da /report (solo ADMIN): torna alla Home', async () => {
      expect((await naviga('COORDINATORE', '/utenti')).url).toBe('/home');
      expect((await naviga('COORDINATORE', '/report')).url).toBe('/home');
    });

    it('entra nelle sue rotte', async () => {
      expect((await naviga('COORDINATORE', '/home')).url).toBe('/home');
      expect((await naviga('COORDINATORE', '/reparti/nuovo')).url).toBe('/reparti/nuovo');
      expect((await naviga('COORDINATORE', '/reparti/r1/mesi/2026-11')).url).toBe(
        '/reparti/r1/mesi/2026-11',
      );
    });

    it('non vede l’accesso: è già dentro', async () => {
      expect((await naviga('COORDINATORE', '/accesso')).url).toBe('/home');
    });
  });

  describe('ADMIN', () => {
    it('entra in /utenti e /report', async () => {
      expect((await naviga('ADMIN', '/utenti')).url).toBe('/utenti');
      expect((await naviga('ADMIN', '/report')).url).toBe('/report');
    });

    it('è respinto dalle rotte solo COORD (creazione di un reparto)', async () => {
      expect((await naviga('ADMIN', '/reparti/nuovo')).url).toBe('/home');
    });
  });
});
