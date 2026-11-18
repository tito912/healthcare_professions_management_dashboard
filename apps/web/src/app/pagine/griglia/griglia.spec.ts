// Test di componente della griglia (PIANO 2.2 criterio 11): la pagina vera con repository e dialoghi finti.
import { TestBed } from '@angular/core/testing';
import { dataISO, type ChiaveGiorno } from '@turni/domain';
import { vi } from 'vitest';
import { Inattivita } from '../../core/inattivita.service';
import { ErroreSalvataggio } from '../../dati/righe.repo';
import {
  DIPENDENTI,
  cellaConReperibilita,
  cellaConTurno,
  dipendente,
  mese,
  montaGriglia,
  pulsante,
  rigaSalvata,
  testoDi,
} from '../../test/monta-griglia';

// Ordine delle righe: Bianchi (d2), Bruni (d5), Neri (d3), Rossi (d1, esclude N1), Verdi (d4).
const BIANCHI = 'd2';
const BRUNI = 'd5';
const NERI = 'd3';
const ROSSI = 'd1';
const VERDI = 'd4';

type Montata = Awaited<ReturnType<typeof montaGriglia>>;

/** Un clic del mouse su una cella: la seleziona e la rende attiva. */
async function clic(
  t: Montata,
  id: string,
  giorno: string,
  extra: MouseEventInit = {},
): Promise<void> {
  const cella = t.cella(id, giorno);
  cella.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, ...extra }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

const attivaDi = (t: Montata): HTMLElement | null =>
  t.radice().querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]');

/** Scrive un codice nella cella attiva con l'inserimento veloce e conferma con Invio. */
async function inserisci(
  t: Montata,
  id: string,
  giorno: string,
  codice: string,
): Promise<KeyboardEvent> {
  await clic(t, id, giorno);
  await t.tasto(t.cella(id, giorno), codice.charAt(0));
  const campo = t.radice().querySelector<HTMLInputElement>('input[maxlength="2"]');
  if (campo === null) {
    throw new Error('Il campo di inserimento non è comparso');
  }
  campo.value = codice;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  return t.tasto(campo, 'Enter');
}

const fascia = (t: Montata): string =>
  testoDi(t.radice().querySelector('app-fascia-stato') as Element);
const avvisiAperti = (t: Montata): string[] =>
  Array.from(t.radice().querySelectorAll('app-pannello-avvisi li')).map(testoDi);

describe('Griglia: struttura e accessibilità (UX §10)', () => {
  it('una riga per dipendente in ordine di cognome, 30 giorni, 4 totali a destra', async () => {
    const t = await montaGriglia();
    expect(Array.from(t.radice().querySelectorAll('[role="rowheader"]')).map(testoDi)).toEqual([
      'Bianchi L.',
      'Bruni E.',
      'Neri G.',
      'Rossi M.',
      'Verdi A.',
    ]);
    const riga = t.radice().querySelector('[data-riga="d1"]') as HTMLElement;
    expect(riga.querySelectorAll('[role="gridcell"][data-g]')).toHaveLength(30);
    expect(riga.querySelectorAll('.totale')).toHaveLength(4);
  });

  it('ruoli ARIA di una griglia, intestazioni, descrizione e una sola cella nell’ordine di tabulazione', async () => {
    const t = await montaGriglia();
    const griglia = t.radice().querySelector('[role="grid"]') as HTMLElement;
    expect(griglia.getAttribute('aria-rowcount')).toBe('6');
    expect(griglia.getAttribute('aria-colcount')).toBe('35');
    expect(griglia.getAttribute('aria-readonly')).toBeNull();
    expect(t.radice().querySelectorAll('[role="row"]')).toHaveLength(6);
    expect(t.radice().querySelectorAll('[role="columnheader"]')).toHaveLength(35);
    const descrizione = t.radice().querySelector(`#${griglia.getAttribute('aria-describedby')}`);
    expect(testoDi(descrizione as Element)).toContain(
      'Ctrl+Fine e poi Tab per uscire dalla griglia',
    );
    expect(t.radice().querySelectorAll('[role="gridcell"][data-g][tabindex="0"]')).toHaveLength(1);
    expect(t.cella(ROSSI, '03').getAttribute('aria-label')).toBe(
      'Rossi M., martedì 3 novembre 2026: vuota',
    );
    // Intestazione: giorno, iniziale e «oggi» (2026-11-03).
    const tre = t.radice().querySelector('[role="columnheader"][data-g="03"]') as HTMLElement;
    expect(tre.getAttribute('aria-label')).toBe('martedì 3 novembre 2026, oggi');
  });

  it('i totali di riga: ore pianificate, dovute, differenza con il vero segno meno e reperibilità', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '03': cellaConTurno('M1'),
                '04': cellaConTurno('M1'),
                '05': cellaConTurno('M1'),
                '06': cellaConTurno('M1'),
                '09': cellaConTurno('M1'),
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    const totali = Array.from(
      (t.radice().querySelector('[data-riga="d1"]') as HTMLElement).querySelectorAll('.totale'),
    ).map(testoDi);
    // 5 turni M1 da 6,5 h; 21 feriali a 7,2 h; differenza negativa.
    expect(totali).toEqual(['32,5', '151,2', '−118,7', '0,0']);
  });
});

