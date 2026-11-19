// Trigger `aggiornaRiepilogo` (ARCHITETTURA §8): a ogni scrittura di una riga ricalcola il riepilogo di quel
// dipendente per il mese della riga e per i due mesi adiacenti, se esistono, poi la banca ore dell'anno della riga
// (con il riporto agli anni successivi, `banca-ore.ts`) e annota nel registro le modifiche di consuntivo
// (`registro-consuntivo.ts`). Idempotente (vedi `ricalcolo.ts`), quindi sicuro con la riconsegna dell'evento
// (`retry: true`). Scrive solo documenti derivati e voci di registro: non tocca mai le righe (D2). Errori di dati: nessun rilancio (le righe non valide diventano `riga.nonValida`, il calcolo non lancia);
// errori transitori di Firestore: rilancio, l'evento è ritentato.
import { eChiaveMese, modificheConsuntivo, type RiepilogoCalcolato } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { rifReparto } from '../comune/admin';
import { datiErroreSicuri } from '../comune/errori';
import { voceRegistro } from '../comune/registro';
import { annoDi, ricalcolaBancaOre } from './banca-ore';
import { registraConsuntivo } from './registro-consuntivo';
import { mesiInteressati, ricalcolaRiepilogo } from './ricalcolo';

const CODICE_GIA_ESISTENTE = 6;

export const aggiornaRiepilogo = onDocumentWritten(
  { document: 'reparti/{repartoId}/mesi/{chiaveMese}/righe/{dipendenteId}', retry: true },
  async (evento) => {
    const { repartoId, chiaveMese, dipendenteId } = evento.params;
    if (!eChiaveMese(chiaveMese)) {
      logger.warn('Riga in un mese con chiave non valida', { repartoId });
      return;
    }
    let propria: RiepilogoCalcolato | null;
    try {
      const calcolati = await Promise.all(
        mesiInteressati(chiaveMese).map((mese) =>
          ricalcolaRiepilogo(repartoId, dipendenteId, mese),
        ),
      );
      propria = calcolati[1] ?? null;
      // Le ore dei mesi adiacenti non dipendono da questa riga (solo i loro avvisi): basta l'anno del mese toccato.
      await ricalcolaBancaOre(repartoId, dipendenteId, annoDi(chiaveMese));
    } catch (e) {
      logger.error('Ricalcolo del riepilogo non riuscito', {
        repartoId,
        chiaveMese,
        dipendenteId,
        ...datiErroreSicuri(e),
      });
      throw e;
    }
    const dopo = evento.data?.after;
    if (propria !== null && !propria.valida && dopo?.exists === true) {
      await registraRigaNonValida(evento.id, repartoId, propria);
    }
    if (dopo?.exists === true) {
      const prima = evento.data?.before;
      const autore: unknown = dopo.get('aggiornatoDa');
      const versione: unknown = dopo.get('versione');
      await registraConsuntivo(
        {
          idEvento: evento.id,
          repartoId,
          chiaveMese,
          dipendenteId,
          autoreUid: typeof autore === 'string' ? autore : null,
          versione:
            typeof versione === 'number' && Number.isSafeInteger(versione) ? versione : null,
        },
        modificheConsuntivo(
          chiaveMese,
          prima?.exists === true ? prima.get('giorni') : undefined,
          dopo.get('giorni'),
        ),
      );
    }
    logger.info('Riepilogo aggiornato', { repartoId, chiaveMese, dipendenteId });
  },
);

/** Voce `riga.nonValida` con ID dell'evento: una riconsegna non la duplica. Solo codici, mai testi. */
async function registraRigaNonValida(
  idEvento: string,
  repartoId: string,
  riepilogo: RiepilogoCalcolato,
): Promise<void> {
  try {
    await rifReparto(repartoId)
      .collection('registroAttivita')
      .doc(idEvento)
      .create(
        voceRegistro(null, {
          tipo: 'riga.nonValida',
          repartoId,
          chiaveMese: riepilogo.chiaveMese,
          dipendenteId: riepilogo.dipendenteId,
          dettagli: { codici: riepilogo.erroriValidazione.join(',') },
        }),
      );
  } catch (e) {
    // Già scritta da una consegna precedente dello stesso evento: va bene.
    if (datiErroreSicuri(e).codiceNumerico !== CODICE_GIA_ESISTENTE) {
      throw e;
    }
  }
}
