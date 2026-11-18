// Atterraggio dopo l'accesso (U1, UX §2). Funzione pura: riceve tutto ciò che serve e restituisce la rotta.
import type { Ruolo } from '@turni/domain';

export type PassoConfigurazione = 'turni' | 'dipendenti' | 'completata';

export interface RepartoPerAtterraggio {
  readonly id: string;
  readonly passo: PassoConfigurazione;
}

export interface InputAtterraggio {
  readonly ruolo: Ruolo;
  /** Rotta protetta da cui era partito l'accesso, già validata (vedi `rottaRichiestaValida`). */
  readonly rottaRichiesta: string | null;
  /** Reparti del coordinatore (vuoto per l'ADMIN). */
  readonly reparti: readonly RepartoPerAtterraggio[];
  /** Ultimo reparto usato, memorizzato in questo browser. */
  readonly ultimoRepartoId: string | null;
  /** 'AAAA-MM' del mese corrente. */
  readonly meseCorrente: string;
}

/** Rotta di un reparto: passo corrente della creazione guidata, oppure la griglia del mese corrente. */
export function rottaDelReparto(reparto: RepartoPerAtterraggio, meseCorrente: string): string {
  switch (reparto.passo) {
    case 'turni':
      return `/reparti/${reparto.id}/configurazione`;
    case 'dipendenti':
      return `/reparti/${reparto.id}/dipendenti`;
    case 'completata':
      return `/reparti/${reparto.id}/mesi/${meseCorrente}`;
  }
}

export function rottaDiAtterraggio(input: InputAtterraggio): string {
  // 1. ritorno alla rotta richiesta
  if (input.rottaRichiesta !== null) {
    return input.rottaRichiesta;
  }
  // 2. ADMIN → Home
  if (input.ruolo === 'ADMIN') {
    return '/home';
  }
  // 3. COORD senza reparti → Home (stato vuoto)
  if (input.reparti.length === 0) {
    return '/home';
  }
  // 4-5. ultimo reparto usato, oppure l'unico reparto
  const candidato =
    input.reparti.find((reparto) => reparto.id === input.ultimoRepartoId) ??
    (input.reparti.length === 1 ? input.reparti[0] : undefined);
  // 6. più reparti e nessun ultimo reparto memorizzato → Home
  if (candidato === undefined) {
    return '/home';
  }
  return rottaDelReparto(candidato, input.meseCorrente);
}

/**
 * La rotta a cui tornare dopo l'accesso viene dall'URL: si accetta solo un percorso interno
 * ('/…', non '//…' né un indirizzo esterno) che non sia la pagina di accesso stessa.
 */
export function rottaRichiestaValida(valore: string | null | undefined): string | null {
  if (typeof valore !== 'string' || !valore.startsWith('/') || valore.startsWith('//')) {
    return null;
  }
  if (valore.includes('\\') || [...valore].some((c) => c.charCodeAt(0) < 32)) {
    return null;
  }
  const percorso = valore.split(/[?#]/, 1)[0] ?? '';
  if (percorso === '/accesso' || percorso === '/') {
    return null;
  }
  return valore;
}
