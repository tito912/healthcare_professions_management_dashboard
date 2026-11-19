// Test di componente della Banca ore (PIANO 3.2 criterio 5, UX §7.8).
import type { BancaOreSalvata } from '../../dati/banca-ore.repo';
import { montaBancaOre } from '../../test/monta-banca-ore';
import { testoDi } from '../../test/monta-griglia';

const BIANCHI = 'd2';
const ROSSI = 'd1';
const VERDI = 'd4';

function banca(
  id: string,
  riporto: number,
  mesi: Record<string, { saldo: number; definitivo: boolean }>,
  provvisorio: boolean,
  anno = 2026,
): BancaOreSalvata {
  const elenco = Object.entries(mesi);
  const somma = elenco.reduce((s, [, m]) => s + m.saldo, 0);
  const definitivi = elenco.filter(([, m]) => m.definitivo).reduce((s, [, m]) => s + m.saldo, 0);
  return {
    dipendenteId: id,
    anno,
    riportoMinuti: riporto,
    mesi: Object.fromEntries(
      elenco.map(([chiave, m]) => [
        chiave,
        { minutiLavorati: 0, minutiDovuti: 0, saldoMinuti: m.saldo, definitivo: m.definitivo },
      ]),
    ),
    saldoAnnoMinuti: riporto + somma,
    saldoDefinitivoMinuti: riporto + definitivi,
    provvisorio,
  };
}

const BANCHE: readonly BancaOreSalvata[] = [
  banca(
    BIANCHI,
    720,
    {
      '01': { saldo: 210, definitivo: true },
      '02': { saldo: -432, definitivo: true },
      '03': { saldo: 0, definitivo: true },
      '11': { saldo: 72, definitivo: false },
    },
    true,
  ),
  banca(ROSSI, -270, { '01': { saldo: 288, definitivo: true } }, false),
];

const celle = (radice: HTMLElement, id: string): HTMLElement[] => {
  const riga = Array.from(radice.querySelectorAll<HTMLElement>('tbody tr')).find((r) =>
    r.querySelector(`a[href*="/banca-ore/${id}"]`),
  );
  return Array.from(riga?.querySelectorAll<HTMLElement>('td') ?? []);
};

