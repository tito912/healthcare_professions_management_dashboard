// Lettura della banca ore (ARCHITETTURA §5.11), scritta solo dalle Functions. Come `riepiloghi.firestore.ts`, le
// funzioni prendono `db` e si provano sull'emulatore. Una query con la sola uguaglianza su `anno`: indice automatico.
import {
  collection,
  getDocs,
  query,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import type { BancaOreDoc } from '@turni/domain';

/** La banca ore di un dipendente in un anno, senza l'istante del calcolo (il browser non lo usa). */
export type BancaOreSalvata = Omit<BancaOreDoc, 'calcolatoIl'>;

function eMappa(valore: unknown): valore is Record<string, unknown> {
  return typeof valore === 'object' && valore !== null && !Array.isArray(valore);
}

const MESI_BANCA = new Set([
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
]);

/** Convertitore tipizzato: un documento senza i campi attesi non entra nella tabella (null). */
export function bancaOreDaDati(dati: DocumentData): BancaOreSalvata | null {
  const dipendenteId: unknown = dati['dipendenteId'];
  const anno: unknown = dati['anno'];
  const riportoMinuti: unknown = dati['riportoMinuti'];
  const saldoAnnoMinuti: unknown = dati['saldoAnnoMinuti'];
  const saldoDefinitivoMinuti: unknown = dati['saldoDefinitivoMinuti'];
  const provvisorio: unknown = dati['provvisorio'];
  const mesi: unknown = dati['mesi'];
  if (
    typeof dipendenteId !== 'string' ||
    typeof anno !== 'number' ||
    typeof riportoMinuti !== 'number' ||
    typeof saldoAnnoMinuti !== 'number' ||
    typeof saldoDefinitivoMinuti !== 'number' ||
    typeof provvisorio !== 'boolean' ||
    !eMappa(mesi)
  ) {
    return null;
  }
  const risultato: BancaOreSalvata['mesi'] = {};
  for (const [chiave, valore] of Object.entries(mesi)) {
    if (
      !MESI_BANCA.has(chiave) ||
      !eMappa(valore) ||
      typeof valore['minutiLavorati'] !== 'number' ||
      typeof valore['minutiDovuti'] !== 'number' ||
      typeof valore['saldoMinuti'] !== 'number' ||
      typeof valore['definitivo'] !== 'boolean'
    ) {
      return null;
    }
    Object.assign(risultato, {
      [chiave]: {
        minutiLavorati: valore['minutiLavorati'],
        minutiDovuti: valore['minutiDovuti'],
        saldoMinuti: valore['saldoMinuti'],
        definitivo: valore['definitivo'],
      },
    });
  }
  return {
    dipendenteId,
    anno,
    riportoMinuti,
    mesi: risultato,
    saldoAnnoMinuti,
    saldoDefinitivoMinuti,
    provvisorio,
  };
}

/** Le banche ore di tutti i dipendenti del reparto nell'anno (una per dipendente). */
export async function leggiBancaOreAnno(
  db: Firestore,
  repartoId: string,
  anno: number,
): Promise<BancaOreSalvata[]> {
  const risultato = await getDocs(
    query(collection(db, 'reparti', repartoId, 'bancaOre'), where('anno', '==', anno)),
  );
  return risultato.docs
    .map((documento) => bancaOreDaDati(documento.data()))
    .filter((banca): banca is BancaOreSalvata => banca !== null);
}
