// Lettura del registro attività (ARCHITETTURA §5.13, §10). L'ADMIN interroga il collection group `registroAttivita`
// (voci dei reparti e della raccolta radice); il coordinatore una raccolta per reparto (`reparti/{id}/registroAttivita`).
// Tutte le query ordinano per `il` decrescente; i filtri su reparto, utente e tipo sono di uguaglianza, il periodo è un
// intervallo sullo stesso campo `il`: indici in firestore.indexes.json.
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { TIPI_OPERAZIONE, type TipoOperazione } from '@turni/domain';
import type { SorgentePagina } from './registro.paginatore';

export interface VoceRegistro {
  readonly id: string;
  readonly ilMs: number;
  readonly tipo: TipoOperazione;
  readonly autoreUid: string | null;
  readonly autoreNome: string | null;
  readonly repartoId: string | null;
  readonly chiaveMese: string | null;
  readonly dipendenteId: string | null;
  readonly dettagli: Readonly<Record<string, string | number | boolean | null>>;
}

export interface FiltriRegistro {
  readonly repartoId: string | null;
  /** `null` = nessun filtro; `SISTEMA` = voci scritte dal sistema (autore nullo). */
  readonly autore: string | null;
  readonly tipo: TipoOperazione | null;
  readonly daMs: number | null;
  readonly aMs: number | null;
}

export const AUTORE_SISTEMA = 'SISTEMA';

/** Dove leggere: tutte le raccolte (ADMIN) oppure quelle di un reparto (coordinatore). */
export type FonteRegistro =
  { readonly tipo: 'tutte' } | { readonly tipo: 'reparto'; readonly id: string };

function eTipoOperazione(valore: unknown): valore is TipoOperazione {
  return TIPI_OPERAZIONE.some((tipo) => tipo === valore);
}

function testoOppureNull(valore: unknown): string | null {
  return typeof valore === 'string' ? valore : null;
}

function dettagliDa(valore: unknown): VoceRegistro['dettagli'] {
  const risultato: Record<string, string | number | boolean | null> = {};
  if (typeof valore === 'object' && valore !== null) {
    for (const [chiave, v] of Object.entries(valore)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
        risultato[chiave] = v;
      }
    }
  }
  return risultato;
}

/** Convertitore: una voce che non ha la forma attesa non entra nell'elenco. */
export function voceDaDocumento(
  documento: QueryDocumentSnapshot<DocumentData>,
): VoceRegistro | null {
  const dati = documento.data();
  const il: unknown = dati['il'];
  const tipo: unknown = dati['tipo'];
  if (!(il instanceof Timestamp) || !eTipoOperazione(tipo)) {
    return null;
  }
  return {
    id: documento.id,
    ilMs: il.toMillis(),
    tipo,
    autoreUid: testoOppureNull(dati['autoreUid']),
    autoreNome: testoOppureNull(dati['autoreNome']),
    repartoId: testoOppureNull(dati['repartoId']),
    chiaveMese: testoOppureNull(dati['chiaveMese']),
    dipendenteId: testoOppureNull(dati['dipendenteId']),
    dettagli: dettagliDa(dati['dettagli']),
  };
}

/** Condizioni della query per i filtri: uguaglianze e intervallo sul solo campo `il`. */
export function vincoliRegistro(filtri: FiltriRegistro, fonte: FonteRegistro): QueryConstraint[] {
  const vincoli: QueryConstraint[] = [];
  if (fonte.tipo === 'tutte' && filtri.repartoId !== null) {
    vincoli.push(where('repartoId', '==', filtri.repartoId));
  }
  if (filtri.autore !== null) {
    vincoli.push(where('autoreUid', '==', filtri.autore === AUTORE_SISTEMA ? null : filtri.autore));
  }
  if (filtri.tipo !== null) {
    vincoli.push(where('tipo', '==', filtri.tipo));
  }
  if (filtri.daMs !== null) {
    vincoli.push(where('il', '>=', Timestamp.fromMillis(filtri.daMs)));
  }
  if (filtri.aMs !== null) {
    vincoli.push(where('il', '<', Timestamp.fromMillis(filtri.aMs)));
  }
  return vincoli;
}

/** Sorgente paginata di una fonte: `carica(n)` legge le `n` voci successive dopo l'ultima già letta. */
export function sorgenteRegistro(
  db: Firestore,
  fonte: FonteRegistro,
  filtri: FiltriRegistro,
): SorgentePagina<VoceRegistro> {
  let ultimo: QueryDocumentSnapshot<DocumentData> | null = null;
  return {
    async carica(quante) {
      const base =
        fonte.tipo === 'tutte'
          ? collectionGroup(db, 'registroAttivita')
          : collection(db, 'reparti', fonte.id, 'registroAttivita');
      const vincoli = [...vincoliRegistro(filtri, fonte), orderBy('il', 'desc')];
      if (ultimo !== null) {
        vincoli.push(startAfter(ultimo));
      }
      const risultato = await getDocs(query(base, ...vincoli, limit(quante)));
      ultimo = risultato.docs[risultato.docs.length - 1] ?? ultimo;
      return {
        elementi: risultato.docs
          .map(voceDaDocumento)
          .filter((voce): voce is VoceRegistro => voce !== null),
        esaurita: risultato.docs.length < quante,
      };
    },
  };
}