describe('Griglia: tastiera come in un foglio di calcolo (UX §9.2)', () => {
  it('le frecce, Home, Fine e Ctrl+Fine spostano la cella attiva e il focus', async () => {
    const t = await montaGriglia();
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '01'));
    await t.tasto(t.cella(BIANCHI, '01'), 'ArrowRight');
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '02'));
    expect(document.activeElement).toBe(t.cella(BIANCHI, '02'));
    await t.tasto(t.cella(BIANCHI, '02'), 'ArrowDown');
    expect(attivaDi(t)).toBe(t.cella(BRUNI, '02'));
    await t.tasto(t.cella(BRUNI, '02'), 'End');
    expect(attivaDi(t)).toBe(t.cella(BRUNI, '30'));
    await t.tasto(t.cella(BRUNI, '30'), 'Home');
    expect(attivaDi(t)).toBe(t.cella(BRUNI, '01'));
    await t.tasto(t.cella(BRUNI, '01'), 'End', { ctrlKey: true });
    expect(attivaDi(t)).toBe(t.cella(VERDI, '30'));
    await t.tasto(t.cella(VERDI, '30'), 'Home', { ctrlKey: true });
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '01'));
    // Ai bordi la cella attiva non esce dalla griglia.
    await t.tasto(t.cella(BIANCHI, '01'), 'ArrowUp');
    await t.tasto(t.cella(BIANCHI, '01'), 'ArrowLeft');
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '01'));
  });

  it('Tab va alla cella a destra (a fine riga alla successiva); sull’ultima cella la griglia si lascia', async () => {
    const t = await montaGriglia();
    const tab = await t.tasto(t.cella(BIANCHI, '01'), 'Tab');
    expect(tab.defaultPrevented).toBe(true);
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '02'));
    await t.tasto(t.cella(BIANCHI, '02'), 'End');
    await t.tasto(t.cella(BIANCHI, '30'), 'Tab');
    expect(attivaDi(t)).toBe(t.cella(BRUNI, '01'));
    await t.tasto(t.cella(BRUNI, '01'), 'End', { ctrlKey: true });
    const fuori = await t.tasto(t.cella(VERDI, '30'), 'Tab');
    expect(fuori.defaultPrevented).toBe(false);
    expect(attivaDi(t)).toBe(t.cella(VERDI, '30'));
    await t.tasto(t.cella(VERDI, '30'), 'Home', { ctrlKey: true });
    const indietro = await t.tasto(t.cella(BIANCHI, '01'), 'Tab', { shiftKey: true });
    expect(indietro.defaultPrevented).toBe(false);
  });

  it('Maiusc+frecce estendono l’intervallo e la barra dice quante celle sono selezionate', async () => {
    const t = await montaGriglia();
    await clic(t, BRUNI, '05');
    await t.tasto(t.cella(BRUNI, '05'), 'ArrowRight', { shiftKey: true });
    await t.tasto(t.cella(BRUNI, '06'), 'ArrowDown', { shiftKey: true });
    expect(testoDi(t.radice().querySelector('app-barra-pennello') as Element)).toContain(
      'Selezione: 4 celle',
    );
    expect(t.cella(BRUNI, '05').getAttribute('aria-selected')).toBe('true');
    expect(t.cella(NERI, '06').getAttribute('aria-selected')).toBe('true');
    expect(t.cella(NERI, '07').getAttribute('aria-selected')).toBeNull();
    await t.tasto(t.cella(NERI, '06'), 'Escape');
    expect(testoDi(t.radice().querySelector('app-barra-pennello') as Element)).toContain(
      'Selezione: 1 cella',
    );
  });

  it('riga e colonna della cella attiva sono evidenziate', async () => {
    const t = await montaGriglia();
    await clic(t, NERI, '07');
    expect(t.cella(NERI, '10').classList.contains('ev-riga')).toBe(true);
    expect(t.cella(VERDI, '07').classList.contains('ev-col')).toBe(true);
    expect(t.cella(VERDI, '08').classList.contains('ev-col')).toBe(false);
    expect(
      t
        .radice()
        .querySelector('[role="columnheader"][data-g="07"]')
        ?.classList.contains('ev-intestazione'),
    ).toBe(true);
    expect(t.radice().querySelector('[data-nome="d3"]')?.classList.contains('ev-nome')).toBe(true);
  });
});

