// Password iniziale degli utenti creati dal server (creaCoordinatore, scripts/crea-primo-admin.ts).
// Non viene mai restituita né registrata: l'utente sceglie la propria con il link «reimposta password»
// (sendPasswordResetEmail nel browser, senza SMTP).
import { randomBytes, randomInt } from 'node:crypto';

// Un carattere per classe soddisfa anche una politica delle password con requisiti di complessità
// impostata in Authentication (L40); l'entropia viene dai 32 byte casuali.
const CLASSI = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!#%+-=?@_'];

export function passwordCasuale(): string {
  const casuale = randomBytes(32).toString('base64url');
  const perClasse = CLASSI.map((classe) => classe.charAt(randomInt(classe.length))).join('');
  return casuale + perClasse;
}
