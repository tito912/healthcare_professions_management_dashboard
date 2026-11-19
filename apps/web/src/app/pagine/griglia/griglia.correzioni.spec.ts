// Test delle correzioni dopo la review dello step 2.2 (docs/review/2.2.md, rilievi 5-10).
import { DIPENDENTI, montaGriglia, rigaSalvata, testoDi } from '../../test/monta-griglia';

const BRUNI = 'd5';
const NERI = 'd3';

type Montata = Awaited<ReturnType<typeof montaGriglia>>;

async function clic(t: Montata, id: string, giorno: string): Promise<void> {
  t.cella(id, giorno).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

describe('Correzioni 2.2 — rilievo 10: letture del cambio di mese', () => {
  it('il mese aperto si rilegge sempre; i mesi adiacenti già letti si riusano', async () => {
    const t = await montaGriglia({
      righe: { '2026-10': [], '2026-12': [], '2027-01': [] },
    });
    // Apertura di novembre: il mese e i due adiacenti.
    expect([...t.letture].sort()).toEqual(['2026-10', '2026-11', '2026-12']);

    // Dicembre: si rilegge dicembre; novembre è in memoria, gennaio è nuovo.
    t.letture.length = 0;
    await t.router.navigateByUrl('/reparti/r1/mesi/2026-12');
    await t.assesta();
    expect([...t.letture].sort()).toEqual(['2026-12', '2027-01']);

    // Ritorno a novembre: solo novembre (ottobre e dicembre già in memoria).
    t.letture.length = 0;
    await t.router.navigateByUrl('/reparti/r1/mesi/2026-11');
    await t.assesta();
    expect(t.letture).toEqual(['2026-11']);
  });
});

describe('Correzioni 2.2 — rilievo 5: focus dopo Alt+PagSu / Alt+PagGiù', () => {
  it('chi cambia mese da tastiera ritrova il focus su una cella e può ripetere il tasto', async () => {
    const righe = DIPENDENTI.map((d) => rigaSalvata(d.id));
    const t = await montaGriglia({ righe: { '2026-10': righe, '2026-09': righe } });
    await clic(t, BRUNI, '05');
    await t.tasto(t.cella(BRUNI, '05'), 'PageUp', { altKey: true });
    await t.assesta();
    expect(t.router.url).toBe('/reparti/r1/mesi/2026-10');
    expect(document.activeElement?.getAttribute('role')).toBe('gridcell');
    await t.tasto(document.activeElement as Element, 'PageUp', { altKey: true });
    await t.assesta();
    expect(t.router.url).toBe('/reparti/r1/mesi/2026-09');
  });
});

describe('Correzioni 2.2 — rilievo 6: un tasto nello stesso fotogramma di uno spostamento', () => {
  it('Tab seguito subito da una lettera apre il campo e il focus resta lì', async () => {
    const t = await montaGriglia();
    await clic(t, BRUNI, '05');
    t.cella(BRUNI, '05').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    t.cella(BRUNI, '06').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }),
    );
    await t.assesta();
    const campo = t.radice().querySelector<HTMLInputElement>('input[maxlength="2"]');
    expect(campo).not.toBeNull();
    expect(document.activeElement).toBe(campo);
  });
});

describe('Correzioni 2.2 — rilievo 7: larghezza delle colonne nelle settimane corte', () => {
  it('l’ultima settimana di novembre (un solo giorno) ha la colonna di una settimana intera', async () => {
    const t = await montaGriglia();
    const colonne = (): string =>
      t.radice().querySelector<HTMLElement>('[role="grid"]')?.style.getPropertyValue('--colonne') ??
      '';
    await clic(t, BRUNI, '03');
    (
      Array.from(t.radice().querySelectorAll('[role="radio"]')).find(
        (r) => testoDi(r) === '1 settimana',
      ) as HTMLElement
    ).click();
    await t.assesta();
    for (let i = 0; i < 6; i++) {
      await t.tasto(document.activeElement as Element, 'ArrowRight', {
        altKey: true,
        shiftKey: true,
      });
    }
    // 958 px di spazio / 7 giorni = 136 px, anche con un solo giorno visibile (prima: 958 px).
    expect(t.radice().querySelectorAll('[role="columnheader"][data-g]')).toHaveLength(1);
    expect(colonne()).toContain('repeat(1, 136px)');
  });
});

describe('Correzioni 2.2 — rilievo 9: etichetta della cella con dati non validi', () => {
  it('dice una volta sola «dati non validi» e non «vuota»', async () => {
    const salvata = { ...rigaSalvata(BRUNI), grezzi: { '09': { turno: 'boh' } } };
    const t = await montaGriglia({
      righe: { '2026-11': DIPENDENTI.map((d) => (d.id === BRUNI ? salvata : rigaSalvata(d.id))) },
    });
    const etichetta = t.cella(BRUNI, '09').getAttribute('aria-label') ?? '';
    expect(etichetta).not.toContain('vuota');
    expect(etichetta.split('Cella con dati non validi')).toHaveLength(2);
    // Le altre celle non sono toccate.
    expect(t.cella(NERI, '09').getAttribute('aria-label')).toContain('vuota');
  });
});

describe('Correzioni 2.2 — rilievo 3: posizione dell’icona d’avviso nella vista mese stretta', () => {
  it('sta al centro del bordo superiore, lontana dagli angoli della chiamata e della sostituzione', async () => {
    const salvata = { ...rigaSalvata(BRUNI), grezzi: { '09': { turno: 'boh' } } };
    const t = await montaGriglia({
      righe: { '2026-11': DIPENDENTI.map((d) => (d.id === BRUNI ? salvata : rigaSalvata(d.id))) },
    });
    const icona = t.cella(BRUNI, '09').querySelector<HTMLElement>('span.ring-1');
    expect(icona).not.toBeNull();
    expect(icona?.style.top).toBe('1px');
    expect(icona?.style.left).toBe('calc(50% - 3.5px)');
    expect(icona?.style.width).toBe('7px');
  });
});
