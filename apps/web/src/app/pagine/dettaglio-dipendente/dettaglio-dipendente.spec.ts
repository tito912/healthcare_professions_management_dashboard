// Test di componente del dettaglio del dipendente (PIANO 3.2 criterio 6, UX §7.9, U10).
import { chiaveMese, oraLocale, type CellaDoc } from '@turni/domain';
import type { BancaOreSalvata } from '../../dati/banca-ore.repo';
import type { RiepilogoDelDipendente } from '../../dati/riepiloghi.repo';
import { montaBancaOre } from '../../test/monta-banca-ore';
import { cellaConTurno, rigaSalvata, testoDi } from '../../test/monta-griglia';

const BIANCHI = 'd2';

const BANCA: BancaOreSalvata = {
  dipendenteId: BIANCHI,
  anno: 2026,
  riportoMinuti: 720,
  mesi: {
    '01': { minutiLavorati: 9282, minutiDovuti: 9072, saldoMinuti: 210, definitivo: true },
    '02': { minutiLavorati: 8208, minutiDovuti: 8640, saldoMinuti: -432, definitivo: true },
    '11': { minutiLavorati: 8712, minutiDovuti: 8640, saldoMinuti: 72, definitivo: false },
  },
  saldoAnnoMinuti: 570,
  saldoDefinitivoMinuti: 498,
  provvisorio: true,
};

function riepilogo(
  chiave: string,
  extra: Partial<RiepilogoDelDipendente> = {},
): RiepilogoDelDipendente {
  return {
    dipendenteId: BIANCHI,
    chiaveMese: chiaveMese(chiave),
    statoMese: 'convalidato',
    valida: true,
    variazioni: 0,
    minutiVariazioni: 0,
    assenzePerCodice: {},
    ...extra,
  };
}

const RIEPILOGHI: readonly RiepilogoDelDipendente[] = [
  riepilogo('2026-01', { assenzePerCodice: { F: 2 } }),
  riepilogo('2026-02', { assenzePerCodice: { MA: 3, F: 1 } }),
  riepilogo('2026-03', { valida: false }),
  riepilogo('2026-11', { statoMese: 'bozza', variazioni: 1, minutiVariazioni: 30 }),
];

const CELLA_VARIATA: CellaDoc = {
  ...cellaConTurno('M1'),
  orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:30') },
};

const opzioni = {
  url: `/reparti/r1/banca-ore/${BIANCHI}?anno=2026`,
  banche: () => Promise.resolve([BANCA]),
  riepiloghi: RIEPILOGHI,
  righe: { '2026-11': rigaSalvata(BIANCHI, { '05': CELLA_VARIATA }) },
};

const righeTabella = (radice: HTMLElement, selettore: string): string[][] =>
  Array.from(radice.querySelectorAll(`${selettore} tbody tr`)).map((r) =>
    Array.from(r.querySelectorAll('th, td')).map((c) => testoDi(c)),
  );

