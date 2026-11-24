// Lettura tollerante dei riepiloghi per il report: ciò che arriva da Firestore si verifica prima di sommare (mai `as`).
import { eChiaveMese, type BancaOreDoc, type RiepilogoPerReport } from '@turni/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

function intero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) && valore >= 0 ? valore : null;
}

function interoConSegno(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) ? valore : null;
}

/** Il riepilogo per il report, o null se il documento non ha la forma attesa (si salta, con un avviso nel log). */
export function leggiRiepilogoPerReport(snapshot: DocumentSnapshot): RiepilogoPerReport | null {
  const dipendenteId: unknown = snapshot.get('dipendenteId');
  const chiaveMese: unknown = snapshot.get('chiaveMese');
  const turniSvolti = intero(snapshot.get('turniSvolti'));
  const notti = intero(snapshot.get('notti'));
  const sabati = intero(snapshot.get('sabati'));
  const domenicheEFestivi = intero(snapshot.get('domenicheEFestivi'));
  const reperibilitaSvolte = intero(snapshot.get('reperibilitaSvolte'));
  const chiamate = intero(snapshot.get('chiamate'));
  const minutiChiamate = intero(snapshot.get('minutiChiamate'));
  const minutiDovuti = intero(snapshot.get('minutiDovuti'));
  const minutiLavorati = intero(snapshot.get('minutiLavorati'));
  const saldoMinuti = interoConSegno(snapshot.get('saldoMinuti'));
  if (
    typeof dipendenteId !== 'string' ||
    typeof chiaveMese !== 'string' ||
    !eChiaveMese(chiaveMese) ||
    turniSvolti === null ||
    notti === null ||
    sabati === null ||
    domenicheEFestivi === null ||
    reperibilitaSvolte === null ||
    chiamate === null ||
    minutiChiamate === null ||
    minutiDovuti === null ||
    minutiLavorati === null ||
    saldoMinuti === null
  ) {
    return null;
  }
  return {
    dipendenteId,
    chiaveMese,
    turniSvolti,
    notti,
    sabati,
    domenicheEFestivi,
    reperibilitaSvolte,
    chiamate,
    minutiChiamate,
    minutiDovuti,
    minutiLavorati,
    saldoMinuti,
  };
}

const MESI_BANCA_ORE = [
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
] as const;

/** Il campo di un oggetto di forma ignota, senza `as`. */
function campo(oggetto: unknown, nome: string): unknown {
  if (typeof oggetto !== 'object' || oggetto === null) {
    return undefined;
  }
  return Object.entries(oggetto).find(([chiave]) => chiave === nome)?.[1];
}

/**
 * La banca ore dell'anno per il saldo da inizio anno del report (L44): riporto e saldi dei mesi. Un documento senza la
 * forma attesa è null (si salta, senza saldo da inizio anno).
 */
export function leggiBancaOrePerReport(
  snapshot: DocumentSnapshot,
): Pick<BancaOreDoc, 'riportoMinuti' | 'mesi'> | null {
  const riportoMinuti = interoConSegno(snapshot.get('riportoMinuti'));
  const grezzi: unknown = snapshot.get('mesi');
  if (riportoMinuti === null || typeof grezzi !== 'object' || grezzi === null) {
    return null;
  }
  const mesi: BancaOreDoc['mesi'] = {};
  for (const chiave of MESI_BANCA_ORE) {
    const mese = campo(grezzi, chiave);
    if (mese === undefined) {
      continue;
    }
    const minutiLavorati = interoConSegno(campo(mese, 'minutiLavorati'));
    const minutiDovuti = interoConSegno(campo(mese, 'minutiDovuti'));
    const saldoMinuti = interoConSegno(campo(mese, 'saldoMinuti'));
    const definitivo = campo(mese, 'definitivo');
    if (
      minutiLavorati === null ||
      minutiDovuti === null ||
      saldoMinuti === null ||
      typeof definitivo !== 'boolean'
    ) {
      return null;
    }
    mesi[chiave] = { minutiLavorati, minutiDovuti, saldoMinuti, definitivo };
  }
  return { riportoMinuti, mesi };
}