describe('Griglia: inserimento veloce (U3, U7)', () => {
  it('un turno escluso risponde con il motivo e resta in inserimento; poi un codice ammesso conferma e scende', async () => {
    const t = await montaGriglia();
    await clic(t, ROSSI, '03');
    await t.tasto(t.cella(ROSSI, '03'), 'n');
    const campo = t.radice().querySelector('input[maxlength="2"]') as HTMLInputElement;
    expect(campo.value).toBe('N');
    campo.value = 'N1';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.tasto(campo, 'Enter');
    expect(testoDi(t.radice().querySelector('[role="alert"]') as Element)).toBe(
      'N1 escluso per Rossi M.',
    );
    expect(t.radice().querySelector('input[maxlength="2"]')).not.toBeNull();
    expect(attivaDi(t)).toBe(t.cella(ROSSI, '03'));

    const stesso = t.radice().querySelector('input[maxlength="2"]') as HTMLInputElement;
    stesso.value = 'm1';
    stesso.dispatchEvent(new Event('input', { bubbles: true }));
    await t.tasto(stesso, 'Enter');
    expect(t.radice().querySelector('input[maxlength="2"]')).toBeNull();
    expect(testoDi(t.cella(ROSSI, '03'))).toContain('M1');
    expect(attivaDi(t)).toBe(t.cella(VERDI, '03'));
    expect(document.activeElement).toBe(t.cella(VERDI, '03'));
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    expect(testoDi(t.radice().querySelector('[data-nome="d1"]') as Element)).toContain(
      'modifiche non salvate',
    );
  });

  it('Tab conferma e va a destra, Maiusc+Invio a sinistra… sopra, Esc annulla senza cambiare nulla', async () => {
    const t = await montaGriglia();
    await clic(t, BRUNI, '10');
    await t.tasto(t.cella(BRUNI, '10'), 'p');
    const campo = t.radice().querySelector('input[maxlength="2"]') as HTMLInputElement;
    campo.value = 'P1';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.tasto(campo, 'Tab');
    expect(testoDi(t.cella(BRUNI, '10'))).toContain('P1');
    expect(attivaDi(t)).toBe(t.cella(BRUNI, '11'));

    await t.tasto(t.cella(BRUNI, '11'), 'm');
    const secondo = t.radice().querySelector('input[maxlength="2"]') as HTMLInputElement;
    await t.tasto(secondo, 'Escape');
    expect(t.radice().querySelector('input[maxlength="2"]')).toBeNull();
    expect(testoDi(t.cella(BRUNI, '11'))).not.toContain('M1');
    expect(document.activeElement).toBe(t.cella(BRUNI, '11'));
  });

  it('i messaggi di rifiuto: codice inesistente, già presente, terza reperibilità', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '10': cellaConReperibilita('R1', 'R2'),
                '11': cellaConReperibilita('R1'),
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    const messaggio = async (id: string, giorno: string, codice: string): Promise<string> => {
      await inserisci(t, id, giorno, codice);
      const testo = testoDi(t.radice().querySelector('[role="alert"]') as Element);
      await t.tasto(t.radice().querySelector('input[maxlength="2"]') as Element, 'Escape');
      return testo;
    };
    expect(await messaggio(ROSSI, '05', 'X9')).toBe('X9: codice inesistente');
    expect(await messaggio(ROSSI, '11', 'R1')).toBe('R1 già presente in questa cella');
    expect(await messaggio(ROSSI, '10', 'R3')).toBe('Massimo 2 reperibilità al giorno');
  });

  it('un codice di reperibilità si aggiunge alla cella senza toglierne altri', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === VERDI ? rigaSalvata(VERDI, { '12': cellaConTurno('M1') }) : rigaSalvata(d.id),
        ),
      },
    });
    await inserisci(t, VERDI, '12', 'R1');
    const cella = testoDi(t.cella(VERDI, '12'));
    expect(cella).toContain('M1');
    expect(t.cella(VERDI, '12').querySelector('[data-reperibilita="R1"]')).not.toBeNull();
  });
});

describe('Griglia: terza reperibilità non offerta nel menu (U7)', () => {
  it('con 2 reperibilità il menu non offre le fasce e dice il motivo', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, { '10': cellaConReperibilita('R1', 'R2') })
            : rigaSalvata(d.id),
        ),
      },
    });
    await clic(t, ROSSI, '10');
    await t.tasto(t.cella(ROSSI, '10'), 'Enter');
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(testoDi(menu)).toContain('Massimo 2 reperibilità al giorno');
    const voci = Array.from(menu.querySelectorAll('[role="menuitem"]')).map(testoDi);
    expect(voci.some((v) => v.startsWith('R3'))).toBe(false);
    // Le reperibilità presenti si possono rimuovere; i turni sì, ma N1 non compare per Rossi (escluso).
    expect(voci.some((v) => v.startsWith('Rimuovi R1'))).toBe(true);
    expect(voci.some((v) => v.startsWith('M1'))).toBe(true);
    expect(voci.some((v) => v.startsWith('N1'))).toBe(false);
    await t.tasto(menu, 'Escape');
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('scegliere un turno dal menu lo assegna alla cella; il filtro cerca per codice o nome', async () => {
    const t = await montaGriglia();
    await clic(t, NERI, '08');
    await t.tasto(t.cella(NERI, '08'), 'F2');
    const filtro = document.querySelector('[role="menu"] input') as HTMLInputElement;
    filtro.value = 'p1';
    filtro.dispatchEvent(new Event('input', { bubbles: true }));
    await t.assesta();
    const voci = Array.from(document.querySelectorAll('[role="menuitem"]'));
    expect(voci.map(testoDi)).toEqual(['P1Pomeriggio14:00–22:00']);
    (voci[0] as HTMLElement).click();
    await t.assesta();
    expect(testoDi(t.cella(NERI, '08'))).toContain('P1');
  });
});