describe('Banca ore: una riga per dipendente, un saldo per mese', () => {
  it('mostra l’intestazione, un dipendente per riga in ordine di cognome e i mesi con il solo saldo', async () => {
    const t = await montaBancaOre({ banche: () => Promise.resolve(BANCHE) });
    const radice = t.radice();
    expect(testoDi(radice.querySelector('h1') as Element)).toBe('Radiologia › Banca ore');
    expect(testoDi(radice.querySelector('[data-anno]') as Element)).toBe('2026');
    const nomi = Array.from(radice.querySelectorAll('tbody th')).map((e) => testoDi(e));
    expect(nomi).toEqual(['Bianchi L.›', 'Bruni E.›', 'Neri G.›', 'Rossi M.›', 'Verdi A.›']);
    const intestazioni = Array.from(radice.querySelectorAll('thead th')).map((e) => testoDi(e));
    expect(intestazioni.slice(0, 3)).toEqual(['Dipendente', 'Gen', 'Feb']);
    expect(intestazioni.slice(-2)).toEqual(['Riporto', 'Totale 2026']);
    expect(t.richiesteBanca).toEqual([2026]);
  });

  it('credito e debito si distinguono per segno e colore; il provvisorio per «≈», corsivo e suggerimento; il mese non creato è «—»', async () => {
    const t = await montaBancaOre({ banche: () => Promise.resolve(BANCHE) });
    const c = celle(t.radice(), BIANCHI);
    const gennaio = c[0] as HTMLElement;
    expect(testoDi(gennaio)).toBe('+3,5');
    expect(gennaio.classList.contains('text-credito')).toBe(true);
    const febbraio = c[1] as HTMLElement;
    expect(testoDi(febbraio)).toBe('−7,2');
    expect(febbraio.classList.contains('text-debito')).toBe(true);
    const marzo = c[2] as HTMLElement;
    expect(testoDi(marzo)).toBe('+0,0');
    expect(marzo.classList.contains('text-credito')).toBe(false);
    expect(marzo.classList.contains('text-debito')).toBe(false);
    const novembre = c[10] as HTMLElement;
    expect(testoDi(novembre)).toBe('≈+1,2');
    expect(novembre.classList.contains('italic')).toBe(true);
    expect(novembre.getAttribute('title')).toBe('Provvisorio: il mese non è ancora convalidato');
    const aprile = c[3] as HTMLElement;
    expect(testoDi(aprile)).toBe('—');
    expect(aprile.getAttribute('aria-label')).toBe('Apr: mese non creato');
    // Il definitivo non porta né «≈» né corsivo.
    expect(gennaio.classList.contains('italic')).toBe(false);
  });

  it('riporto e totale dell’anno stanno a destra; il totale è provvisorio se lo è almeno un mese', async () => {
    const t = await montaBancaOre({ banche: () => Promise.resolve(BANCHE) });
    const bianchi = celle(t.radice(), BIANCHI);
    expect(testoDi(bianchi.at(-2) as Element)).toBe('+12,0');
    const totale = bianchi.at(-1) as HTMLElement;
    // 720 + 210 − 432 + 0 + 72 = 570 minuti: +9,5 ore, provvisorio.
    expect(testoDi(totale)).toBe('≈+9,5');
    expect(totale.getAttribute('title')).toContain('Provvisorio');
    const rossi = celle(t.radice(), ROSSI);
    expect(testoDi(rossi.at(-2) as Element)).toBe('−4,5');
    expect((rossi.at(-2) as HTMLElement).classList.contains('text-debito')).toBe(true);
    // Rossi è tutto convalidato: totale definitivo, senza «≈».
    expect(testoDi(rossi.at(-1) as Element)).toBe('+0,3');
    expect(rossi.at(-1)?.getAttribute('title')).toBeNull();
    // Chi non ha una banca ore dell'anno ha tutto a zero e senza mesi.
    const verdi = celle(t.radice(), VERDI);
    expect(verdi.slice(0, 12).every((x) => testoDi(x) === '—')).toBe(true);
    expect(testoDi(verdi.at(-1) as Element)).toBe('+0,0');
  });

  it('il clic sul nome porta al dettaglio con l’anno scelto', async () => {
    const t = await montaBancaOre({ banche: () => Promise.resolve(BANCHE) });
    const collegamento = t
      .radice()
      .querySelector<HTMLAnchorElement>(`a[href*="/banca-ore/${BIANCHI}"]`);
    expect(collegamento?.getAttribute('href')).toBe(`/reparti/r1/banca-ore/${BIANCHI}?anno=2026`);
    expect(collegamento?.getAttribute('aria-label')).toBe('Apri il dettaglio di Bianchi Laura');
    collegamento?.click();
    await t.assesta();
    expect(t.router.url).toBe(`/reparti/r1/banca-ore/${BIANCHI}?anno=2026`);
  });

  it('il selettore cambia l’anno nell’indirizzo e rilegge la banca ore di quell’anno', async () => {
    const t = await montaBancaOre({
      banche: (anno) => Promise.resolve(anno === 2026 ? BANCHE : []),
    });
    (t.radice().querySelector('[aria-label="Anno precedente"]') as HTMLElement).click();
    await t.assesta();
    expect(t.router.url).toContain('anno=2025');
    expect(t.richiesteBanca.at(-1)).toBe(2025);
    expect(testoDi(t.radice().querySelector('[data-anno]') as Element)).toBe('2025');
    // Nessun mese in quell'anno: tutti «—».
    expect(testoDi(celle(t.radice(), BIANCHI)[0] as Element)).toBe('—');
  });

  it('senza anno nell’indirizzo si apre l’anno corrente; l’anno oltre il prossimo non si apre', async () => {
    const t = await montaBancaOre({
      url: '/reparti/r1/banca-ore',
      banche: () => Promise.resolve([]),
    });
    expect(testoDi(t.radice().querySelector('[data-anno]') as Element)).toBe('2026');
    await t.vai('/reparti/r1/banca-ore?anno=2040');
    expect(testoDi(t.radice().querySelector('[data-anno]') as Element)).toBe('2026');
  });

  it('la ricerca per nome filtra le righe', async () => {
    const t = await montaBancaOre({ banche: () => Promise.resolve(BANCHE) });
    const campo = t
      .radice()
      .querySelector<HTMLInputElement>('input[type="search"]') as HTMLInputElement;
    campo.value = 'bia';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.assesta();
    expect(Array.from(t.radice().querySelectorAll('tbody th')).map((e) => testoDi(e))).toEqual([
      'Bianchi L.›',
    ]);
    campo.value = 'zzz';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.assesta();
    expect(testoDi(t.radice())).toContain('Nessun dipendente corrisponde alla ricerca');
  });

  it('una banca ore di un dipendente rimosso compare come «Dipendente rimosso», in fondo', async () => {
    const t = await montaBancaOre({
      banche: () =>
        Promise.resolve([
          ...BANCHE,
          banca('d9', 0, { '01': { saldo: 60, definitivo: true } }, false),
        ]),
    });
    const nomi = Array.from(t.radice().querySelectorAll('tbody th')).map((e) => testoDi(e));
    expect(nomi.at(-1)).toContain('Dipendente rimosso');
  });

  it('l’ADMIN la vede allo stesso modo (sola lettura per natura)', async () => {
    const t = await montaBancaOre({ ruolo: 'ADMIN', banche: () => Promise.resolve(BANCHE) });
    expect(testoDi(celle(t.radice(), BIANCHI)[0] as Element)).toBe('+3,5');
  });

  it('errore di lettura: messaggio e «Riprova»; reparto inesistente: non disponibile', async () => {
    let chiamate = 0;
    const t = await montaBancaOre({
      banche: () =>
        ++chiamate === 1 ? Promise.reject(new Error('rete')) : Promise.resolve(BANCHE),
    });
    expect(testoDi(t.radice().querySelector('[role="alert"]') as Element)).toContain(
      'Impossibile caricare la banca ore.',
    );
    (
      Array.from(t.radice().querySelectorAll('button')).find(
        (b) => testoDi(b) === 'Riprova',
      ) as HTMLElement
    ).click();
    await t.assesta();
    expect(testoDi(celle(t.radice(), BIANCHI)[0] as Element)).toBe('+3,5');
    const assente = await montaBancaOre({ reparto: null });
    expect(testoDi(assente.radice())).toContain('Reparto non disponibile.');
  });
});
