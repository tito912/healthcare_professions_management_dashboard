// Review dello step 3.1b, rilievo 3 (docs/review/3.1b.md): le voci `consuntivo.modificato` dichiarano «solo codici,
// orari e ID», ma `sostituisce`, `copertoDa` e i campi della reperibilità passano da `schemaIdCollega`, che accetta
// qualsiasi testo di 1-128 caratteri. Le regole non guardano dentro la cella (L4), quindi un testo libero scritto
// nella riga (per esempio un nome) finisce tale e quale nel registro attività, che per CLAUDE.md non deve contenere
// dati personali. Il test accetta entrambe le correzioni: cella rifiutata (nessuna voce) o valore scartato.
import { describe, expect, it } from 'vitest';
import { cella, m } from '../test-utili';
import { modificheConsuntivo } from './modifiche';

const NOVEMBRE = m('2026-11');
const SOLO_CODICI_ORARI_ID = /^[A-Za-z0-9:@+,_-]*$/;

describe('review 3.1b: nessun testo libero nelle voci di consuntivo', () => {
  it('un copertoDa che non è un ID di documento non arriva nel registro', () => {
    const voci = modificheConsuntivo(
      NOVEMBRE,
      { '05': cella('M1', 'MA') },
      { '05': cella('M1', 'MA', { copertoDa: 'Mario Rossi' }) },
    );
    for (const voce of voci) {
      expect(`${voce.prima ?? ''}${voce.dopo ?? ''}`).toMatch(SOLO_CODICI_ORARI_ID);
    }
  });

  it('controllo: un ID di documento vero produce la voce', () => {
    const voci = modificheConsuntivo(
      NOVEMBRE,
      { '05': cella('M1', 'MA') },
      { '05': cella('M1', 'MA', { copertoDa: 'dipB_01' }) },
    );
    expect(voci).toEqual([{ giorno: '05', campo: 'copertoDa', prima: null, dopo: 'dipB_01' }]);
  });
});