describe('Griglia: pennello (UX §9.3)', () => {
  it('il pennello assegna con il trascinamento a un tratto di celle, come un solo passo di annulla', async () => {
    const t = await montaGriglia();
    pulsante(t.radice().querySelector('app-barra-pennello') as Element, 'M1').click();
    await t.assesta();
    expect(fascia(t)).toContain('Pennello: M1 · Esc per deporlo');
    t.cella(BIANCHI, '05').dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0 }),
    );
    t.cella(BIANCHI, '06').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    t.cella(BIANCHI, '07').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await t.assesta();
    for (const g of ['05', '06', '07']) {
      expect(testoDi(t.cella(BIANCHI, g))).toContain('M1');
    }
    expect(testoDi(t.cella(BIANCHI, '08'))).not.toContain('M1');
    expect(fascia(t)).toContain('Bozza: 3 modifiche non salvate');

    // Un solo Ctrl+Z annulla tutto il tratto; Ctrl+Y lo ripristina.
    await t.tasto(t.cella(BIANCHI, '07'), 'z', { ctrlKey: true });
    for (const g of ['05', '06', '07']) {
      expect(testoDi(t.cella(BIANCHI, g))).not.toContain('M1');
    }
    expect(fascia(t)).toContain('Bozza: tutto salvato');
    await t.tasto(t.cella(BIANCHI, '07'), 'y', { ctrlKey: true });
    expect(testoDi(t.cella(BIANCHI, '06'))).toContain('M1');
  });

  it('un rettangolo su più righe, Esc depone il pennello, la gomma svuota', async () => {
    const t = await montaGriglia();
    pulsante(t.radice().querySelector('app-barra-pennello') as Element, 'P1').click();
    await t.assesta();
    t.cella(BRUNI, '10').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    t.cella(NERI, '11').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await t.assesta();
    for (const [id, g] of [
      [BRUNI, '10'],
      [BRUNI, '11'],
      [NERI, '10'],
      [NERI, '11'],
    ] as const) {
      expect(testoDi(t.cella(id, g))).toContain('P1');
    }
    await t.tasto(t.cella(NERI, '11'), 'Escape');
    expect(fascia(t)).not.toContain('Pennello');
    // Gomma sul rettangolo ancora selezionato.
    pulsante(t.radice().querySelector('app-barra-pennello') as Element, 'Gomma').click();
    await t.assesta();
    await t.tasto(t.cella(NERI, '11'), ' ');
    expect(testoDi(t.cella(BRUNI, '10'))).not.toContain('P1');
    expect(testoDi(t.cella(NERI, '11'))).not.toContain('P1');
  });

  it('il pennello con un turno escluso salta la cella e lo dice (toast con «Dettagli» e nota nel pannello)', async () => {
    const t = await montaGriglia();
    pulsante(t.radice().querySelector('app-barra-pennello') as Element, 'N1').click();
    await t.assesta();
    t.cella(NERI, '15').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    t.cella(ROSSI, '15').dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    await t.assesta();
    expect(testoDi(t.cella(NERI, '15'))).toContain('N1');
    expect(testoDi(t.cella(ROSSI, '15'))).not.toContain('N1');
    const toast = t.toast.messaggi().at(-1);
    expect(toast?.testo).toBe('Applicato a 1 cella, 1 saltata');
    toast?.azione?.esegui();
    await t.assesta();
    expect(avvisiAperti(t).some((v) => v.includes('Cella saltata: N1 escluso per Rossi M.'))).toBe(
      true,
    );
  });
});

describe('Griglia: copia e incolla (UX §9.4)', () => {
  it('copia due celle e le incolla in un’altra riga saltando quella non ammessa', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === BIANCHI
            ? rigaSalvata(BIANCHI, { '03': cellaConTurno('N1'), '04': cellaConTurno('M1') })
            : rigaSalvata(d.id),
        ),
      },
    });
    await clic(t, BIANCHI, '03');
    await t.tasto(t.cella(BIANCHI, '03'), 'ArrowRight', { shiftKey: true });
    const appunti = new Map<string, string>();
    const copia = Object.assign(new Event('copy', { bubbles: true, cancelable: true }), {
      clipboardData: { setData: (tipo: string, testo: string) => appunti.set(tipo, testo) },
    });
    t.cella(BIANCHI, '04').dispatchEvent(copia);
    expect(copia.defaultPrevented).toBe(true);
    expect(appunti.get('text/plain')).toBe('N1\tM1');

    await clic(t, ROSSI, '03');
    const incolla = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
      clipboardData: { getData: () => 'N1\tM1' },
    });
    t.cella(ROSSI, '03').dispatchEvent(incolla);
    await t.assesta();
    // N1 è escluso per Rossi: la cella di partenza si salta, M1 passa.
    expect(testoDi(t.cella(ROSSI, '03'))).not.toContain('N1');
    expect(testoDi(t.cella(ROSSI, '04'))).toContain('M1');
    expect(t.toast.messaggi().at(-1)?.testo).toBe('Applicato a 1 cella, 1 saltata');
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    // La riga di origine non cambia.
    expect(testoDi(t.cella(BIANCHI, '03'))).toContain('N1');
  });

  it('incolla un testo di Excel (righe e tabulazioni) su più righe', async () => {
    const t = await montaGriglia();
    await clic(t, BRUNI, '20');
    const incolla = Object.assign(new Event('paste', { bubbles: true, cancelable: true }), {
      clipboardData: { getData: () => 'M1\tP1\r\nP1\tM1\r\n' },
    });
    t.cella(BRUNI, '20').dispatchEvent(incolla);
    await t.assesta();
    expect(testoDi(t.cella(BRUNI, '20'))).toContain('M1');
    expect(testoDi(t.cella(BRUNI, '21'))).toContain('P1');
    expect(testoDi(t.cella(NERI, '20'))).toContain('P1');
    expect(testoDi(t.cella(NERI, '21'))).toContain('M1');
    expect(fascia(t)).toContain('Bozza: 4 modifiche non salvate');
  });
});