describe('Dettaglio del dipendente (U10): ore, variazioni, assenze', () => {
  it('l’intestazione dice nome, ore e riporto, saldo dell’anno provvisorio e il definitivo', async () => {
    const t = await montaBancaOre(opzioni);
    const r = t.radice();
    expect(testoDi(r.querySelector('[data-nome]') as Element)).toBe('Bianchi Laura');
    expect(testoDi(r.querySelector('[data-sottotitolo]') as Element)).toBe('36,0 h settimanali');
    const riepilogo = testoDi(r.querySelector('[data-riepilogo]') as Element);
    expect(riepilogo).toContain('Riporto dal 2025: +12,0 h');
    expect(riepilogo).toContain('Saldo 2026: ≈ +9,5 h (provvisorio)');
    expect(riepilogo).toContain('di cui definitivo: +8,3 h');
    expect(r.querySelector('a[href^="/reparti/r1/banca-ore?anno=2026"]')).not.toBeNull();
    expect(r.querySelector('a[href="/reparti/r1/dipendenti/d2/anagrafica"]')).not.toBeNull();
  });

  it('per mese: dovute, lavorate e saldo con lo stato; il mese non creato e quello escluso sono distinti', async () => {
    const t = await montaBancaOre(opzioni);
    const righe = righeTabella(t.radice(), '[data-ore-mese]');
    expect(righe).toHaveLength(12);
    expect(righe[0]).toEqual(['Gennaio', '151,2', '154,7', '+3,5', 'convalidato']);
    expect(righe[1]).toEqual(['Febbraio', '144,0', '136,8', '−7,2', 'convalidato']);
    // Marzo ha un riepilogo non valido: escluso dal saldo, non «non creato».
    expect(righe[2]).toEqual(['Marzo', '—', '—', '—', 'escluso: dati non validi']);
    expect(righe[3]).toEqual(['Aprile', '—', '—', '—', 'non creato']);
    expect(righe[10]).toEqual(['Novembre', '144,0', '145,2', '≈+1,2', 'bozza']);
    const novembre = t.radice().querySelector('[data-saldo="2026-11"]') as HTMLElement;
    expect(novembre.classList.contains('italic')).toBe(true);
    expect(novembre.classList.contains('text-credito')).toBe(true);
    expect((t.radice().querySelector('[data-saldo="2026-02"]') as HTMLElement).classList).toContain(
      'text-debito',
    );
  });

  it('l’elenco delle variazioni viene dalle righe dei soli mesi che ne hanno', async () => {
    const t = await montaBancaOre(opzioni);
    expect(t.righeLette).toEqual(['2026-11']);
    expect(righeTabella(t.radice(), '[data-variazioni]')).toEqual([
      ['05/11/2026', 'M1', '07:00–14:00', '07:00–14:30', '+30 min'],
    ]);
  });

  it('assenze per tipologia con il totale dei giorni, nell’ordine della configurazione', async () => {
    const t = await montaBancaOre(opzioni);
    const righe = righeTabella(t.radice(), '[data-assenze]');
    // Ordine di ASSENZE: R, MA, F. Nessun riposo nell'anno.
    expect(righe.map((r) => r[0])).toEqual(['MA', 'F']);
    const malattia = righe[0] ?? [];
    expect(malattia.slice(0, 2)).toEqual(['MA', 'Malattia']);
    expect(malattia[2]).toBe('0');
    expect(malattia[3]).toBe('3');
    expect(malattia.at(-1)).toBe('3');
    const ferie = righe[1] ?? [];
    expect(ferie[2]).toBe('2');
    expect(ferie[3]).toBe('1');
    expect(ferie.at(-1)).toBe('3');
  });

  it('senza variazioni né assenze lo dice; il dipendente inesistente porta alla banca ore', async () => {
    const t = await montaBancaOre({ ...opzioni, riepiloghi: [riepilogo('2026-01')], righe: {} });
    expect(testoDi(t.radice().querySelector('[data-nessuna-variazione]') as Element)).toBe(
      'Nessuna variazione di orario nell’anno',
    );
    expect(testoDi(t.radice().querySelector('[data-nessuna-assenza]') as Element)).toBe(
      'Nessuna assenza nell’anno',
    );
    const assente = await montaBancaOre({
      ...opzioni,
      url: '/reparti/r1/banca-ore/zzz?anno=2026',
      riepiloghi: [],
    });
    expect(testoDi(assente.radice())).toContain('Dipendente non trovato.');
  });

  it('cambiando anno rilegge banca ore e riepiloghi di quell’anno', async () => {
    const t = await montaBancaOre(opzioni);
    (t.radice().querySelector('[aria-label="Anno precedente"]') as HTMLElement).click();
    await t.assesta();
    expect(t.richiesteBanca.at(-1)).toBe(2025);
    expect(testoDi(t.radice().querySelector('[data-anno]') as Element)).toBe('2025');
  });

  it('errore di lettura: messaggio e «Riprova»', async () => {
    let chiamate = 0;
    const t = await montaBancaOre({
      ...opzioni,
      banche: () =>
        ++chiamate === 1 ? Promise.reject(new Error('rete')) : Promise.resolve([BANCA]),
    });
    expect(testoDi(t.radice().querySelector('[role="alert"]') as Element)).toContain(
      'Impossibile caricare il dettaglio.',
    );
    (
      Array.from(t.radice().querySelectorAll('button')).find(
        (b) => testoDi(b) === 'Riprova',
      ) as HTMLElement
    ).click();
    await t.assesta();
    expect(testoDi(t.radice().querySelector('[data-nome]') as Element)).toBe('Bianchi Laura');
  });

  it('un turno scoperto o senza variazione reale non è una variazione', async () => {
    const t = await montaBancaOre({
      ...opzioni,
      righe: {
        '2026-11': rigaSalvata(BIANCHI, {
          '05': {
            ...cellaConTurno('M1'),
            orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:00') },
          },
          '06': cellaConTurno('P1'),
        }),
      },
    });
    expect(righeTabella(t.radice(), '[data-variazioni]')).toEqual([]);
  });
});
