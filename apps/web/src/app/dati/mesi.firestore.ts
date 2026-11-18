// Lettura e creazione del documento del mese (ARCHITETTURA §5.8, §9). Le funzioni prendono `db` come parametro e
// non importano `core/firebase`: così si provano sull'emulatore (tests/regole/griglia-dati.test.ts). Gli
// `@Injectable` che le usano nell'app sono in `mesi.repo.ts`.
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import {
  CHIAVI_GIORNO,
  eChiaveMese,
  type CalendarioMese,
  type ChiaveGiorno,
  type ChiaveMese,
  type ContrattoRiga,
} from '@turni/domain';

/** Il mese come lo legge la griglia, senza gli istanti (tranne la convalida, per la fascia di stato). */
export interface MeseSalvato {
  readonly chiave: ChiaveMese;
  readonly stato: 'bozza' | 'convalidato';
  readonly calendario: CalendarioMese;
  /** Millisecondi dall'epoca della convalida (solo per mostrare data e ora). */
  readonly convalidatoIlMs: number | null;
  readonly convalidatoDaNome: string | null;
}

function eMappa(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

function eChiaveGiornoValida(chiave: string): chiave is ChiaveGiorno {
  return CHIAVI_GIORNO.some((c) => c === chiave);
}

/** Convertitore tipizzato: un mese senza la forma attesa non si apre (null). */
export function meseDaDati(id: string, dati: DocumentData): MeseSalvato | null {
  const stato: unknown = dati['stato'];
  const calendario: unknown = dati['calendario'];
  const convalidatoIl: unknown = dati['convalidatoIl'];
  const convalidatoDaNome: unknown = dati['convalidatoDaNome'];
  if (!eChiaveMese(id) || (stato !== 'bozza' && stato !== 'convalidato') || !eMappa(calendario)) {
    return null;
  }
  const festivita: CalendarioMese['festivita'] = {};
  const grezze = calendario['festivita'];
  if (eMappa(grezze)) {
    for (const [giorno, valore] of Object.entries(grezze)) {
      if (
        eChiaveGiornoValida(giorno) &&
        eMappa(valore) &&
        typeof valore['id'] === 'string' &&
        typeof valore['nome'] === 'string'
      ) {
        festivita[giorno] = { id: valore['id'], nome: valore['nome'] };
      }
    }
  }
  const millisecondi =
    typeof convalidatoIl === 'object' &&
    convalidatoIl !== null &&
    'toMillis' in convalidatoIl &&
    typeof convalidatoIl.toMillis === 'function'
      ? Number(convalidatoIl.toMillis())
      : null;
  return {
    chiave: id,
    stato,
    calendario: {
      festivita,
      attribuzioneNotte: calendario['attribuzioneNotte'] === 'fine' ? 'fine' : 'inizio',
    },
    convalidatoIlMs: millisecondi,
    convalidatoDaNome: typeof convalidatoDaNome === 'string' ? convalidatoDaNome : null,
  };
}

/** Il mese, o null se non è stato creato. Un errore di rete o di permessi si propaga. */
export async function leggiMese(
  db: Firestore,
  repartoId: string,
  chiave: ChiaveMese,
): Promise<MeseSalvato | null> {
  const documento = await getDoc(doc(db, 'reparti', repartoId, 'mesi', chiave));
  return documento.exists() ? meseDaDati(documento.id, documento.data()) : null;
}

export interface RigaNuova {
  readonly dipendenteId: string;
  readonly contratto: ContrattoRiga;
}

export interface RichiestaCreaMese {
  readonly repartoId: string;
  readonly uid: string;
  readonly chiave: ChiaveMese;
  readonly calendario: CalendarioMese;
  readonly righe: readonly RigaNuova[];
}

/** Scritture per batch: un batch di Firestore ne ammette 500, il documento del mese è la prima del primo. */
const SCRITTURE_PER_BATCH = 499;

/**
 * «Aggiungi mese»: il mese in bozza e una riga vuota per ogni dipendente in servizio, con `versione: 1`
 * (ARCHITETTURA §9). Le regole verificano le righe contro il mese creato nello stesso batch (`getAfter`), perciò
 * il mese sta nel primo batch; con più di 499 righe i batch successivi trovano il mese già scritto.
 */
export async function creaMese(db: Firestore, richiesta: RichiestaCreaMese): Promise<void> {
  const { repartoId, uid, chiave, calendario, righe } = richiesta;
  const riferimentoMese = doc(db, 'reparti', repartoId, 'mesi', chiave);
  const [anno, mese] = chiave.split('-').map(Number);
  let indice = 0;
  let primo = true;
  do {
    const batch = writeBatch(db);
    let scritture = 0;
    if (primo) {
      batch.set(riferimentoMese, {
        chiave,
        anno,
        mese,
        stato: 'bozza',
        calendario: {
          festivita: calendario.festivita,
          attribuzioneNotte: calendario.attribuzioneNotte,
        },
        creatoIl: serverTimestamp(),
        creatoDa: uid,
        aggiornatoIl: serverTimestamp(),
        aggiornatoDa: uid,
        convalidatoIl: null,
        convalidatoDa: null,
        convalidatoDaNome: null,
      });
      scritture += 1;
    }
    while (scritture < SCRITTURE_PER_BATCH && indice < righe.length) {
      const riga = righe[indice];
      indice += 1;
      if (riga === undefined) {
        break;
      }
      batch.set(doc(riferimentoMese, 'righe', riga.dipendenteId), {
        dipendenteId: riga.dipendenteId,
        contratto: {
          oreSettimanali: riga.contratto.oreSettimanali,
          dataAssunzione: riga.contratto.dataAssunzione,
          dataCessazione: riga.contratto.dataCessazione,
        },
        giorni: {},
        versione: 1,
        aggiornatoDa: uid,
        aggiornatoIl: serverTimestamp(),
      });
      scritture += 1;
    }
    await batch.commit();
    primo = false;
  } while (indice < righe.length);
}