describe('Griglia: avvisi dal dominio, anche a cavallo di mese (U5, UX §9.6)', () => {
  it('un turno dopo la sera del 31/10 dà l’avviso di riposo, con bordo, icona, pannello e salto alla cella', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-10': DIPENDENTI.map((d) =>
          d.id === ROSSI ? rigaSalvata(ROSSI, { '31': cellaConTurno('P1') }) : rigaSalvata(d.id),
        ),
      },
    });
    expect(t.letture).toEqual(expect.arrayContaining(['2026-11', '2026-10', '2026-12']));
    await inserisci(t, ROSSI, '01', 'M1');
    const cella = t.cella(ROSSI, '01');
    expect(cella.getAttribute('aria-label')).toBe(
      'Rossi M., domenica 1 novembre 2026: M1 Mattina 07:00–14:00; avviso: Riposo di 9 ore tra il 31/10 e il 1',
    );
    // Mai solo il colore: bordo e icona «!» e testo letto al focus (`aria-describedby`).
    expect(cella.querySelector('span[style*="border"]')).not.toBeNull();
    expect(testoDi(cella)).toContain('!');
    const descrizione = cella.getAttribute('aria-describedby');
    expect(testoDi(document.getElementById(descrizione ?? '') as Element)).toBe(
      'Riposo di 9 ore tra il 31/10 e il 1',
    );
    expect(testoDi(pulsante(t.radice(), 'Avvisi'))).toBe('Avvisi 1');

    pulsante(t.radice(), 'Avvisi').click();
    await t.assesta();
    expect(avvisiAperti(t)).toEqual(['Riposo di 9 ore tra il 31/10 e il 1Rossi M. · 1 nov']);
    // Un clic sulla voce porta alla cella e le dà il focus.
    await clic(t, VERDI, '20');
    (t.radice().querySelector('app-pannello-avvisi li button') as HTMLElement).click();
    await t.assesta();
    expect(attivaDi(t)).toBe(cella);
    expect(document.activeElement).toBe(cella);
  });

  it('un turno escluso già assegnato, una reperibilità scoperta e il turno scoperto sono avvisi', async () => {
    const malattia = { codice: 'MA', effetto: 'neutra', malattia: true } as const;
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === ROSSI
            ? rigaSalvata(ROSSI, {
                '03': cellaConTurno('N1'),
                '05': {
                  ...cellaConTurno('M1'),
                  assenza: { ...malattia, codice: malattia.codice as never },
                },
              })
            : rigaSalvata(d.id),
        ),
      },
    });
    pulsante(t.radice(), 'Avvisi').click();
    await t.assesta();
    const voci = avvisiAperti(t);
    expect(voci).toEqual(
      expect.arrayContaining([
        'N1 è tra i turni esclusi di Rossi M.Rossi M. · 3 nov',
        'Turno M1 scopertoRossi M. · 5 nov',
      ]),
    );
    expect(
      t.cella(ROSSI, '05').querySelector('[style*="repeating-linear-gradient"]'),
    ).not.toBeNull();
  });
});

