// Tutte le segnalazioni di una riga, per il pannello Avvisi (UX §9.6) e per `numeroAvvisi` del riepilogo (§5.10).
// Usa la riga del mese e, per il riposo a cavallo di mese, le righe dello stesso dipendente nei mesi adiacenti.
import { chiaveMeseDi, dataDelGiorno, eChiaveGiorno, spostaMese } from '../calendario/mesi';
import type { CellaDoc } from '../documenti';
import { cellaValida, validaRiga, type RigaDaValidare } from '../griglia/valida-riga';
import type { ChiaveGiorno, ChiaveMese, CodiceTurno } from '../tipi';
import { giorniDaRighe } from './giorni-riga';
import { contaComeAvviso, type Segnalazione, type SegnalazioneRiga } from './livelli';
import {
  avvisiSovrapposizione,
  avvisoReperibilitaMese,
  minutiReperibilitaMese,
} from './reperibilita';
import { avvisiRiposo } from './riposo';

export interface ContestoAvvisiRiga {
  readonly chiaveMese: ChiaveMese;
  /** Turni e fasce esclusi oggi dal documento del dipendente (cambiano senza che la riga cambi). */
  readonly turniEsclusi: readonly CodiceTurno[];
  /** Le mappe `giorni` delle righe dello stesso dipendente nel mese prima e dopo, o null se non esistono. */
  readonly righeAdiacenti: {
    readonly precedente: Readonly<Record<string, unknown>> | null;
    readonly successiva: Readonly<Record<string, unknown>> | null;
  };
}

/** Le sole celle valide (giorno del mese e forma corretta): le altre sono già blocchi di `validaRiga()`. */
function celleValide(
  chiave: ChiaveMese,
  giorni: Readonly<Record<string, unknown>> | null,
): Partial<Record<ChiaveGiorno, CellaDoc>> {
  const valide: Partial<Record<ChiaveGiorno, CellaDoc>> = {};
  for (const [giorno, valore] of Object.entries(giorni ?? {})) {
    const cella = cellaValida(valore);
    if (eChiaveGiorno(giorno) && dataDelGiorno(chiave, giorno) !== null && cella !== null) {
      valide[giorno] = cella;
    }
  }
  return valide;
}

/**
 * Segnalazioni della riga, in ordine di giorno (quelle senza giorno in fondo):
 * - blocchi e avvisi di `validaRiga()`;
 * - riposo sotto le 11 ore in cui almeno uno dei due giorni è nel mese (anche col mese prima o dopo);
 * - reperibilità oltre 7 unità e reperibilità sovrapposte a un turno;
 * - turno o fascia tra gli esclusi, turno scoperto, reperibilità scoperta.
 */
export function avvisiRiga(riga: RigaDaValidare, contesto: ContestoAvvisiRiga): Segnalazione[] {
  const { chiaveMese } = contesto;
  const segnalazioni: Segnalazione[] = validaRiga(riga, { chiaveMese }).map(
    (problema): SegnalazioneRiga => ({
      livello: problema.livello,
      codice: problema.codice,
      giorno:
        problema.chiaveGiorno !== null && eChiaveGiorno(problema.chiaveGiorno)
          ? dataDelGiorno(chiaveMese, problema.chiaveGiorno)
          : null,
      chiaveGiorno: problema.chiaveGiorno,
    }),
  );
  const delMese = celleValide(chiaveMese, riga.giorni);
  const precedente = spostaMese(chiaveMese, -1);
  const successivo = spostaMese(chiaveMese, 1);
  const tutti = giorniDaRighe([
    { chiaveMese: precedente, giorni: celleValide(precedente, contesto.righeAdiacenti.precedente) },
    { chiaveMese, giorni: delMese },
    { chiaveMese: successivo, giorni: celleValide(successivo, contesto.righeAdiacenti.successiva) },
  ]);
  const nelMese = (data: string): boolean => data.startsWith(`${chiaveMese}-`);

  segnalazioni.push(
    ...avvisiRiposo(tutti).filter((a) => nelMese(a.giorno) || nelMese(a.giornoPrecedente)),
    ...avvisiSovrapposizione(tutti).filter((a) => nelMese(a.giorno)),
  );
  for (const { giorno, cella } of tutti.filter((g) => chiaveMeseDi(g.giorno) === chiaveMese)) {
    const codiciEsclusi = [cella.turno?.codice, ...cella.reperibilita.map((r) => r.codice)].filter(
      (codice): codice is CodiceTurno =>
        codice !== undefined && contesto.turniEsclusi.includes(codice),
    );
    for (const codiceTurno of codiciEsclusi) {
      segnalazioni.push({
        livello: 'avviso',
        codice: 'turnoEsclusoAssegnato',
        giorno,
        codiceTurno,
      });
    }
    if (cella.turno !== null && cella.assenza !== null && cella.copertoDa === null) {
      segnalazioni.push({
        livello: 'avviso',
        codice: 'turnoScoperto',
        giorno,
        codiceTurno: cella.turno.codice,
        codiceAssenza: cella.assenza.codice,
      });
    }
    if (cella.assenza?.effetto === 'neutra') {
      for (const reperibilita of cella.reperibilita.filter((r) => r.copertaDa === null)) {
        segnalazioni.push({
          livello: 'avviso',
          codice: 'reperibilitaScoperta',
          giorno,
          codiceReperibilita: reperibilita.codice,
          codiceAssenza: cella.assenza.codice,
        });
      }
    }
  }
  const oltreLimite = avvisoReperibilitaMese(minutiReperibilitaMese(chiaveMese, delMese));
  if (oltreLimite !== null) {
    segnalazioni.push(oltreLimite);
  }
  // Ordine di giorno, stabile; le segnalazioni senza giorno (giorno inesistente, unità del mese) in fondo.
  const chiave = (s: Segnalazione): string => s.giorno ?? '~'; // '~' segue le cifre nell'ordine dei caratteri
  const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return segnalazioni
    .map((segnalazione, indice) => ({ segnalazione, indice }))
    .sort(
      (a, b) => confronta(chiave(a.segnalazione), chiave(b.segnalazione)) || a.indice - b.indice,
    )
    .map(({ segnalazione }) => segnalazione);
}

/** Blocchi e avvisi (non le note): il numero del pulsante «Avvisi» e di `numeroAvvisi`. */
export function contaAvvisi(segnalazioni: readonly Segnalazione[]): number {
  return segnalazioni.filter(contaComeAvviso).length;
}
