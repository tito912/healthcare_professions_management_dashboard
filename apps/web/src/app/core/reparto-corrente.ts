import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ElencoReparti } from '../dati/elenco-reparti';
import { ContestoRoute } from './contesto-route';
import { Preferenze } from './preferenze.service';
import { Sessione } from './sessione.service';

/**
 * Il «reparto corrente» di menu e percorso: quello dell'URL; fuori da un reparto l'ultimo usato in questo
 * browser (se esiste ancora), altrimenti l'unico reparto dell'utente. L'ultimo usato si ricorda per utente.
 */
@Injectable({ providedIn: 'root' })
export class RepartoCorrente {
  private readonly contesto = inject(ContestoRoute);
  private readonly elenco = inject(ElencoReparti);
  private readonly preferenze = inject(Preferenze);
  private readonly sessione = inject(Sessione);

  private readonly ultimoUsato = signal<string | null>(null);

  readonly id = computed<string | null>(() => {
    const reparti = this.elenco.reparti();
    const dallUrl = this.contesto.repartoId();
    if (dallUrl !== null) {
      return dallUrl;
    }
    const ultimo = this.ultimoUsato();
    if (ultimo !== null && reparti.some((reparto) => reparto.id === ultimo)) {
      return ultimo;
    }
    return reparti.length === 1 ? (reparti[0]?.id ?? null) : null;
  });

  readonly reparto = computed(() => {
    const id = this.id();
    return id === null
      ? null
      : (this.elenco.reparti().find((reparto) => reparto.id === id) ?? null);
  });

  constructor() {
    effect(() => {
      const utente = this.sessione.utente();
      this.ultimoUsato.set(utente ? this.preferenze.leggi(utente.uid).ultimoRepartoId : null);
    });
    effect(() => {
      const utente = this.sessione.utente();
      const id = this.contesto.repartoId();
      if (utente !== null && id !== null) {
        // Si memorizza solo un reparto che l'utente vede davvero (un ID digitato a mano non conta).
        if (this.elenco.reparti().some((reparto) => reparto.id === id)) {
          this.preferenze.imposta(utente.uid, { ultimoRepartoId: id });
          this.ultimoUsato.set(id);
        }
      }
    });
  }
}
