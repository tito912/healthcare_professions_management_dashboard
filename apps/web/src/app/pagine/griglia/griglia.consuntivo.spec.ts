// Test di componente dello step 2.3 (PIANO 2.3 criteri 1, 5, 6, 8): dettaglio della reperibilità, storico delle
// festività, convalida e stampa, con la pagina vera e repository, funzioni e dialoghi finti.
import {
  chiaveMese,
  codiceTurno,
  type ChiaveGiorno,
  type RiepilogoPerStorico,
} from '@turni/domain';
import {
  DIPENDENTI,
  cellaConReperibilita,
  cellaConTurno,
  mese,
  montaGriglia,
  pulsante,
  type OpzioniGriglia,
  rigaSalvata,
  testoDi,
} from '../../test/monta-griglia';
import type { MeseSalvato } from '../../dati/mesi.repo';

const BIANCHI = 'd2';
const NERI = 'd3';
const ROSSI = 'd1';

type Montata = Awaited<ReturnType<typeof montaGriglia>>;

async function clic(t: Montata, id: string, giorno: string): Promise<void> {
  t.cella(id, giorno).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

const fascia = (t: Montata): string =>
  testoDi(t.radice().querySelector('app-fascia-stato') as Element);

const pannello = (t: Montata): HTMLElement | null =>
  t.radice().querySelector<HTMLElement>('app-pannello-dettaglio');

/** Apre il menu della cella e sceglie «Dettaglio reperibilità…». */
async function apriDettaglio(t: Montata, id: string, giorno: string): Promise<HTMLElement> {
  await clic(t, id, giorno);
  await t.tasto(t.cella(id, giorno), 'Enter');
  const voce = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((v) =>
    testoDi(v).includes('Dettaglio reperibilità'),
  );
  if (voce === undefined) {
    throw new Error('Voce «Dettaglio reperibilità…» non trovata');
  }
  voce.click();
  await t.assesta();
  const aperto = pannello(t);
  if (aperto === null) {
    throw new Error('Il pannello non si è aperto');
  }
  return aperto;
}

async function scrivi(t: Montata, campo: HTMLInputElement, valore: string): Promise<void> {
  campo.value = valore;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  await t.assesta();
}

async function attiva(t: Montata, casella: HTMLInputElement): Promise<void> {
  casella.checked = true;
  casella.dispatchEvent(new Event('change', { bubbles: true }));
  await t.assesta();
}

const campoDurata = (p: HTMLElement): HTMLInputElement =>
  p.querySelector<HTMLInputElement>('input[type="number"]') as HTMLInputElement;
const campoOra = (p: HTMLElement): HTMLInputElement =>
  p.querySelector<HTMLInputElement>('input[type="time"]') as HTMLInputElement;
const casellaChiamata = (p: HTMLElement): HTMLInputElement =>
  p.querySelector<HTMLInputElement>('input[type="checkbox"]') as HTMLInputElement;
const applica = (p: HTMLElement): HTMLButtonElement => pulsante(p, 'Applica') as HTMLButtonElement;

const conReperibilita = (giorno: ChiaveGiorno, ...codici: string[]) => ({
  '2026-11': DIPENDENTI.map((d) =>
    d.id === ROSSI
      ? rigaSalvata(ROSSI, { [giorno]: cellaConReperibilita(...codici) })
      : rigaSalvata(d.id),
  ),
});

describe('Griglia 2.3: dettaglio della reperibilità (UX §9.11, L21, L38)', () => {
  it('il menu offre «Dettaglio reperibilità…» solo se la cella ha una reperibilità', async () => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    await clic(t, ROSSI, '11');
    await t.tasto(t.cella(ROSSI, '11'), 'Enter');
    expect(testoDi(document.querySelector('[role="menu"]') as Element)).not.toContain('Dettaglio');
    await t.tasto(document.querySelector('[role="menu"]') as Element, 'Escape');
    await apriDettaglio(t, ROSSI, '10');
    expect(testoDi(pannello(t) as Element)).toContain('R1 Reperibilità pomeriggio · 14:00–20:00');
  });

  it('registra la chiamata come modifica non salvata e «Salva bozza» la scrive; il segno sta nell’angolo', async () => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    const p = await apriDettaglio(t, ROSSI, '10');
    expect(applica(p).disabled).toBe(true);
    await attiva(t, casellaChiamata(p));
    await scrivi(t, campoDurata(p), '45');
    await scrivi(t, campoOra(p), '15:30');
    expect(applica(p).disabled).toBe(false);
    applica(p).click();
    await t.assesta();
    expect(pannello(t)).toBeNull();
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    // Solo reperibilità: nessun chip, il triangolo di chiamata sta nell'angolo in alto a sinistra della cella.
    const angolo = t.cella(ROSSI, '10').querySelector<HTMLElement>('span.top-0.left-0');
    expect(angolo).not.toBeNull();
    expect(angolo?.style.borderTop).toContain('solid');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    const riga = t.salvataggi[0]?.righe.find((r) => r.dipendenteId === ROSSI);
    expect(riga?.giorni['10']?.reperibilita[0]?.chiamate).toEqual([
      { durataMinuti: 45, oraInizio: '15:30' },
    ]);
  });

  it('applicare è annullabile con Ctrl+Z come un solo passo', async () => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    const p = await apriDettaglio(t, ROSSI, '10');
    await attiva(t, casellaChiamata(p));
    await scrivi(t, campoDurata(p), '20');
    applica(p).click();
    await t.assesta();
    await t.tasto(t.cella(ROSSI, '10'), 'z', { ctrlKey: true });
    expect(fascia(t)).toContain('Bozza: tutto salvato');
  });

  it.each([
    ['durata 0', '0', '', 'Indica una durata da 1 a 360 minuti'],
    ['durata oltre la fascia (361 su 360)', '361', '', 'Indica una durata da 1 a 360 minuti'],
    ['durata vuota', '', '', 'Indica una durata da 1 a 360 minuti'],
    ['ora prima della fascia', '30', '13:59', 'deve cadere nella fascia 14:00–20:00'],
    ['ora alla fine della fascia', '30', '20:00', 'deve cadere nella fascia 14:00–20:00'],
  ])('rifiuta: %s', async (_nome, durata, ora, messaggio) => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    const p = await apriDettaglio(t, ROSSI, '10');
    await attiva(t, casellaChiamata(p));
    await scrivi(t, campoDurata(p), durata);
    await scrivi(t, campoOra(p), ora);
    expect(testoDi(p)).toContain(messaggio);
    expect(applica(p).disabled).toBe(true);
  });

  it('accetta 360 minuti e l’inizio esatto della fascia', async () => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    const p = await apriDettaglio(t, ROSSI, '10');
    await attiva(t, casellaChiamata(p));
    await scrivi(t, campoDurata(p), '360');
    await scrivi(t, campoOra(p), '14:00');
    expect(applica(p).disabled).toBe(false);
  });

  it('con l’ora di inizio l’avviso di riposo si ricalcola (D8): anteprima e pannello Avvisi', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '05': cellaConReperibilita('R2'),
                '06': cellaConTurno('M1'),
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    const p = await apriDettaglio(t, ROSSI, '05');
    await attiva(t, casellaChiamata(p));
    await scrivi(t, campoDurata(p), '180');
    // Senza l'ora di inizio la chiamata non interrompe il riposo.
    expect(testoDi(p)).not.toContain('Riposo di');
    await scrivi(t, campoOra(p), '23:00');
    // La chiamata finisce alle 02:00 del 6; il turno M1 comincia alle 07:00: 5 ore di riposo.
    expect(testoDi(p)).toContain('Dopo l’applicazione');
    expect(testoDi(p)).toContain('Riposo di 5 ore tra il 5 e il 6');
    applica(p).click();
    await t.assesta();
    expect(testoDi(t.radice().querySelector('[aria-expanded]') as Element)).toBeDefined();
    pulsante(t.radice(), 'Avvisi').click();
    await t.assesta();
    const voci = Array.from(t.radice().querySelectorAll('app-pannello-avvisi li')).map(testoDi);
    expect(voci.some((v) => v.includes('Riposo di 5 ore tra il 5 e il 6'))).toBe(true);
  });

  it('togliere la casella rimuove la chiamata', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '10': {
                  ...cellaConReperibilita('R1'),
                  reperibilita: [
                    {
                      ...cellaConReperibilita('R1').reperibilita[0]!,
                      chiamate: [{ durataMinuti: 45, oraInizio: null }],
                    },
                  ],
                },
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    const p = await apriDettaglio(t, ROSSI, '10');
    expect(casellaChiamata(p).checked).toBe(true);
    expect(campoDurata(p).value).toBe('45');
    casellaChiamata(p).checked = false;
    casellaChiamata(p).dispatchEvent(new Event('change', { bubbles: true }));
    await t.assesta();
    applica(p).click();
    await t.assesta();
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    expect(t.cella(ROSSI, '10').querySelector('span.top-0.left-0')).toBeNull();
  });

  it('Esc chiude il pannello e «Annulla» non cambia nulla', async () => {
    const t = await montaGriglia({ righe: conReperibilita('10', 'R1') });
    const p = await apriDettaglio(t, ROSSI, '10');
    await attiva(t, casellaChiamata(p));
    pulsante(p, 'Annulla').click();
    await t.assesta();
    expect(pannello(t)).toBeNull();
    expect(fascia(t)).toContain('Bozza: tutto salvato');
  });

  it('su un mese convalidato il dettaglio si legge e non si modifica (D2)', async () => {
    const t = await montaGriglia({
      mese: mese('2026-11', 'convalidato'),
      righe: conReperibilita('10', 'R1'),
    });
    await clic(t, ROSSI, '10');
    await t.tasto(t.cella(ROSSI, '10'), 'Enter');
    const voci = Array.from(document.querySelectorAll('[role="menuitem"]')).map(testoDi);
    expect(voci).toEqual(['Dettaglio reperibilità…']);
    (document.querySelector('[role="menuitem"]') as HTMLElement).click();
    await t.assesta();
    const p = pannello(t) as HTMLElement;
    expect(testoDi(p)).toContain('Il mese è in sola lettura');
    expect(p.querySelector('input')).toBeNull();
    expect(Array.from(p.querySelectorAll('button')).some((b) => testoDi(b) === 'Applica')).toBe(
      false,
    );
  });

  it('per l’ADMIN il dettaglio è in sola lettura', async () => {
    const t = await montaGriglia({ ruolo: 'ADMIN', righe: conReperibilita('10', 'R1') });
    await clic(t, ROSSI, '10');
    await t.tasto(t.cella(ROSSI, '10'), 'Enter');
    (document.querySelector('[role="menuitem"]') as HTMLElement).click();
    await t.assesta();
    expect(pannello(t)?.querySelector('input')).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------

function lavorata(
  dipendenteId: string,
  chiave: string,
  idFestivita: string,
  codice = 'M1',
  giorno: '01' | '25' = '01',
): RiepilogoPerStorico {
  return {
    dipendenteId,
    chiaveMese: chiaveMese(chiave),
    anno: Number(chiave.slice(0, 4)),
    festivitaLavorate: [{ idFestivita, giorno, codice: codiceTurno(codice) }],
  };
}

const RIEPILOGHI_OGNISSANTI: readonly RiepilogoPerStorico[] = [
  lavorata(BIANCHI, '2025-11', 'ognissanti', 'M1'),
  lavorata(BIANCHI, '2023-11', 'ognissanti', 'P1'),
  lavorata(NERI, '2024-11', 'ognissanti', 'N1'),
];

/** I conteggi accanto ai nomi: «Nome → ×N». */
function conteggi(t: Montata): Record<string, string> {
  return Object.fromEntries(
    Array.from(t.radice().querySelectorAll('[role="rowheader"]')).map((e) => [
      testoDi(e.querySelector('.truncate') ?? e),
      testoDi(e.querySelector('.w-7') ?? e),
    ]),
  );
}

describe('Griglia 2.3: storico delle festività (U6, UX §9.10)', () => {
  it('con la colonna di un festivo attiva, accanto a ogni nome compare quante volte ha lavorato quel festivo', async () => {
    // Il 1° novembre è Ognissanti: la cella attiva iniziale è nella colonna del festivo.
    const t = await montaGriglia({ riepiloghiStorico: RIEPILOGHI_OGNISSANTI });
    expect(t.richiesteStorico).toEqual(['ognissanti']);
    expect(conteggi(t)).toEqual({
      'Bianchi L.': testoDiConteggio('×2', 2),
      'Bruni E.': testoDiConteggio('×0', 0),
      'Neri G.': testoDiConteggio('×1', 1),
      'Rossi M.': testoDiConteggio('×0', 0),
      'Verdi A.': testoDiConteggio('×0', 0),
    });
    // L'etichetta accessibile dice la festività e il numero.
    const bianchi = t.radice().querySelector('[data-nome="d2"]') as HTMLElement;
    expect(testoDi(bianchi)).toContain('Ha lavorato Ognissanti 2 volte negli ultimi 5 anni');
    const neri = t.radice().querySelector('[data-nome="d3"]') as HTMLElement;
    expect(testoDi(neri)).toContain('Ha lavorato Ognissanti 1 volta negli ultimi 5 anni');
  });

  it('il conteggio sparisce lasciando la colonna e ricompare tornandoci, senza rileggere i dati', async () => {
    const t = await montaGriglia({ riepiloghiStorico: RIEPILOGHI_OGNISSANTI });
    await clic(t, BIANCHI, '05');
    expect(Object.values(conteggi(t)).every((c) => !c.includes('×'))).toBe(true);
    await clic(t, NERI, '01');
    expect(conteggi(t)['Bianchi L.']).toContain('×2');
    expect(t.riepiloghiRepo.festivita).toHaveBeenCalledTimes(1);
  });

  it('un mese senza festivi non legge lo storico', async () => {
    const t = await montaGriglia({
      url: '/reparti/r1/mesi/2026-06',
      oggi: '2026-06-03',
      mese: mese('2026-06'),
      righe: { '2026-06': DIPENDENTI.map((d) => rigaSalvata(d.id)) },
    });
    await clic(t, BIANCHI, '09');
    expect(t.riepiloghiRepo.festivita).not.toHaveBeenCalled();
  });

  it('il dettaglio si apre dall’intestazione con il clic: una riga per anno con nomi e codici', async () => {
    const t = await montaGriglia({ riepiloghiStorico: RIEPILOGHI_OGNISSANTI });
    const intestazione = t
      .radice()
      .querySelector<HTMLElement>('[data-storico="01"]') as HTMLElement;
    expect(intestazione.getAttribute('aria-label')).toContain('Ognissanti');
    intestazione.click();
    await t.assesta();
    const popover = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(testoDi(popover)).toContain('Ognissanti · ultimi 5 anni');
    const righe = Array.from(popover.querySelectorAll('li')).map(testoDi);
    expect(righe).toEqual([
      '2025: Bianchi L. (M1)',
      '2024: Neri G. (N1)',
      '2023: Bianchi L. (P1)',
      '2022: nessuno',
      '2021: nessuno',
    ]);
  });

  it('da tastiera: ↑ dalla prima riga porta all’intestazione, Invio apre il dettaglio, Esc lo chiude', async () => {
    const t = await montaGriglia({ riepiloghiStorico: RIEPILOGHI_OGNISSANTI });
    await clic(t, BIANCHI, '01');
    await t.tasto(t.cella(BIANCHI, '01'), 'ArrowUp');
    const intestazione = t
      .radice()
      .querySelector<HTMLElement>('[data-storico="01"]') as HTMLElement;
    expect(document.activeElement).toBe(intestazione);
    // Invio sul pulsante: il clic nativo apre il dettaglio e non il menu della cella.
    await t.tasto(intestazione, 'Enter');
    intestazione.click();
    await t.assesta();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await t.tasto(document.querySelector('[role="dialog"]') as Element, 'Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(intestazione);
    // ↓ torna alla cella.
    await t.tasto(intestazione, 'ArrowDown');
    expect(document.activeElement).toBe(t.cella(BIANCHI, '01'));
  });

  it('un giorno non festivo non ha il pulsante dello storico', async () => {
    const t = await montaGriglia();
    expect(t.radice().querySelector('[data-storico="05"]')).toBeNull();
    await clic(t, BIANCHI, '05');
    await t.tasto(t.cella(BIANCHI, '05'), 'ArrowUp');
    expect(document.activeElement).toBe(t.cella(BIANCHI, '05'));
  });

  it('errore di lettura: il dettaglio lo dice e permette di riprovare', async () => {
    const t = await montaGriglia({
      riepiloghiStorico: RIEPILOGHI_OGNISSANTI,
      righe: { '2026-12': DIPENDENTI.map((d) => rigaSalvata(d.id)) },
    });
    t.riepiloghiRepo.festivita.mockRejectedValueOnce(new Error('rete'));
    // Un'altra festività: il 1° novembre è già in cache, quindi si cambia mese verso dicembre (Immacolata, 8).
    await t.router.navigateByUrl('/reparti/r1/mesi/2026-12');
    await t.assesta();
    await clic(t, BIANCHI, '08');
    const intestazione = t
      .radice()
      .querySelector<HTMLElement>('[data-storico="08"]') as HTMLElement;
    intestazione.click();
    await t.assesta();
    expect(testoDi(document.querySelector('[role="dialog"]') as Element)).toContain(
      'Lo storico non è disponibile',
    );
    pulsante(document.querySelector('[role="dialog"]') as Element, 'Riprova').click();
    await t.assesta();
    expect(testoDi(document.querySelector('[role="dialog"]') as Element)).toContain(
      'Immacolata Concezione · ultimi 5 anni',
    );
  });
});

function testoDiConteggio(testo: string, n: number): string {
  const nome = 'Ha lavorato Ognissanti';
  return `${testo}${nome} ${n === 1 ? '1 volta' : `${n} volte`} negli ultimi 5 anni`;
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Opzioni di montaggio con un mese che cambia stato quando la convalida riesce: la pagina lo rilegge e `mese` si
 * legge a ogni lettura (getter), non una volta sola.
 */
function conMeseCheSiConvalida(
  opzioni: Omit<OpzioniGriglia, 'mese'>,
  convalida: () => Promise<{ convalidatoIl: number }>,
): OpzioniGriglia {
  const stato: { corrente: MeseSalvato } = { corrente: mese('2026-11') };
  return {
    ...opzioni,
    get mese(): MeseSalvato {
      return stato.corrente;
    },
    convalida: async () => {
      stato.corrente = mese('2026-11', 'convalidato');
      return convalida();
    },
  };
}

describe('Griglia 2.3: convalida (D1, D2, U5, UX §9.8)', () => {
  it('prima della fine del mese il pulsante è disabilitato con il motivo (L5)', async () => {
    const t = await montaGriglia({ oggi: '2026-11-30' });
    const p = pulsante(t.radice(), 'Convalida mese') as HTMLButtonElement;
    expect(p.disabled).toBe(true);
    expect(p.getAttribute('title')).toBe('Potrai convalidare dal 01/12/2026');
    expect(p.getAttribute('aria-label')).toContain('Potrai convalidare dal 01/12/2026');
  });

  it('con modifiche non salvate è disabilitato; dopo «Salva bozza» si abilita', async () => {
    const t = await montaGriglia({ oggi: '2026-12-02' });
    expect((pulsante(t.radice(), 'Convalida mese') as HTMLButtonElement).disabled).toBe(false);
    await clic(t, BIANCHI, '05');
    await t.tasto(t.cella(BIANCHI, '05'), 'm');
    const campo = t
      .radice()
      .querySelector<HTMLInputElement>('input[maxlength="2"]') as HTMLInputElement;
    await scrivi(t, campo, 'M1');
    await t.tasto(campo, 'Enter');
    const convalida = pulsante(t.radice(), 'Convalida mese') as HTMLButtonElement;
    expect(convalida.disabled).toBe(true);
    expect(convalida.getAttribute('title')).toBe('Salva prima le modifiche');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect((pulsante(t.radice(), 'Convalida mese') as HTMLButtonElement).disabled).toBe(false);
  });

  it('distinto da «Salva bozza»: il clic apre il dialogo e non chiama il server finché non si conferma', async () => {
    const t = await montaGriglia({ oggi: '2026-12-02' });
    t.dialoghi.apri.mockResolvedValueOnce(undefined);
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(t.dialoghi.apri).toHaveBeenCalledTimes(1);
    expect(t.convalide).toEqual([]);
    expect(t.salvataggi).toEqual([]);
  });

  it('il dialogo riceve gli avvisi aperti e il nome del mese', async () => {
    const t = await montaGriglia({
      oggi: '2026-12-02',
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, { '05': cellaConTurno('N1'), '06': cellaConTurno('M1') })
            : rigaSalvata(d.id),
        ),
      },
    });
    t.dialoghi.apri.mockResolvedValueOnce(undefined);
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    const dati = t.dialoghi.apri.mock.calls[0]?.[1] as unknown as {
      mese: string;
      voci: { codice: string; livello: string }[];
    };
    expect(dati.mese).toBe('novembre 2026');
    // N1 del 5 finisce alle 07:00 del 6 e M1 comincia alle 07:00: riposo 0, un avviso (e N1 escluso per Rossi).
    expect(dati.voci.map((v) => v.codice)).toContain('riposoInsufficiente');
  });

  it('conferma: chiama convalidaMese, rilegge il mese e la fascia dichiara la sola lettura', async () => {
    const t = await montaGriglia(
      conMeseCheSiConvalida({ oggi: '2026-12-02', esitoDialogo: { tipo: 'convalida' } }, () =>
        Promise.resolve({ convalidatoIl: 1796285640000 }),
      ),
    );
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(t.convalide).toEqual([{ repartoId: 'r1', chiaveMese: '2026-11' }]);
    expect(fascia(t)).toMatch(/Convalidato il .* da Maria Rossi: sola lettura/);
    for (const testo of ['Salva bozza', 'Convalida mese']) {
      const p = pulsante(t.radice(), testo) as HTMLButtonElement;
      expect(p.disabled).toBe(true);
      expect(p.getAttribute('title')).toBe('Mese convalidato');
    }
    // Sola lettura totale: il pennello non c'è e digitare in una cella non scrive.
    expect(t.radice().querySelector('app-barra-pennello')).toBeNull();
  });

  it.each([
    ['MESE_NON_CONCLUSO', 'Il mese non è ancora concluso.'],
    ['ERRORE_INTERNO', 'La convalida non è riuscita'],
  ])('errore %s: messaggio e il mese resta una bozza', async (codice, messaggio) => {
    const t = await montaGriglia({
      oggi: '2026-12-02',
      esitoDialogo: { tipo: 'convalida' },
      convalida: () =>
        Promise.reject({ code: 'functions/failed-precondition', details: { codice } }),
    });
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(t.toast.messaggi().at(-1)?.testo).toContain(messaggio);
    expect(fascia(t)).toContain('Bozza');
    expect((pulsante(t.radice(), 'Convalida mese') as HTMLButtonElement).disabled).toBe(false);
  });

  it('RIGHE_NON_VALIDE: apre il pannello Avvisi con le righe da correggere', async () => {
    const t = await montaGriglia({
      oggi: '2026-12-02',
      esitoDialogo: { tipo: 'convalida' },
      convalida: () =>
        Promise.reject({
          code: 'functions/failed-precondition',
          details: { codice: 'RIGHE_NON_VALIDE', righe: [BIANCHI] },
        }),
    });
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    const voci = Array.from(t.radice().querySelectorAll('app-pannello-avvisi li')).map(testoDi);
    expect(voci).toEqual([expect.stringContaining('Bianchi L.')]);
    expect(testoDi(t.radice().querySelector('app-pannello-avvisi') as Element)).toContain(
      'dati non validi o incoerenti',
    );
  });

  it('dal riepilogo si va alla cella: il dialogo restituisce la cella e la griglia la seleziona', async () => {
    const t = await montaGriglia({
      oggi: '2026-12-02',
      esitoDialogo: { tipo: 'vai', cella: { dipendenteId: NERI, giorno: '12' } },
    });
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(t.convalide).toEqual([]);
    expect(t.radice().querySelector('[role="gridcell"][tabindex="0"]')).toBe(t.cella(NERI, '12'));
  });

  it('un mese già convalidato dal server ricarica la pagina in sola lettura', async () => {
    const t = await montaGriglia(
      conMeseCheSiConvalida({ oggi: '2026-12-02', esitoDialogo: { tipo: 'convalida' } }, () =>
        Promise.reject({
          code: 'functions/failed-precondition',
          details: { codice: 'MESE_GIA_CONVALIDATO' },
        }),
      ),
    );
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(fascia(t)).toContain('sola lettura');
  });

  it('per l’ADMIN il pulsante non esiste (L23)', async () => {
    const t = await montaGriglia({ ruolo: 'ADMIN', oggi: '2026-12-02' });
    expect(testoDi(t.radice())).not.toContain('Convalida mese');
  });
});

// ---------------------------------------------------------------------------------------------------------------

describe('Griglia 2.3: stampa del mese (D16, UX §9.12)', () => {
  const stampaDi = (): HTMLElement | null => document.body.querySelector('.stampa-radice');

  it('al beforeprint nasce la tabella del mese intero, all’afterprint sparisce', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '03': cellaConTurno('M1'),
                '10': { ...cellaConReperibilita('R1', 'R2') },
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    expect(stampaDi()).toBeNull();
    window.dispatchEvent(new Event('beforeprint'));
    const radice = stampaDi() as HTMLElement;
    expect(radice).not.toBeNull();
    expect(radice.parentElement).toBe(document.body);
    expect(testoDi(radice)).toContain('Radiologia · Novembre 2026');
    expect(testoDi(radice)).toContain('Stato: bozza, non convalidato');
    expect(testoDi(radice)).toMatch(/Stampato il \d{2}\/\d{2}\/\d{4} alle \d{2}:\d{2}/);
    // Sempre il mese intero, qualunque sia la vista: 5 righe, 30 giorni + nome + 4 totali.
    expect(radice.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(radice.querySelectorAll('tbody tr')[0]?.querySelectorAll('td')).toHaveLength(34);
    expect(radice.querySelectorAll('thead th')).toHaveLength(35);
    // Il codice del turno, le reperibilità come codici piccoli, la legenda.
    const rossi = Array.from(radice.querySelectorAll('tbody tr')).find((r) =>
      testoDi(r).startsWith('Rossi Maria'),
    ) as HTMLElement;
    expect(testoDi(rossi)).toContain('M1');
    expect(rossi.querySelector('.stampa-rep')?.textContent).toBe('R1 R2');
    expect(testoDi(radice.querySelector('.stampa-legenda') as Element)).toContain(
      'Mattina 07:00–14:00',
    );
    expect(testoDi(radice.querySelector('.stampa-legenda') as Element)).toContain('☎ chiamata');
    window.dispatchEvent(new Event('afterprint'));
    expect(stampaDi()).toBeNull();
    t.harness.detectChanges();
  });

  it('il mese convalidato porta «Convalidato il … da …» nell’intestazione', async () => {
    await montaGriglia({ mese: mese('2026-11', 'convalidato') });
    window.dispatchEvent(new Event('beforeprint'));
    expect(testoDi(stampaDi() as Element)).toMatch(
      /Stato: convalidato il \d{2}\/\d{2}\/\d{4} alle \d{2}:\d{2} da Maria Rossi/,
    );
    window.dispatchEvent(new Event('afterprint'));
  });

  it('la stampa include le modifiche non salvate e lo dichiara', async () => {
    const t = await montaGriglia();
    await clic(t, BIANCHI, '05');
    await t.tasto(t.cella(BIANCHI, '05'), 'm');
    const campo = t
      .radice()
      .querySelector<HTMLInputElement>('input[maxlength="2"]') as HTMLInputElement;
    await scrivi(t, campo, 'M1');
    await t.tasto(campo, 'Enter');
    window.dispatchEvent(new Event('beforeprint'));
    expect(testoDi(stampaDi() as Element)).toContain('Bozza: 1 modifica non salvata');
    window.dispatchEvent(new Event('afterprint'));
  });

  it('il pulsante «Stampa» apre il dialogo di stampa del browser', async () => {
    const t = await montaGriglia();
    const stampa = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    pulsante(t.radice(), 'Stampa').click();
    expect(stampa).toHaveBeenCalledTimes(1);
    stampa.mockRestore();
  });

  it('uscendo dalla pagina non resta nulla in `<body>` né ascoltatori', async () => {
    const t = await montaGriglia();
    window.dispatchEvent(new Event('beforeprint'));
    expect(stampaDi()).not.toBeNull();
    t.harness.fixture.destroy();
    expect(stampaDi()).toBeNull();
    window.dispatchEvent(new Event('beforeprint'));
    expect(stampaDi()).toBeNull();
  });
});
