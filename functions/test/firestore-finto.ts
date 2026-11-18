// Firestore in memoria per i test unitari delle Functions (senza emulatori): lo stesso sottoinsieme dell'Admin SDK
// che le funzioni usano (doc, collection, get, create, transazioni). Le transazioni applicano le scritture tutte
// insieme alla fine, oppure nessuna se una fallisce (create su un documento esistente: codice gRPC 6).
export type Dati = Record<string, unknown>;

export interface RifFinto {
  readonly id: string;
  readonly path: string;
  get(): Promise<IstantaneaFinta>;
  create(dati: Dati): Promise<void>;
  collection(nome: string): RaccoltaFinta;
}

export interface IstantaneaFinta {
  readonly exists: boolean;
  readonly id: string;
  readonly ref: RifFinto;
  get(campo: string): unknown;
}

export interface RaccoltaFinta {
  doc(id?: string): RifFinto;
}

type Scrittura =
  | { readonly tipo: 'create' | 'set'; readonly path: string; readonly dati: Dati }
  | { readonly tipo: 'update'; readonly path: string; readonly dati: Dati }
  | { readonly tipo: 'delete'; readonly path: string };

export interface TransazioneFinta {
  get(r: RifFinto): Promise<IstantaneaFinta>;
  create(r: RifFinto, dati: Dati): void;
  set(r: RifFinto, dati: Dati): void;
  update(r: RifFinto, dati: Dati): void;
  delete(r: RifFinto): void;
}

function erroreGrpc(codice: number, nome: string): Error {
  // Come un errore dell'Admin SDK: il messaggio può contenere il percorso del documento.
  return Object.assign(new Error(`${codice} ${nome}: percorso/del/documento`), { code: codice });
}

export function creaFirestoreFinto() {
  const documenti = new Map<string, Dati>();
  /** Percorsi (o prefissi) la cui scrittura fallisce con un errore gRPC UNAVAILABLE. */
  const guasti = new Set<string>();
  let contatore = 0;

  function istantanea(path: string): IstantaneaFinta {
    const dati = documenti.get(path);
    return {
      exists: dati !== undefined,
      id: idDi(path),
      ref: rif(path),
      get: (campo) => dati?.[campo],
    };
  }

  function idDi(path: string): string {
    return path.slice(path.lastIndexOf('/') + 1);
  }

  function rif(path: string): RifFinto {
    return {
      id: idDi(path),
      path,
      get: () => Promise.resolve(istantanea(path)),
      create: (dati) => {
        applica([{ tipo: 'create', path, dati }]);
        return Promise.resolve();
      },
      collection: (nome) => raccolta(`${path}/${nome}`),
    };
  }

  function raccolta(path: string): RaccoltaFinta {
    return { doc: (id) => rif(`${path}/${id ?? `auto${++contatore}`}`) };
  }

  function applica(scritture: readonly Scrittura[]): void {
    const copia = new Map(documenti);
    for (const scrittura of scritture) {
      if ([...guasti].some((g) => scrittura.path.startsWith(g))) {
        throw erroreGrpc(14, 'UNAVAILABLE');
      }
      const esiste = copia.has(scrittura.path);
      switch (scrittura.tipo) {
        case 'create':
          if (esiste) throw erroreGrpc(6, 'ALREADY_EXISTS');
          copia.set(scrittura.path, { ...scrittura.dati });
          break;
        case 'set':
          copia.set(scrittura.path, { ...scrittura.dati });
          break;
        case 'update':
          if (!esiste) throw erroreGrpc(5, 'NOT_FOUND');
          copia.set(scrittura.path, { ...copia.get(scrittura.path), ...scrittura.dati });
          break;
        case 'delete':
          copia.delete(scrittura.path);
          break;
      }
    }
    documenti.clear();
    for (const [path, dati] of copia) documenti.set(path, dati);
  }

  const db = {
    collection: (nome: string) => raccolta(nome),
    async runTransaction<T>(funzione: (t: TransazioneFinta) => Promise<T>): Promise<T> {
      const scritture: Scrittura[] = [];
      const transazione: TransazioneFinta = {
        get: (r) => {
          if (scritture.length > 0) {
            // Come Firestore: tutte le letture di una transazione vengono prima delle scritture.
            throw new Error('Le letture devono precedere le scritture.');
          }
          return Promise.resolve(istantanea(r.path));
        },
        create: (r, dati) => void scritture.push({ tipo: 'create', path: r.path, dati }),
        set: (r, dati) => void scritture.push({ tipo: 'set', path: r.path, dati }),
        update: (r, dati) => void scritture.push({ tipo: 'update', path: r.path, dati }),
        delete: (r) => void scritture.push({ tipo: 'delete', path: r.path }),
      };
      const esito = await funzione(transazione);
      applica(scritture);
      return esito;
    },
  };

  return {
    documenti,
    guasti,
    db,
    rif,
    imposta(path: string, dati: Dati): void {
      documenti.set(path, dati);
    },
    /** Documenti sotto un prefisso, per cercare le voci di registro e gli indici. */
    sotto(prefisso: string): [string, Dati][] {
      return [...documenti].filter(([path]) => path.startsWith(prefisso));
    },
    azzera(): void {
      documenti.clear();
      guasti.clear();
      contatore = 0;
    },
  };
}

/** Istanza condivisa tra il modulo simulato (`vi.mock`) e il test che la riempie e la verifica. */
export const finto = creaFirestoreFinto();
