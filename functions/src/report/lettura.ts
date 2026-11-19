// Lettura tollerante dei riepiloghi per il report: ciò che arriva da Firestore si verifica prima di sommare (mai `as`).
import { eChiaveMese, type RiepilogoPerReport } from '@turni/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

function intero(valore: unknown): number | null {
  return typeof valore === 'number' && Number.isSafeInteger(valore) && valore >= 0 ? valore : null;
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
    minutiChiamate === null
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
  };
}
