// Test della revisione dello step 3.2 (docs/review/3.2.md): dimostrano i difetti trovati, non il comportamento voluto
// dall'autore. Falliscono finché il difetto c'è.
import {
  codiceAssenza,
  type CellaDoc,
  type ChiaveGiorno,
  type RiepilogoPerClassifica,
} from '@turni/domain';
import { apriMenu, clic, scegliVoce, type Montata } from '../../test/azioni-griglia';
import { DIPENDENTI, cellaConTurno, montaGriglia, rigaSalvata } from '../../test/monta-griglia';

const ROSSI = 'd1';
const MALATTIA = { codice: codiceAssenza('MA'), effetto: 'neutra', malattia: true } as const;

function righeDi(
  per: Readonly<Record<string, Partial<Record<ChiaveGiorno, CellaDoc>>>>,
): ReturnType<typeof rigaSalvata>[] {
  return DIPENDENTI.map((d) => rigaSalvata(d.id, per[d.id] ?? {}));
}

describe('Revisione 3.2, rilievo 1: focus nel pannello «Trova sostituto» (UX §10)', () => {
  it('a classifica pronta, dopo l’apertura da menu, il focus sta dentro il pannello', async () => {
    // Come nel browser: storico e saldi arrivano dopo l'apertura (lettura asincrona su Firestore).
    let risolvi: (r: readonly RiepilogoPerClassifica[]) => void = () => undefined;
    const lenta = new Promise<readonly RiepilogoPerClassifica[]>((ok) => {
      risolvi = ok;
    });
    const t: Montata = await montaGriglia({
      righe: {
        '2026-11': righeDi({ [ROSSI]: { '03': { ...cellaConTurno('M1'), assenza: MALATTIA } } }),
      },
      riepiloghiClassifica: () => lenta,
      banche: [],
    });
    await clic(t, ROSSI, '03');
    await apriMenu(t, ROSSI, '03');
    await scegliVoce(t, 'Trova sostituto');
    risolvi([]);
    await t.assesta();
    const pannello = t.radice().querySelector('app-pannello-sostituti');
    expect(pannello?.querySelector('[data-disponibili]')).not.toBeNull();
    expect(pannello?.contains(document.activeElement)).toBe(true);
  });
});