describe('Griglia: reperibilità nelle tre viste (U2, UX §8.2)', () => {
  const righe = {
    '2026-11': DIPENDENTI.map((d) =>
      d.id === VERDI
        ? rigaSalvata(VERDI, {
            '10': {
              ...cellaConTurno('M1'),
              ...cellaConReperibilita('R1', 'R2'),
              turno: cellaConTurno('M1').turno,
            },
          })
        : rigaSalvata(d.id),
    ),
  };
  const strisce = (t: Montata): string[] =>
    Array.from(t.cella(VERDI, '10').querySelectorAll('[data-reperibilita]')).map(testoDi);

  it('mese: solo l’ora di inizio; 2 settimane: codice e fascia; 1 settimana: fascia completa', async () => {
    const t = await montaGriglia({ righe });
    expect(strisce(t)).toEqual(['14', '20']);
    // Tooltip dello stato mese: codice, nome, fascia e durata (anche per il focus).
    await clic(t, VERDI, '10');
    expect(testoDi(t.radice().querySelector('[role="tooltip"]') as Element)).toBe(
      'R1 Reperibilità pomeriggio · 14:00–20:00 · 6 h R2 Reperibilità notte · 20:00–08:00 · 12 h',
    );
    expect(t.cella(VERDI, '10').getAttribute('aria-label')).toContain(
      'reperibilità R1 14:00–20:00; reperibilità R2 20:00–08:00',
    );

    (
      Array.from(t.radice().querySelectorAll('[role="radio"]')).find(
        (r) => testoDi(r) === '2 settimane',
      ) as HTMLElement
    ).click();
    await t.assesta();
    expect(strisce(t)).toEqual(['R1 14–20', 'R2 20–08']);
    expect(testoDi(t.radice().querySelector('[role="toolbar"]') as Element)).toContain('9–22 nov');

    (
      Array.from(t.radice().querySelectorAll('[role="radio"]')).find(
        (r) => testoDi(r) === '1 settimana',
      ) as HTMLElement
    ).click();
    await t.assesta();
    expect(strisce(t)).toEqual(['R1 14:00–20:00', 'R2 20:00–08:00']);
    // La vista si ricorda per l'utente.
    expect(localStorage.getItem('turni.preferenze.u1')).toContain('"vistaGriglia":"settimana"');
    expect(testoDi(t.cella(VERDI, '10'))).toContain('07:00–14:00');
  });

  it('alle settimane si naviga con le frecce e con Alt+Maiusc+←/→, ferme ai bordi del mese', async () => {
    const t = await montaGriglia({ righe });
    await clic(t, BIANCHI, '03');
    (
      Array.from(t.radice().querySelectorAll('[role="radio"]')).find(
        (r) => testoDi(r) === '1 settimana',
      ) as HTMLElement
    ).click();
    await t.assesta();
    const giorniMostrati = (): (string | null)[] =>
      Array.from(t.radice().querySelectorAll('[role="columnheader"][data-g]')).map((e) =>
        e.getAttribute('data-g'),
      );
    expect(testoDi(t.radice().querySelector('[role="toolbar"]') as Element)).toContain('2–8 nov');
    expect(giorniMostrati()).toEqual(['02', '03', '04', '05', '06', '07', '08']);
    const avanti = (): Promise<KeyboardEvent> =>
      t.tasto(attivaDi(t) as HTMLElement, 'ArrowRight', { altKey: true, shiftKey: true });
    await avanti();
    expect(giorniMostrati()[0]).toBe('09');
    for (let i = 0; i < 6; i++) {
      await avanti();
    }
    // L'ultima settimana ha il solo 30 novembre e la navigazione si ferma lì.
    expect(giorniMostrati()).toEqual(['30']);
    expect(attivaDi(t)?.getAttribute('data-g')).toBe('30');
    await t.tasto(attivaDi(t) as HTMLElement, 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(giorniMostrati()[0]).toBe('23');
  });
});

describe('Griglia: modifiche non salvate e «Salva bozza» (D1, U4)', () => {
  it('avvisa prima di cambiare pagina o mese con modifiche non salvate; Annulla resta, «Esci» procede', async () => {
    const resta = await montaGriglia({ esitoDialogo: undefined });
    await inserisci(resta, BRUNI, '05', 'M1');
    expect(TestBed.inject(Inattivita).modificheNonSalvate()).toBe(1);
    await resta.router.navigateByUrl('/home');
    expect(resta.dialoghi.apri).toHaveBeenCalledTimes(1);
    expect(resta.router.url).toBe('/reparti/r1/mesi/2026-11');
    // Cambio di mese dai pulsanti: stesso avviso.
    (resta.radice().querySelector('[aria-label="Mese successivo"]') as HTMLElement).click();
    await resta.assesta();
    expect(resta.dialoghi.apri).toHaveBeenCalledTimes(2);
    expect(resta.router.url).toBe('/reparti/r1/mesi/2026-11');

    const esce = await montaGriglia({ esitoDialogo: 'esci' });
    await inserisci(esce, BRUNI, '05', 'M1');
    await esce.router.navigateByUrl('/home');
    expect(esce.router.url).toBe('/home');
  });

  it('«Salva bozza ed esci» salva e poi esce; senza modifiche non chiede nulla', async () => {
    const t = await montaGriglia({ esitoDialogo: 'salva' });
    await inserisci(t, BRUNI, '05', 'M1');
    await t.router.navigateByUrl('/home');
    expect(t.salvataggi).toHaveLength(1);
    expect(t.router.url).toBe('/home');

    const pulita = await montaGriglia();
    await pulita.router.navigateByUrl('/home');
    expect(pulita.dialoghi.apri).not.toHaveBeenCalled();
  });

  it('la chiusura della scheda con modifiche non salvate attiva l’avviso nativo del browser', async () => {
    const t = await montaGriglia();
    const pulito = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pulito);
    expect(pulito.defaultPrevented).toBe(false);
    await inserisci(t, BRUNI, '05', 'M1');
    const sporco = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(sporco);
    expect(sporco.defaultPrevented).toBe(true);
  });

  it('«Salva bozza» scrive solo le righe toccate, con la versione caricata, e dichiara «tutto salvato»', async () => {
    const t = await montaGriglia({
      righe: { '2026-11': DIPENDENTI.map((d) => rigaSalvata(d.id, {}, d.id === NERI ? 7 : 1)) },
    });
    await inserisci(t, ROSSI, '03', 'M1');
    await inserisci(t, NERI, '05', 'P1');
    expect(fascia(t)).toContain('Bozza: 2 modifiche non salvate');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(1);
    const richiesta = t.salvataggi[0];
    expect(richiesta?.righe.map((r) => [r.dipendenteId, r.versioneCaricata])).toEqual([
      [NERI, 7],
      [ROSSI, 1],
    ]);
    expect(
      richiesta?.righe.find((r) => r.dipendenteId === ROSSI)?.giorni['03']?.turno?.codice,
    ).toBe('M1');
    expect(richiesta?.calendario).toBeNull();
    expect(fascia(t)).toMatch(/Bozza: tutto salvato\s*Salvato alle \d{2}:\d{2}/);
    // Un secondo salvataggio senza modifiche non parte.
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(1);
    // La cronologia sopravvive al salvataggio: annullare crea una nuova modifica non salvata.
    await t.tasto(t.cella(NERI, '05'), 'z', { ctrlKey: true });
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
  });

  it('Ctrl+S salva anche con il focus fuori dalla griglia', async () => {
    const t = await montaGriglia();
    await inserisci(t, BRUNI, '05', 'M1');
    const evento = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    pulsante(t.radice(), 'Legenda').dispatchEvent(evento);
    await t.assesta();
    expect(evento.defaultPrevented).toBe(true);
    expect(t.salvataggi).toHaveLength(1);
  });

  it('se il salvataggio fallisce le modifiche locali restano e la fascia dice di riprovare', async () => {
    const salva = vi
      .fn<(r: unknown) => Promise<ReadonlyMap<string, number>>>()
      .mockRejectedValueOnce(new Error('rete'))
      .mockImplementation(() => Promise.resolve(new Map([[BRUNI, 2]])));
    const t = await montaGriglia({ salva });
    await inserisci(t, BRUNI, '05', 'M1');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(fascia(t)).toContain('Salvataggio non riuscito: riprova');
    expect(testoDi(t.cella(BRUNI, '05'))).toContain('M1');
    expect(TestBed.inject(Inattivita).modificheNonSalvate()).toBe(1);
    pulsante(t.radice().querySelector('app-fascia-stato') as Element, 'Riprova').click();
    await t.assesta();
    expect(salva).toHaveBeenCalledTimes(2);
    expect(fascia(t)).toContain('Bozza: tutto salvato');
  });

  it('conflitto di versione: dialogo con il numero di modifiche; «Ricarica» rilegge, «Annulla» non tocca nulla', async () => {
    const conflitto = () => Promise.reject(new ErroreSalvataggio('CONFLITTO_VERSIONE'));
    const annulla = await montaGriglia({ salva: conflitto, confermaDialogo: false });
    await inserisci(annulla, BRUNI, '05', 'M1');
    pulsante(annulla.radice(), 'Salva bozza').click();
    await annulla.assesta();
    expect(annulla.dialoghi.conferma).toHaveBeenCalledTimes(1);
    const dati = (
      annulla.dialoghi.conferma.mock.calls[0] as unknown as [
        { messaggio: string; etichettaConferma: string },
      ]
    )[0];
    expect(dati.messaggio).toBe(
      "Il mese è stato modificato in un'altra sessione. Ricarica per vedere la versione salvata: le tue 1 modifiche andranno perse.",
    );
    expect(dati.etichettaConferma).toBe('Ricarica il mese');
    expect(testoDi(annulla.cella(BRUNI, '05'))).toContain('M1');

    const ricarica = await montaGriglia({ salva: conflitto, confermaDialogo: true });
    await inserisci(ricarica, BRUNI, '05', 'M1');
    const letture = ricarica.righeRepo.leggi.mock.calls.length;
    pulsante(ricarica.radice(), 'Salva bozza').click();
    await ricarica.assesta();
    expect(ricarica.righeRepo.leggi.mock.calls.length).toBeGreaterThan(letture);
    expect(testoDi(ricarica.cella(BRUNI, '05'))).not.toContain('M1');
    expect(fascia(ricarica)).toContain('Bozza: tutto salvato');
  });

  it('mese convalidato nel frattempo: errore e ricarica in sola lettura', async () => {
    const t = await montaGriglia({
      salva: () => Promise.reject(new ErroreSalvataggio('MESE_CONVALIDATO')),
    });
    await inserisci(t, BRUNI, '05', 'M1');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.toast.messaggi().at(-1)?.testo).toBe(
      'Il mese è stato convalidato: non è più modificabile.',
    );
  });

  it('una riga con dati non validi non si salva: il pannello Avvisi mostra il blocco', async () => {
    const salvata = { ...rigaSalvata(BRUNI), grezzi: { '09': { turno: 'boh' } } };
    const t = await montaGriglia({
      righe: { '2026-11': DIPENDENTI.map((d) => (d.id === BRUNI ? salvata : rigaSalvata(d.id))) },
    });
    expect(t.cella(BRUNI, '09').getAttribute('aria-label')).toContain('dati non validi');
    await inserisci(t, NERI, '05', 'M1');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(0);
    expect(avvisiAperti(t).some((v) => v.includes('Cella con dati non validi'))).toBe(true);
  });
});

