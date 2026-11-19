// Test della review dello step 2.2 (docs/review/2.2.md): ciascuno dimostra un difetto e oggi fallisce.
import { DIPENDENTI, montaGriglia, pulsante, rigaSalvata, testoDi } from '../../test/monta-griglia';

const BRUNI = 'd5';

type Montata = Awaited<ReturnType<typeof montaGriglia>>;

async function clic(t: Montata, id: string, giorno: string): Promise<void> {
  t.cella(id, giorno).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

async function inserisci(t: Montata, id: string, giorno: string, codice: string): Promise<void> {
  await clic(t, id, giorno);
  await t.tasto(t.cella(id, giorno), codice.charAt(0));
  const campo = t.radice().querySelector<HTMLInputElement>('input[maxlength="2"]');
  if (campo === null) {
    throw new Error('Il campo di inserimento non è comparso');
  }
  campo.value = codice;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  await t.tasto(campo, 'Enter');
}

const fascia = (t: Montata): string =>
  testoDi(t.radice().querySelector('app-fascia-stato') as Element);

describe('Review 2.2 — rilievo 1: una cella non valida già salvata non si può svuotare', () => {
  it('Canc sulla cella «grezza» la svuota, conta come modifica e «Salva bozza» la toglie dal documento', async () => {
    const salvata = { ...rigaSalvata(BRUNI), grezzi: { '09': { turno: 'boh' } } };
    const t = await montaGriglia({
      righe: { '2026-11': DIPENDENTI.map((d) => (d.id === BRUNI ? salvata : rigaSalvata(d.id))) },
    });
    expect(t.cella(BRUNI, '09').getAttribute('aria-label')).toContain('dati non validi');

    await clic(t, BRUNI, '09');
    await t.tasto(t.cella(BRUNI, '09'), 'Delete');

    // L'handoff: la cella «blocca Salva bozza finché non la si svuota». Svuotarla deve togliere il blocco
    // e restare come modifica da salvare, altrimenti il documento conserva la cella non valida.
    expect(t.cella(BRUNI, '09').getAttribute('aria-label')).not.toContain('dati non validi');
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(1);
    const riga = t.salvataggi[0]?.righe.find((r) => r.dipendenteId === BRUNI);
    expect(riga?.grezzi).toEqual({});
  });
});

describe('Review 2.2 — rilievo 2: un salvataggio che finisce dopo il cambio di mese sporca il mese nuovo', () => {
  it('chi esce durante «Salva bozza» trova il mese successivo «tutto salvato»', async () => {
    let completa: (versioni: ReadonlyMap<string, number>) => void = () => undefined;
    const t = await montaGriglia({
      esitoDialogo: 'esci',
      righe: {
        '2026-11': DIPENDENTI.map((d) => rigaSalvata(d.id)),
        '2026-12': DIPENDENTI.map((d) => rigaSalvata(d.id)),
      },
      salva: () =>
        new Promise<ReadonlyMap<string, number>>((risolvi) => {
          completa = risolvi;
        }),
    });
    await inserisci(t, BRUNI, '05', 'M1');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(fascia(t)).toContain('Salvataggio in corso');

    // Durante il salvataggio si passa a dicembre («Esci senza salvare» nel dialogo di uscita).
    await t.router.navigateByUrl('/reparti/r1/mesi/2026-12');
    await t.assesta();
    expect(t.router.url).toBe('/reparti/r1/mesi/2026-12');
    expect(fascia(t)).toContain('Bozza: tutto salvato');

    // Il salvataggio di novembre termina ora: non deve toccare lo stato di dicembre.
    completa(new Map([[BRUNI, 2]]));
    await t.assesta();
    expect(fascia(t)).toContain('Bozza: tutto salvato');
    expect(testoDi(t.cella(BRUNI, '05'))).not.toContain('M1');
  });
});

describe('Review 2.2 — rilievo 4: Ctrl+S durante l’inserimento veloce', () => {
  it('non apre «Salva pagina con nome» del browser', async () => {
    const t = await montaGriglia();
    await clic(t, BRUNI, '05');
    await t.tasto(t.cella(BRUNI, '05'), 'm');
    const campo = t.radice().querySelector<HTMLInputElement>('input[maxlength="2"]');
    expect(campo).not.toBeNull();
    const evento = await t.tasto(campo as HTMLInputElement, 's', { ctrlKey: true });
    // Il campo ferma la propagazione di ogni tasto: l'ascoltatore di Ctrl+S sul documento non lo riceve.
    expect(evento.defaultPrevented).toBe(true);
  });
});
