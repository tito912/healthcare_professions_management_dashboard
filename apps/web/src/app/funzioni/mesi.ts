// Client tipizzato della callable dei mesi (ARCHITETTURA §8). L'input si valida con lo stesso schema zod del server.
import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import {
  schemaConvalidaMeseInput,
  type ConvalidaMeseInput,
  type ConvalidaMeseOutput,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

@Injectable({ providedIn: 'root' })
export class FunzioniMesi {
  /** Convalida il mese (D1, D2): dopo, il mese è in sola lettura totale. */
  async convalida(input: ConvalidaMeseInput): Promise<ConvalidaMeseOutput> {
    const dati = schemaConvalidaMeseInput.parse(input);
    const chiamata = httpsCallable<ConvalidaMeseInput, ConvalidaMeseOutput>(
      serviziFirebase().funzioni,
      'convalidaMese',
    );
    return (await chiamata(dati)).data;
  }
}