describe('Griglia: sola lettura (D2, L23)', () => {
  it('ADMIN: niente pulsanti di modifica né pennello, digitare non apre l’inserimento, la fascia lo dichiara', async () => {
    const t = await montaGriglia({ ruolo: 'ADMIN' });
    const testo = testoDi(t.radice());
    expect(testo).not.toContain('Salva bozza');
    expect(testo).not.toContain('Convalida mese');
    expect(t.radice().querySelector('app-barra-pennello')).toBeNull();
    expect(fascia(t)).toBe('Sola consultazione (ADMIN) · bozza');
    expect(
      (t.radice().querySelector('[role="grid"]') as HTMLElement).getAttribute('aria-readonly'),
    ).toBe('true');
    await t.tasto(t.cella(BIANCHI, '01'), 'm');
    expect(t.radice().querySelector('input[maxlength="2"]')).toBeNull();
    // La griglia si naviga.
    await t.tasto(t.cella(BIANCHI, '01'), 'ArrowRight');
    expect(attivaDi(t)).toBe(t.cella(BIANCHI, '02'));
    // Il menu è in lettura.
    await t.tasto(t.cella(BIANCHI, '02'), 'Enter');
    expect(testoDi(document.querySelector('[role="menu"]') as Element)).toContain(
      'Il mese è in sola lettura',
    );
    await t.tasto(document.querySelector('[role="menu"]') as Element, 'Escape');
  });

  it('mese convalidato: pulsanti mostrati ma disabilitati con il motivo, fascia con data e autore', async () => {
    const t = await montaGriglia({ mese: mese('2026-11', 'convalidato') });
    const salva = pulsante(t.radice(), 'Salva bozza');
    const convalida = pulsante(t.radice(), 'Convalida mese');
    expect((salva as HTMLButtonElement).disabled).toBe(true);
    expect(salva.getAttribute('title')).toBe('Mese convalidato');
    expect((convalida as HTMLButtonElement).disabled).toBe(true);
    expect(convalida.getAttribute('title')).toBe('Mese convalidato');
    expect(fascia(t)).toBe('Convalidato il 03/12/2026 alle 09:14 da Maria Rossi: sola lettura');
    expect(t.radice().querySelector('app-barra-pennello')).toBeNull();
    // Digitare dice perché non si può.
    await t.tasto(t.cella(BIANCHI, '01'), 'm');
    expect(t.radice().querySelector('input[maxlength="2"]')).toBeNull();
    expect(t.toast.messaggi().at(-1)?.testo).toBe('Mese convalidato: sola lettura');
    salva.click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(0);
  });

  it('«Convalida mese» dice perché è disabilitato: modifiche non salvate o mese non concluso', async () => {
    const t = await montaGriglia({ oggi: '2026-11-20' });
    expect(pulsante(t.radice(), 'Convalida mese').getAttribute('title')).toBe(
      'Potrai convalidare dal 01/12/2026',
    );
    await inserisci(t, BRUNI, '05', 'M1');
    expect(pulsante(t.radice(), 'Convalida mese').getAttribute('title')).toBe(
      'Salva prima le modifiche',
    );
  });
});

