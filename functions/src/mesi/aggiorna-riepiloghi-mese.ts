// Trigger `aggiornaRiepiloghiMese` (ARCHITETTURA §8): se di un mese cambiano `stato` o `calendario`, ricalcola
// i riepiloghi di tutte le sue righe (lo stato dei riepiloghi segue quello del mese; il calendario cambia
// festività e categorie). Con la convalida ogni riepilogo diventa `statoMese: 'convalidato'`. Il passaggio da
// convalidato a bozza (riapertura a mano sulla console, D18) lascia la voce `mese.riaperto` e ricalcola.
// Non modifica mai le righe (D2).
import { eChiaveMese } from '@turni/domain';
import * as logger from 'firebase-functions/logger';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { rifReparto } from '../comune/admin';
import { datiErroreSicuri } from '../comune/errori';
import { voceRegistro } from '../comune/registro';
import { rifRighe } from './rif';
import { ricalcolaRiepilogo } from './ricalcolo';

const CODICE_GIA_ESISTENTE = 6;
/** Riepiloghi ricalcolati insieme: le transazioni sono indipendenti (documenti diversi). */
const RICALCOLI_IN_PARALLELO = 10;

/** Confronto di due valori di Firestore indipendente dall'ordine delle chiavi. */
function normalizza(valore: unknown): unknown {
  if (Array.isArray(valore)) {
    return valore.map(normalizza);
  }
  if (typeof valore === 'object' && valore !== null) {
    return Object.fromEntries(
      Object.entries(valore)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chiave, v]) => [chiave, normalizza(v)]),
    );
  }
  return valore;
}

export function stessiDati(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizza(a)) === JSON.stringify(normalizza(b));
}

export const aggiornaRiepiloghiMese = onDocumentUpdated(
  { document: 'reparti/{repartoId}/mesi/{chiaveMese}', retry: true },
  async (evento) => {
    const { repartoId, chiaveMese } = evento.params;
    const prima = evento.data?.before;
    const dopo = evento.data?.after;
    if (!eChiaveMese(chiaveMese) || prima === undefined || dopo === undefined) {
      return;
    }
    const statoCambiato = prima.get('stato') !== dopo.get('stato');
    if (!statoCambiato && stessiDati(prima.get('calendario'), dopo.get('calendario'))) {
      return;
    }
    if (prima.get('stato') === 'convalidato' && dopo.get('stato') === 'bozza') {
      await registraRiapertura(evento.id, repartoId, chiaveMese);
    }
    const righe = await rifRighe(repartoId, chiaveMese).select().get();
    const ids = righe.docs.map((riga) => riga.id);
    let falliti = 0;
    for (let i = 0; i < ids.length; i += RICALCOLI_IN_PARALLELO) {
      const esiti = await Promise.allSettled(
        ids
          .slice(i, i + RICALCOLI_IN_PARALLELO)
          .map((dipendenteId) => ricalcolaRiepilogo(repartoId, dipendenteId, chiaveMese)),
      );
      for (const esito of esiti) {
        if (esito.status === 'rejected') {
          falliti += 1;
          logger.error('Ricalcolo del riepilogo non riuscito', {
            repartoId,
            chiaveMese,
            ...datiErroreSicuri(esito.reason),
          });
        }
      }
    }
    if (falliti > 0) {
      // Errore transitorio: l'evento è ritentato e il ricalcolo è idempotente.
      throw new Error(`Ricalcolo non riuscito per ${falliti} righe`);
    }
    logger.info('Riepiloghi del mese aggiornati', { repartoId, chiaveMese, righe: ids.length });
  },
);

async function registraRiapertura(
  idEvento: string,
  repartoId: string,
  chiaveMese: string,
): Promise<void> {
  if (!eChiaveMese(chiaveMese)) {
    return;
  }
  try {
    await rifReparto(repartoId)
      .collection('registroAttivita')
      .doc(idEvento)
      .create(
        voceRegistro(null, {
          tipo: 'mese.riaperto',
          repartoId,
          chiaveMese,
          dettagli: { origine: 'database' },
        }),
      );
  } catch (e) {
    if (datiErroreSicuri(e).codiceNumerico !== CODICE_GIA_ESISTENTE) {
      throw e;
    }
  }
}
