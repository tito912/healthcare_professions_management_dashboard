// Client tipizzati delle callable di gestione utenti (ARCHITETTURA §8). L'input si valida con gli stessi
// schemi zod del server (packages/domain/src/contratti), così gli errori arrivano al campo prima dell'invio.
import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import {
  schemaAssegnaRepartoInput,
  schemaCreaCoordinatoreInput,
  schemaImpostaStatoUtenteInput,
  type AssegnaRepartoInput,
  type AssegnaRepartoOutput,
  type CreaCoordinatoreInput,
  type CreaCoordinatoreOutput,
  type ImpostaStatoUtenteInput,
  type ImpostaStatoUtenteOutput,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

@Injectable({ providedIn: 'root' })
export class FunzioniUtenti {
  async creaCoordinatore(input: CreaCoordinatoreInput): Promise<CreaCoordinatoreOutput> {
    const dati = schemaCreaCoordinatoreInput.parse(input);
    const chiamata = httpsCallable<CreaCoordinatoreInput, CreaCoordinatoreOutput>(
      serviziFirebase().funzioni,
      'creaCoordinatore',
    );
    return (await chiamata(dati)).data;
  }

  async impostaStatoUtente(input: ImpostaStatoUtenteInput): Promise<ImpostaStatoUtenteOutput> {
    const dati = schemaImpostaStatoUtenteInput.parse(input);
    const chiamata = httpsCallable<ImpostaStatoUtenteInput, ImpostaStatoUtenteOutput>(
      serviziFirebase().funzioni,
      'impostaStatoUtente',
    );
    return (await chiamata(dati)).data;
  }

  async assegnaReparto(input: AssegnaRepartoInput): Promise<AssegnaRepartoOutput> {
    const dati = schemaAssegnaRepartoInput.parse(input);
    const chiamata = httpsCallable<AssegnaRepartoInput, AssegnaRepartoOutput>(
      serviziFirebase().funzioni,
      'assegnaReparto',
    );
    return (await chiamata(dati)).data;
  }
}