describe('Griglia: mese non creato e «Aggiungi mese» (D8)', () => {
  it('un mese non creato mostra lo stato vuoto; «Aggiungi mese» crea la bozza con una riga per dipendente in servizio', async () => {
    const t = await montaGriglia({
      mese: null,
      esitoDialogo: '2026-11',
      dipendenti: [
        ...DIPENDENTI,
        dipendente('d6', 'Gialli', 'Paola', { dataAssunzione: dataISO('2026-12-10') }),
      ],
    });
    expect(testoDi(t.radice())).toContain('Novembre 2026 non è ancora stato creato');
    pulsante(t.radice(), 'Aggiungi mese').click();
    await t.assesta();
    expect(t.creazioni).toEqual([{ chiave: '2026-11', righe: 5 }]);
    expect(t.toast.messaggi().at(-1)?.testo).toBe('Novembre 2026 creato');
  });

  it('oltre la finestra di modifica il pulsante non c’è e si spiega perché', async () => {
    const t = await montaGriglia({ mese: null, url: '/reparti/r1/mesi/2027-03' });
    const testo = testoDi(t.radice());
    expect(testo).toContain('Marzo 2027 non è ancora stato creato');
    expect(testo).toContain('Puoi creare i mesi fino a gennaio 2027.');
    expect(
      Array.from(t.radice().querySelectorAll('button')).some((b) => testoDi(b) === 'Aggiungi mese'),
    ).toBe(false);
  });

  it('l’ADMIN non crea mesi', async () => {
    const t = await montaGriglia({ mese: null, ruolo: 'ADMIN' });
    expect(
      Array.from(t.radice().querySelectorAll('button')).some((b) => testoDi(b) === 'Aggiungi mese'),
    ).toBe(false);
  });

  it('reparto senza dipendenti in servizio: lo dice e porta ai Dipendenti', async () => {
    const t = await montaGriglia({ righe: { '2026-11': [] } });
    expect(testoDi(t.radice())).toContain('Nessun dipendente in servizio in questo mese');
    expect(pulsante(t.radice(), 'Vai ai dipendenti').getAttribute('href')).toBe(
      '/reparti/r1/dipendenti',
    );
  });
});

describe('Griglia: allineamento della bozza (ARCHITETTURA §9)', () => {
  it('le ore settimanali cambiate e un dipendente nuovo diventano note con «Aggiorna», mai in automatico', async () => {
    const t = await montaGriglia({
      dipendenti: [
        dipendente('d2', 'Bianchi', 'Laura', { oreSettimanali: 30 }),
        dipendente('d9', 'Zanetti', 'Pia'),
        ...DIPENDENTI.filter((d) => d.id !== 'd2'),
      ],
    });
    expect(fascia(t)).toContain('Bozza: tutto salvato');
    pulsante(t.radice(), 'Avvisi').click();
    await t.assesta();
    const note = avvisiAperti(t);
    expect(note).toContain(
      'Le ore settimanali di Bianchi L. sono cambiate da 36 a 30.Bianchi L. Aggiorna',
    );
    expect(note).toContain(
      'Zanetti P. è in servizio ma non ha una riga in questo mese.Zanetti P. Aggiungi',
    );
    // «Avvisi» conta blocchi e avvisi, non le note.
    expect(testoDi(pulsante(t.radice(), 'Avvisi'))).toBe('Avvisi 0');
    const aggiorna = Array.from(t.radice().querySelectorAll('app-pannello-avvisi li button')).find(
      (b) => testoDi(b) === 'Aggiorna',
    );
    (aggiorna as HTMLElement).click();
    await t.assesta();
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    const aggiungi = Array.from(t.radice().querySelectorAll('app-pannello-avvisi li button')).find(
      (b) => testoDi(b) === 'Aggiungi',
    );
    (aggiungi as HTMLElement).click();
    await t.assesta();
    expect(fascia(t)).toContain('Bozza: 2 modifiche non salvate');
    expect(
      Array.from(t.radice().querySelectorAll('[role="rowheader"]'))
        .map(testoDi)
        .some((nome) => nome.endsWith('Zanetti P.')),
    ).toBe(true);
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    const salvate = t.salvataggi[0]?.righe ?? [];
    expect(
      salvate.map((r) => [r.dipendenteId, r.versioneCaricata, r.contratto.oreSettimanali]),
    ).toEqual(
      expect.arrayContaining([
        ['d2', 1, 30],
        ['d9', null, 36],
      ]),
    );
  });
});

describe('Griglia: prestazioni e ridisegni mirati (PIANO 2.2 criterio 10)', () => {
  it('una modifica ridisegna solo la riga toccata', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': DIPENDENTI.map((d) =>
          d.id === NERI ? rigaSalvata(NERI, { '10': cellaConTurno('M1') }) : rigaSalvata(d.id),
        ),
      },
    });
    await clic(t, NERI, '10');
    const griglia = t.radice().querySelector('[role="grid"]') as HTMLElement;
    const righeToccate = new Set<string>();
    const osservatore = new MutationObserver((mutazioni) => {
      for (const m of mutazioni) {
        const nodo = m.target instanceof Element ? m.target : m.target.parentElement;
        const riga = nodo?.closest('[data-riga]');
        righeToccate.add(riga?.getAttribute('data-riga') ?? 'fuori-riga');
      }
    });
    osservatore.observe(griglia, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    await t.tasto(t.cella(NERI, '10'), 'Delete');
    osservatore.disconnect();
    expect([...righeToccate]).toEqual([NERI]);
    expect(testoDi(t.cella(NERI, '10'))).not.toContain('M1');
  });
});

describe('Griglia: caricamento e errori', () => {
  it('un mese non valido o un reparto non leggibile dicono «non disponibile»', async () => {
    const t = await montaGriglia({ url: '/reparti/r1/mesi/boh' });
    expect(testoDi(t.radice())).toContain('Reparto non disponibile.');
  });
});

// Tipo usato solo per documentare i giorni delle prove.
export type GiornoProva = ChiaveGiorno;
