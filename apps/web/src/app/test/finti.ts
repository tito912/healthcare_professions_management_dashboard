// Doppioni di prova dei servizi dell'applicazione: solo per i test (esclusi dal build, vedi tsconfig.app.json).
import { computed, signal } from '@angular/core';
import type { Ruolo } from '@turni/domain';
import { vi } from 'vitest';
import type { RepartoSintesi } from '../dati/reparti.repo';
import type { UtenteElenco } from '../dati/utenti.repo';
import type { StatoElenco } from '../dati/elenco-reparti';
import type { MotivoUscita, UtenteSessione } from '../core/sessione.service';

export function utenteDiProva(ruolo: Ruolo, uid = 'u1'): UtenteSessione {
  return { uid, nome: 'Maria', cognome: 'Rossi', ruolo };
}

/** Sessione finta: stessi nomi del servizio vero, stato impostabile dal test. */
export function sessioneFinta(ruolo: Ruolo | null) {
  const utente = signal<UtenteSessione | null>(ruolo === null ? null : utenteDiProva(ruolo));
  const motivoUscita = signal<MotivoUscita | null>(null);
  return {
    utente: utente.asReadonly(),
    impostaUtente: (valore: UtenteSessione | null): void => utente.set(valore),
    ruolo: computed(() => utente()?.ruolo ?? null),
    nomeCompleto: computed(() => {
      const u = utente();
      return u ? `${u.nome} ${u.cognome}` : '';
    }),
    motivoUscita: motivoUscita.asReadonly(),
    impostaMotivoUscita: (valore: MotivoUscita | null): void => motivoUscita.set(valore),
    pronta: vi.fn(() => Promise.resolve()),
    esci: vi.fn((_motivo?: MotivoUscita | null) => Promise.resolve()),
    accedi: vi.fn(),
    inviaLinkReimpostazione: vi.fn(),
  };
}

export function repartoDiProva(
  id: string,
  nome: string,
  coordinatoreUid = 'u1',
  passo: RepartoSintesi['passo'] = 'completata',
): RepartoSintesi {
  return { id, nome, coordinatoreUid, passo };
}

export function coordinatoreDiProva(
  uid: string,
  nome: string,
  cognome: string,
  attivo = true,
): UtenteElenco {
  return { uid, nome, cognome, email: `${nome.toLowerCase()}@esempio.it`, ruolo: 'COORDINATORE', attivo };
}

/** Elenco dei reparti finto. */
export function elencoFinto(reparti: readonly RepartoSintesi[], utenti: readonly UtenteElenco[] = []) {
  const _reparti = signal(reparti);
  const _utenti = signal(utenti);
  const _stato = signal<StatoElenco>('pronto');
  return {
    reparti: _reparti.asReadonly(),
    utenti: _utenti.asReadonly(),
    stato: _stato.asReadonly(),
    impostaStato: (s: StatoElenco): void => _stato.set(s),
    utentePerUid: computed(() => new Map(_utenti().map((u) => [u.uid, u]))),
    carica: vi.fn(() => Promise.resolve()),
    azzera: vi.fn(),
  };
}
