// Righe di un mese: lettura e «Salva bozza» (ARCHITETTURA §5.9, §9). Come `mesi.firestore.ts`, le funzioni
// prendono `db` e si provano sull'emulatore.
import {
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  cellaValida,
  contrattoValido,
  MAX_RIGHE_PER_TRANSAZIONE,
  eChiaveGiorno,
  type CalendarioMese,
  type CellaDoc,
  type ChiaveGiorno,
  type ChiaveMese,
  type ContrattoRiga,
} from '@turni/domain';

/** Una riga come è salvata (senza istanti). Le celle non valide restano «grezze» e si riscrivono invariate. */
export interface RigaSalvata {
  readonly dipendenteId: string;
  readonly contratto: ContrattoRiga;
  readonly giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>;
  /** Celle che non hanno la forma di `CellaDoc` (dati non validi già salvati): blocco, non si toccano. */
  readonly grezzi: Readonly<Record<string, unknown>>;
  readonly versione: number;
}

/** Convertitore: una riga senza contratto valido, versione o mappa dei giorni non si apre (null). */
export function rigaDaDati(id: string, dati: DocumentData): RigaSalvata | null {
  const contratto = contrattoValido(dati['contratto']);
  const versione: unknown = dati['versione'];
  const giorni: unknown = dati['giorni'];
  if (
    contratto === null ||
    typeof versione !== 'number' ||
    typeof giorni !== 'object' ||
    giorni === null ||
    Array.isArray(giorni)
  ) {
    return null;
  }
  const valide: Partial<Record<ChiaveGiorno, CellaDoc>> = {};
  const grezzi: Record<string, unknown> = {};
  for (const [giorno, valore] of Object.entries(giorni)) {
    const cella = cellaValida(valore);
    if (eChiaveGiorno(giorno) && cella !== null) {
      valide[giorno] = cella;
    } else {
      grezzi[giorno] = valore;
    }
  }
  return { dipendenteId: id, contratto, giorni: valide, grezzi, versione };
}

/** Tutte le righe del mese (una lettura per riga; una query vuota costa comunque una lettura). */
export async function leggiRighe(
  db: Firestore,
  repartoId: string,
  chiave: ChiaveMese,
): Promise<RigaSalvata[]> {
  const risultato = await getDocs(collection(db, 'reparti', repartoId, 'mesi', chiave, 'righe'));
  return risultato.docs
    .map((documento) => rigaDaDati(documento.id, documento.data()))
    .filter((riga): riga is RigaSalvata => riga !== null);
}

/** Una riga da scrivere. `versioneCaricata` null = riga nuova (allineamento «dipendente nuovo»). */
export interface RigaDaSalvare {
  readonly dipendenteId: string;
  readonly contratto: ContrattoRiga;
  readonly giorni: Readonly<Partial<Record<ChiaveGiorno, CellaDoc>>>;
  readonly grezzi: Readonly<Record<string, unknown>>;
  readonly versioneCaricata: number | null;
}

export interface RichiestaSalvaRighe {
  readonly repartoId: string;
  readonly uid: string;
  readonly chiave: ChiaveMese;
  readonly righe: readonly RigaDaSalvare[];
  /** Calendario allineato (aggiorna il documento del mese); null = invariato. */
  readonly calendario: CalendarioMese | null;
}

/** `RESPINTO`: le Security Rules hanno negato la scrittura (mese convalidato nel frattempo, permessi cambiati). */
export type CodiceErroreSalvataggio =
  'MESE_CONVALIDATO' | 'CONFLITTO_VERSIONE' | 'MESE_ASSENTE' | 'RESPINTO';

function eRifiutoDelleRegole(errore: unknown): boolean {
  return (
    typeof errore === 'object' &&
    errore !== null &&
    'code' in errore &&
    errore.code === 'permission-denied'
  );
}

/** Esito di «Salva bozza» che la schermata distingue (UX §9.7): non contiene dati personali. */
export class ErroreSalvataggio extends Error {
  constructor(readonly codice: CodiceErroreSalvataggio) {
    super(codice);
    this.name = 'ErroreSalvataggio';
  }
}

