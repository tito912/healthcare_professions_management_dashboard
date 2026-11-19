// Client tipizzato delle callable del report (ARCHITETTURA §8). L'input si valida con gli stessi schemi zod del server.
import { Injectable } from '@angular/core';
import { httpsCallable } from 'firebase/functions';
import {
  schemaGeneraReportInput,
  schemaInviaReportInput,
  type GeneraReportInput,
  type GeneraReportOutput,
  type InviaReportInput,
  type InviaReportOutput,
} from '@turni/domain';
import { serviziFirebase } from '../core/firebase';

@Injectable({ providedIn: 'root' })
export class FunzioniReport {
  /** Calcola il report, genera il file del reparto e lo restituisce in base64 (coordinatore del reparto o ADMIN). */
  async genera(input: GeneraReportInput): Promise<GeneraReportOutput> {
    const dati = schemaGeneraReportInput.parse(input);
    const chiamata = httpsCallable<GeneraReportInput, GeneraReportOutput>(
      serviziFirebase().funzioni,
      'generaReport',
    );
    return (await chiamata(dati)).data;
  }

  /** Accoda le email del report (solo il coordinatore); con `anteprima` dice chi le riceverebbe, senza scrivere. */
  async invia(input: InviaReportInput): Promise<InviaReportOutput> {
    const dati = schemaInviaReportInput.parse(input);
    const chiamata = httpsCallable<InviaReportInput, InviaReportOutput>(
      serviziFirebase().funzioni,
      'inviaReport',
    );
    return (await chiamata(dati)).data;
  }

  /** Avvia il download di un file Excel dal contenuto in base64 (un metodo del servizio: i test lo sostituiscono). */
  scarica(nomeFile: string, contenutoBase64: string): void {
    scaricaExcel(nomeFile, contenutoBase64);
  }
}

/** Avvia il download di un file Excel dal contenuto in base64 (solo nel browser). */
export function scaricaExcel(nomeFile: string, contenutoBase64: string): void {
  const binario = atob(contenutoBase64);
  const byte = Uint8Array.from(binario, (carattere) => carattere.charCodeAt(0));
  const blob = new Blob([byte], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const indirizzo = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = indirizzo;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(indirizzo);
}
