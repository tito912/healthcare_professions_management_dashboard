// Voci `consuntivo.modificato` del registro attività (ARCHITETTURA §5.13, PIANO 3.1b criterio 3). Il browser salva le
// righe direttamente (D2: nessuna callable di variazione), quindi le voci le scrive il trigger `aggiornaRiepilogo`
// confrontando la riga prima e dopo con `modificheConsuntivo()` del dominio. Una voce per ogni campo cambiato di ogni
// giorno, con ID `{evento}_{n}` deterministico: un evento riconsegnato non duplica nulla. L'autore è l'uid in
// `aggiornatoDa` (chi ha salvato) e non ha il nome; `dettagli` contiene solo giorno, campo, valori prima e dopo
// (codici, orari, ID di dipendenti) e versione della riga: nessun nome, nessun dato oltre a quelli della griglia.
import type { ChiaveMese, DifferenzaConsuntivo } from '@turni/domain';
import { db, rifReparto } from '../comune/admin';
import { datiErroreSicuri } from '../comune/errori';
import { voceRegistro } from '../comune/registro';

const CODICE_GIA_ESISTENTE = 6;

export interface ContestoVoceConsuntivo {
  readonly idEvento: string;
  readonly repartoId: string;
  readonly chiaveMese: ChiaveMese;
  readonly dipendenteId: string;
  /** `aggiornatoDa` della riga dopo la modifica; null se manca (il documento non l'ha). */
  readonly autoreUid: string | null;
  readonly versione: number | null;
}

/** ID della n-esima voce di un evento. */
function idVoceConsuntivo(idEvento: string, indice: number): string {
  return `${idEvento}_${indice}`;
}

/** Scrive le voci in un solo batch; se esistono già (riconsegna dell'evento) non fa nulla. */
export async function registraConsuntivo(
  contesto: ContestoVoceConsuntivo,
  modifiche: readonly DifferenzaConsuntivo[],
): Promise<void> {
  if (modifiche.length === 0) {
    return;
  }
  const raccolta = rifReparto(contesto.repartoId).collection('registroAttivita');
  const batch = db().batch();
  modifiche.forEach((modifica, indice) => {
    const base = voceRegistro(null, {
      tipo: 'consuntivo.modificato',
      repartoId: contesto.repartoId,
      chiaveMese: contesto.chiaveMese,
      dipendenteId: contesto.dipendenteId,
      dettagli: {
        giorno: modifica.giorno,
        campo: modifica.campo,
        prima: modifica.prima,
        dopo: modifica.dopo,
        versione: contesto.versione,
      },
    });
    batch.create(raccolta.doc(idVoceConsuntivo(contesto.idEvento, indice)), {
      ...base,
      autoreUid: contesto.autoreUid,
      autoreRuolo: contesto.autoreUid === null ? 'SISTEMA' : 'COORDINATORE',
    });
  });
  try {
    await batch.commit();
  } catch (e) {
    // Già scritte da una consegna precedente dello stesso evento: va bene.
    if (datiErroreSicuri(e).codiceNumerico !== CODICE_GIA_ESISTENTE) {
      throw e;
    }
  }
}
