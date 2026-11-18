// Turno notturno (L8): scavalca la mezzanotte. Formula unica, ripetuta identica in firestore.rules.
import type { OraLocale } from '../tipi';

/**
 * `(fine < inizio && fine != '00:00') || fine == inizio`:
 * 22:00-00:00 non è notturno (finisce a mezzanotte), 22:00-07:00 sì; 08:00-08:00 e 00:00-00:00 sono 24 ore, notturni.
 */
export function eNotturno(inizio: OraLocale, fine: OraLocale): boolean {
  return (fine < inizio && fine !== '00:00') || fine === inizio;
}
