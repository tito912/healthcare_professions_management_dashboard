import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import type { Ruolo } from '@turni/domain';
import { Sessione } from './sessione.service';

/** Rotta di accesso con, se serve, la rotta da riprendere dopo l'accesso. */
function versoAccesso(router: Router, urlRichiesto: string): UrlTree {
  const queryParams = urlRichiesto === '/' || urlRichiesto === '' ? {} : { ritorno: urlRichiesto };
  return router.createUrlTree(['/accesso'], { queryParams });
}

/** Solo utenti autenticati; gli anonimi vanno all'accesso e poi tornano alla rotta richiesta. */
export const guardiaAutenticato: CanActivateFn = async (_rotta, stato) => {
  const sessione = inject(Sessione);
  const router = inject(Router);
  await sessione.pronta();
  return sessione.utente() !== null ? true : versoAccesso(router, stato.url);
};

/**
 * Solo i ruoli indicati. Un anonimo va all'accesso; un utente con un altro ruolo torna alla Home,
 * senza dire se la rotta esiste.
 */
export function guardiaRuolo(...ruoliAmmessi: readonly Ruolo[]): CanActivateFn {
  return async (_rotta, stato) => {
    const sessione = inject(Sessione);
    const router = inject(Router);
    await sessione.pronta();
    const utente = sessione.utente();
    if (utente === null) {
      return versoAccesso(router, stato.url);
    }
    return ruoliAmmessi.includes(utente.ruolo) ? true : router.createUrlTree(['/home']);
  };
}

/** Solo per chi non è autenticato (schermata di accesso): chi è già dentro va alla Home. */
export const guardiaAnonimo: CanActivateFn = async () => {
  const sessione = inject(Sessione);
  const router = inject(Router);
  await sessione.pronta();
  return sessione.utente() === null ? true : router.createUrlTree(['/home']);
};