/** Le versioni scritte, per riga, dopo il salvataggio. */
export type VersioniSalvate = ReadonlyMap<string, number>;

/**
 * «Salva bozza»: una transazione che legge il mese e le sole righe toccate, controlla che il mese sia ancora in
 * bozza e che la `versione` di ogni riga sia quella caricata, poi scrive le righe con `versione + 1` (e il
 * calendario del mese, se allineato). Con più di `MAX_RIGHE_PER_TRANSAZIONE` righe si divide in transazioni
 * successive; il calendario va con la prima.
 */
export async function salvaRighe(
  db: Firestore,
  richiesta: RichiestaSalvaRighe,
): Promise<VersioniSalvate> {
  const { repartoId, uid, chiave } = richiesta;
  const riferimentoMese = doc(db, 'reparti', repartoId, 'mesi', chiave);
  const versioni = new Map<string, number>();
  const blocchi: RigaDaSalvare[][] = [];
  for (let i = 0; i < richiesta.righe.length; i += MAX_RIGHE_PER_TRANSAZIONE) {
    blocchi.push(richiesta.righe.slice(i, i + MAX_RIGHE_PER_TRANSAZIONE));
  }
  if (blocchi.length === 0 && richiesta.calendario !== null) {
    blocchi.push([]);
  }
  for (const [indice, blocco] of blocchi.entries()) {
    const scritte = await runTransaction(db, async (transazione) => {
      const mese = await transazione.get(riferimentoMese);
      if (!mese.exists()) {
        throw new ErroreSalvataggio('MESE_ASSENTE');
      }
      if (mese.get('stato') !== 'bozza') {
        throw new ErroreSalvataggio('MESE_CONVALIDATO');
      }
      const esistenti = await Promise.all(
        blocco.map((riga) => transazione.get(doc(riferimentoMese, 'righe', riga.dipendenteId))),
      );
      const risultato = new Map<string, number>();
      blocco.forEach((riga, i) => {
        const attuale = esistenti[i];
        const riferimento = doc(riferimentoMese, 'righe', riga.dipendenteId);
        const giorni = { ...riga.grezzi, ...riga.giorni };
        if (riga.versioneCaricata === null) {
          if (attuale?.exists() === true) {
            throw new ErroreSalvataggio('CONFLITTO_VERSIONE');
          }
          transazione.set(riferimento, {
            dipendenteId: riga.dipendenteId,
            contratto: { ...riga.contratto },
            giorni,
            versione: 1,
            aggiornatoDa: uid,
            aggiornatoIl: serverTimestamp(),
          });
          risultato.set(riga.dipendenteId, 1);
          return;
        }
        if (attuale?.exists() !== true || attuale.get('versione') !== riga.versioneCaricata) {
          throw new ErroreSalvataggio('CONFLITTO_VERSIONE');
        }
        transazione.update(riferimento, {
          contratto: { ...riga.contratto },
          giorni,
          versione: riga.versioneCaricata + 1,
          aggiornatoDa: uid,
          aggiornatoIl: serverTimestamp(),
        });
        risultato.set(riga.dipendenteId, riga.versioneCaricata + 1);
      });
      if (indice === 0 && richiesta.calendario !== null) {
        transazione.update(riferimentoMese, {
          calendario: {
            festivita: richiesta.calendario.festivita,
            attribuzioneNotte: richiesta.calendario.attribuzioneNotte,
          },
          aggiornatoIl: serverTimestamp(),
          aggiornatoDa: uid,
        });
      }
      return risultato;
    }).catch((errore: unknown) => {
      // Le regole negano la scrittura (mese convalidato o permessi cambiati nel frattempo): messaggio chiaro, non un generico «riprova».
      throw eRifiutoDelleRegole(errore) ? new ErroreSalvataggio('RESPINTO') : errore;
    });
    for (const [id, versione] of scritte) {
      versioni.set(id, versione);
    }
  }
  return versioni;
}
