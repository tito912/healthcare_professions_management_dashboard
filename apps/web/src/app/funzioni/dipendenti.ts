// Client tipizzati delle callable dell'anagrafica (ARCHITETTURA §8). L'input si valida con gli stessi schemi
// zod del server (packages/domain/src/contratti); codice fiscale ed email hanno il loro errore dal server.
import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import {
  schemaLeggiDatiPrivatiInput,
  schemaSalvaDipendenteInput,
  type LeggiDatiPrivatiInput,
  type LeggiDatiPrivatiOutput,
  type SalvaDipendenteInput,
  type SalvaDipendenteOutput,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

@Injectable({ providedIn: 'root' })
export class FunzioniDipendenti {
  async salva(input: SalvaDipendenteInput): Promise<SalvaDipendenteOutput> {
    const dati = schemaSalvaDipendenteInput.parse(input);
    const chiamata = httpsCallable<SalvaDipendenteInput, SalvaDipendenteOutput>(
      serviziFirebase().funzioni,
      'salvaDipendente',
    );
    return (await chiamata(dati)).data;
  }

  /** Chiede in chiaro codice fiscale, data di nascita ed email: ogni lettura è registrata dal server. */
  async leggiDatiPrivati(input: LeggiDatiPrivatiInput): Promise<LeggiDatiPrivatiOutput> {
    const dati = schemaLeggiDatiPrivatiInput.parse(input);
    const chiamata = httpsCallable<LeggiDatiPrivatiInput, LeggiDatiPrivatiOutput>(
      serviziFirebase().funzioni,
      'leggiDatiPrivati',
    );
    return (await chiamata(dati)).data;
  }
}
