// Test di componente dello step 3.2 (PIANO 3.2 criterio 7): pannello degli orari reali, assenza su più giorni,
// «Trova sostituto» e scelta del sostituto, sola lettura sul mese convalidato, salvataggio respinto. Pagina vera;
// repository, funzioni e dialoghi finti.
import {
  chiaveMese,
  codiceAssenza,
  dataISO,
  oraLocale,
  type CellaDoc,
  type ChiaveGiorno,
  type RiepilogoPerClassifica,
} from '@turni/domain';
import { ErroreSalvataggio, type RigaSalvata } from '../../dati/righe.repo';
import {
  apriMenu,
  clic,
  fascia,
  scegliVoce,
  scrivi,
  selezionaGiorni,
  vociMenu,
  type Montata,
} from '../../test/azioni-griglia';
import {
  DIPENDENTI,
  cellaConReperibilita,
  cellaConTurno,
  mese,
  montaGriglia,
  pulsante,
  rigaSalvata,
  testoDi,
} from '../../test/monta-griglia';
import type { BancaOreSalvata } from '../../dati/banca-ore.repo';

const ROSSI = 'd1';
const BIANCHI = 'd2';
const NERI = 'd3';
const VERDI = 'd4';
const BRUNI = 'd5';

const MALATTIA = { codice: codiceAssenza('MA'), effetto: 'neutra', malattia: true } as const;
const FERIE = { codice: codiceAssenza('F'), effetto: 'neutra', malattia: false } as const;

function scoperta(codice: string): CellaDoc {
  return { ...cellaConTurno(codice), assenza: MALATTIA };
}

function righeDi(
  per: Readonly<Record<string, Partial<Record<ChiaveGiorno, CellaDoc>>>>,
): readonly RigaSalvata[] {
  return DIPENDENTI.map((d) => rigaSalvata(d.id, per[d.id] ?? {}));
}

const pannelloTurno = (t: Montata): HTMLElement | null =>
  t.radice().querySelector<HTMLElement>('app-pannello-turno');
const pannelloSostituti = (t: Montata): HTMLElement | null =>
  t.radice().querySelector<HTMLElement>('app-pannello-sostituti');

const campoOra = (p: HTMLElement, quale: 'inizio' | 'fine'): HTMLInputElement => {
  const campi = p.querySelectorAll<HTMLInputElement>('input[type="time"]');
  const campo = campi[quale === 'inizio' ? 0 : 1];
  if (campo === undefined) {
    throw new Error('Campo ora non trovato');
  }
  return campo;
};

async function apriDettaglioTurno(t: Montata, id: string, giorno: string): Promise<HTMLElement> {
  await clic(t, id, giorno);
  await apriMenu(t, id, giorno);
  await scegliVoce(t, 'Dettaglio turno');
  const p = pannelloTurno(t);
  if (p === null) {
    throw new Error('Il pannello del turno non si è aperto');
  }
  return p;
}

describe('Griglia 3.2: pannello «Dettaglio turno» (orari reali)', () => {
  const righe = { '2026-11': righeDi({ [ROSSI]: { '04': cellaConTurno('M1') } }) };

  it('mostra il previsto, calcola la differenza mentre si digita e «Applica» la porta tra le modifiche non salvate', async () => {
    const t = await montaGriglia({ righe });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    expect(testoDi(p.querySelector('[data-previsto]') as Element)).toBe('M1 Mattina · 07:00–14:00');
    expect(testoDi(p.querySelector('[data-differenza]') as Element)).toBe(
      'Differenza: nessuna (come previsto)',
    );
    const applica = pulsante(p, 'Applica') as HTMLButtonElement;
    expect(applica.disabled).toBe(true);

    await scrivi(t, campoOra(p, 'fine'), '14:30');
    expect(testoDi(p.querySelector('[data-differenza]') as Element)).toBe('Differenza: +30 min');
    await scrivi(t, campoOra(p, 'fine'), '13:15');
    expect(testoDi(p.querySelector('[data-differenza]') as Element)).toBe('Differenza: −45 min');
    await scrivi(t, campoOra(p, 'fine'), '14:30');
    expect(applica.disabled).toBe(false);

    applica.click();
    await t.assesta();
    expect(pannelloTurno(t)).toBeNull();
    expect(fascia(t)).toContain('Bozza: 1 modifica non salvata');
    // Il segno «orario variato» sta nell'angolo in basso a destra del chip.
    const angolo = t.cella(ROSSI, '04').querySelector<HTMLElement>('span.right-0.bottom-0');
    expect(angolo).not.toBeNull();
    expect(angolo?.style.borderBottom).toContain('solid');

    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    const riga = t.salvataggi[0]?.righe.find((r) => r.dipendenteId === ROSSI);
    expect(riga?.giorni['04']?.orarioReale).toEqual({
      inizio: oraLocale('07:00'),
      fine: oraLocale('14:30'),
    });
    expect(fascia(t)).toContain('Bozza: tutto salvato');
  });

  it('il suggerimento della cella dice l’orario reale e la differenza', async () => {
    const t = await montaGriglia({ righe });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    await scrivi(t, campoOra(p, 'fine'), '14:30');
    (pulsante(p, 'Applica') as HTMLButtonElement).click();
    await t.assesta();
    t.cella(ROSSI, '04').focus();
    await t.assesta();
    const suggerimento = document.querySelector('[role="tooltip"]');
    expect(testoDi(suggerimento as Element)).toContain(
      'Orario reale 07:00–14:30 (previsto 07:00–14:00): +30 min',
    );
    expect(t.cella(ROSSI, '04').getAttribute('aria-label')).toContain('Orario reale 07:00–14:30');
  });

  it('ripristinare l’orario previsto toglie la variazione; annullare con Ctrl+Z è un solo passo', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [ROSSI]: {
            '04': {
              ...cellaConTurno('M1'),
              orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:30') },
            },
          },
        }),
      },
    });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    expect(campoOra(p, 'fine').value).toBe('14:30');
    pulsante(p, 'Ripristina l’orario previsto').click();
    await t.assesta();
    expect(campoOra(p, 'fine').value).toBe('14:00');
    (pulsante(p, 'Applica') as HTMLButtonElement).click();
    await t.assesta();
    expect(fascia(t)).toContain('1 modifica non salvata');
    expect(t.cella(ROSSI, '04').querySelector('span.right-0.bottom-0')).toBeNull();
    await t.tasto(t.cella(ROSSI, '04'), 'z', { ctrlKey: true });
    expect(fascia(t)).toContain('tutto salvato');
  });

  it('un orario incompleto non si applica e dice che cosa manca', async () => {
    const t = await montaGriglia({ righe });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    await scrivi(t, campoOra(p, 'fine'), '');
    expect(testoDi(p.querySelector('[data-differenza]') as Element)).toBe(
      'Indica ingresso e uscita per vedere la differenza',
    );
    expect((pulsante(p, 'Applica') as HTMLButtonElement).disabled).toBe(true);
  });

  it('l’uscita che porta il riposo sotto le 11 ore mostra l’avviso prima di applicare', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [ROSSI]: { '04': cellaConTurno('M1'), '05': cellaConTurno('M1') },
        }),
      },
    });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    await scrivi(t, campoOra(p, 'fine'), '23:30');
    expect(testoDi(p)).toContain('Dopo l’applicazione');
    expect(testoDi(p)).toContain('Riposo di');
  });

  it('un turno notturno con ingresso dopo la mezzanotte avverte di indicare 23:59 (limite noto di 3.1a)', async () => {
    const t = await montaGriglia({
      righe: { '2026-11': righeDi({ [BIANCHI]: { '04': cellaConTurno('N1') } }) },
    });
    const p = await apriDettaglioTurno(t, BIANCHI, '04');
    expect(testoDi(p)).not.toContain('indica 23:59');
    await scrivi(t, campoOra(p, 'inizio'), '00:15');
    expect(testoDi(p)).toContain('indica 23:59');
  });

  it('con il cambio d’ora la differenza è in minuti reali: 22:00–07:30 la notte del 24 ottobre vale +30', async () => {
    const t = await montaGriglia({
      url: '/reparti/r1/mesi/2026-10',
      righe: { '2026-10': righeDi({ [BIANCHI]: { '24': cellaConTurno('N1') } }) },
    });
    const p = await apriDettaglioTurno(t, BIANCHI, '24');
    await scrivi(t, campoOra(p, 'fine'), '07:30');
    expect(testoDi(p.querySelector('[data-differenza]') as Element)).toBe('Differenza: +30 min');
  });

  it('un turno scoperto non ha orario reale: il pannello lo dice e non offre campi', async () => {
    const t = await montaGriglia({
      righe: { '2026-11': righeDi({ [ROSSI]: { '04': scoperta('M1') } }) },
    });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    expect(testoDi(p)).toContain('Turno scoperto');
    expect(p.querySelectorAll('input').length).toBe(0);
    expect(p.textContent).not.toContain('Applica');
  });

  it('chi sostituisce un collega lo vede nel pannello', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [BIANCHI]: { '04': { ...cellaConTurno('M1'), sostituisce: ROSSI } },
          [ROSSI]: { '04': { ...scoperta('M1'), copertoDa: BIANCHI } },
        }),
      },
    });
    const p = await apriDettaglioTurno(t, BIANCHI, '04');
    expect(testoDi(p.querySelector('[data-sostituisce]') as Element)).toBe('Sostituisce Rossi M.');
  });
});

describe('Griglia 3.2: sola lettura (D2)', () => {
  const con = {
    '2026-11': righeDi({
      [ROSSI]: {
        '04': {
          ...cellaConTurno('M1'),
          orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:30') },
        },
        '05': scoperta('M1'),
      },
    }),
  };

  it('mese convalidato: il pannello mostra l’orario reale senza campi né Applica; «Trova sostituto» non si offre', async () => {
    const t = await montaGriglia({ righe: con, mese: mese('2026-11', 'convalidato') });
    await clic(t, ROSSI, '05');
    await apriMenu(t, ROSSI, '05');
    expect(vociMenu().some((v) => v.startsWith('Trova sostituto'))).toBe(false);
    expect(vociMenu().some((v) => v.startsWith('Dettaglio turno'))).toBe(true);
    await scegliVoce(t, 'Dettaglio turno');
    await clic(t, ROSSI, '04');
    await apriMenu(t, ROSSI, '04');
    await scegliVoce(t, 'Dettaglio turno');
    const p = pannelloTurno(t) as HTMLElement;
    expect(p.querySelectorAll('input').length).toBe(0);
    expect(testoDi(p.querySelector('[data-orario-reale]') as Element)).toBe(
      'Orario reale: 07:00–14:30',
    );
    expect(testoDi(p)).toContain('Differenza: +30 min');
    expect(testoDi(p)).toContain('sola lettura');
    expect(p.textContent).not.toContain('Applica');
    expect(t.salvataggi.length).toBe(0);
  });

  it('ADMIN: lo stesso, e nemmeno digitando si modifica nulla', async () => {
    const t = await montaGriglia({ righe: con, ruolo: 'ADMIN' });
    await clic(t, ROSSI, '05');
    await apriMenu(t, ROSSI, '05');
    expect(vociMenu().some((v) => v.startsWith('Trova sostituto'))).toBe(false);
    await scegliVoce(t, 'Dettaglio turno');
    expect(pannelloTurno(t)?.querySelectorAll('input').length).toBe(0);
    expect(fascia(t)).toContain('Sola consultazione');
  });
});

describe('Griglia 3.2: assenza su più giorni, turno scoperto (PIANO 3.2 criterio 2)', () => {
  const righe = {
    '2026-11': righeDi({ [ROSSI]: { '03': cellaConTurno('M1'), '04': cellaConTurno('M1') } }),
  };

  it('Malattia su tre giorni della riga: i turni restano visibili come «scoperto», riconoscibile anche senza colore', async () => {
    const t = await montaGriglia({ righe });
    await selezionaGiorni(t, ROSSI, 3, 5);
    await apriMenu(t, ROSSI, '05');
    await scegliVoce(t, 'MA');
    for (const giorno of ['03', '04']) {
      const chip = t.cella(ROSSI, giorno).querySelector<HTMLElement>('[data-chip]');
      expect(chip?.getAttribute('data-chip')).toBe('scoperto');
      // Senza colore: bordo tratteggiato e testo nell'etichetta accessibile.
      expect(chip?.style.border).toContain('dashed');
      expect(t.cella(ROSSI, giorno).getAttribute('aria-label')).toContain(
        'M1 scoperto (MA Malattia)',
      );
    }
    // Il giorno senza turno prende la sola assenza.
    expect(t.cella(ROSSI, '05').querySelector('[data-chip]')?.getAttribute('data-chip')).toBe(
      'assenza',
    );
    expect(fascia(t)).toContain('3 modifiche non salvate');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    const riga = t.salvataggi[0]?.righe.find((r) => r.dipendenteId === ROSSI);
    expect(riga?.giorni['03']?.turno?.codice).toBe('M1');
    expect(riga?.giorni['03']?.assenza?.codice).toBe('MA');
    expect(riga?.giorni['04']?.assenza?.malattia).toBe(true);
    expect(riga?.giorni['05']?.turno).toBeNull();
  });

  it('«Elimina il turno scoperto» lascia la sola assenza', async () => {
    const t = await montaGriglia({
      righe: { '2026-11': righeDi({ [ROSSI]: { '03': scoperta('M1') } }) },
    });
    await clic(t, ROSSI, '03');
    await apriMenu(t, ROSSI, '03');
    await scegliVoce(t, 'Elimina il turno scoperto');
    expect(t.cella(ROSSI, '03').querySelector('[data-chip]')?.getAttribute('data-chip')).toBe(
      'assenza',
    );
  });
});

const BANCHE: readonly BancaOreSalvata[] = [
  banca(BIANCHI, 720),
  banca(VERDI, -270),
  banca(NERI, 0),
];

function banca(id: string, saldoDefinitivo: number): BancaOreSalvata {
  return {
    dipendenteId: id,
    anno: 2026,
    riportoMinuti: 0,
    mesi: {},
    saldoAnnoMinuti: saldoDefinitivo - 5000,
    saldoDefinitivoMinuti: saldoDefinitivo,
    provvisorio: true,
  };
}

const STORICO: readonly RiepilogoPerClassifica[] = [
  { dipendenteId: BIANCHI, chiaveMese: chiaveMese('2026-09'), conteggiPerCodice: { M1: 2 } },
  { dipendenteId: VERDI, chiaveMese: chiaveMese('2026-08'), conteggiPerCodice: { M1: 3 } },
];

/** Rossi in malattia il 3 su M1; gli altri in situazioni diverse (L9, UX §9.11). */
const SCENARIO_SOSTITUTI = {
  '2026-11': righeDi({
    [ROSSI]: { '03': scoperta('M1') },
    [BIANCHI]: { '02': cellaConTurno('P1') },
    [NERI]: { '03': cellaConTurno('P1') },
    [VERDI]: { '03': cellaConReperibilita('R3') },
    [BRUNI]: { '03': { ...cellaConTurno('M1'), turno: null, assenza: FERIE } },
  }),
};

async function apriSostituti(t: Montata, id = ROSSI, giorno = '03', voce = 'Trova sostituto') {
  await clic(t, id, giorno);
  await apriMenu(t, id, giorno);
  await scegliVoce(t, voce);
  return pannelloSostituti(t) as HTMLElement;
}

describe('Griglia 3.2: «Trova sostituto» (UX §9.11, U8, L9)', () => {
  it('la classifica legge storico e saldi solo su richiesta, con il saldo dei soli mesi convalidati', async () => {
    const t = await montaGriglia({
      righe: SCENARIO_SOSTITUTI,
      riepiloghiClassifica: () => Promise.resolve(STORICO),
      banche: BANCHE,
    });
    expect(t.richiesteClassifica.length).toBe(0);
    expect(t.anniBancaOre.length).toBe(0);
    const p = await apriSostituti(t);
    // I dodici mesi prima di novembre 2026; la banca ore dell'anno del mese.
    expect(t.richiesteClassifica).toEqual([{ da: '2025-11', a: '2026-10' }]);
    expect(t.anniBancaOre).toEqual([2026]);
    expect(testoDi(p.querySelector('[data-titolo]') as Element)).toContain(
      'Trova sostituto · M1 07:00–14:00 · 3 nov',
    );

    const disponibili = Array.from(p.querySelectorAll<HTMLElement>('[data-candidato]'));
    // Prima chi ha il riposo di 11 ore e meno volte (Verdi: 3, ma Bianchi ha riposo di 9 ore: va in fondo).
    expect(disponibili.map((e) => e.getAttribute('data-candidato'))).toEqual([VERDI, BIANCHI]);
    const verdi = disponibili[0] as HTMLElement;
    expect(testoDi(verdi)).toContain('Verdi A.');
    expect(testoDi(verdi)).toContain('fatto 3 volte');
    expect(testoDi(verdi)).toContain('saldo −4,5 h');
    expect(testoDi(verdi)).toContain('Reperibile');
    const bianchi = disponibili[1] as HTMLElement;
    expect(testoDi(bianchi)).toContain('fatto 2 volte');
    expect(testoDi(bianchi)).toContain('saldo +12,0 h');
    expect(testoDi(bianchi)).toContain('Riposo di 9 ore prima del turno');
    expect(testoDi(bianchi)).toContain('Meno di 11 ore di riposo');
  });

  it('in fondo «Non disponibili» elenca gli esclusi con il motivo di ciascuno', async () => {
    const t = await montaGriglia({
      righe: SCENARIO_SOSTITUTI,
      riepiloghiClassifica: () => Promise.resolve(STORICO),
      banche: BANCHE,
    });
    const p = await apriSostituti(t);
    const esclusi = Object.fromEntries(
      Array.from(p.querySelectorAll<HTMLElement>('[data-escluso]')).map((e) => [
        e.getAttribute('data-escluso'),
        testoDi(e),
      ]),
    );
    expect(esclusi[NERI]).toContain('ha già il turno P1 (14:00–22:00)');
    expect(esclusi[BRUNI]).toContain('assente (Ferie)');
    expect(p.textContent?.indexOf('Disponibili')).toBeLessThan(
      p.textContent?.indexOf('Non disponibili') ?? 0,
    );
  });

  it('un motivo nuovo del dominio ha un testo: fuori servizio quel giorno', async () => {
    // Neri non è ancora in servizio il 3 novembre: lo dice il contratto della riga.
    const righe = {
      '2026-11': SCENARIO_SOSTITUTI['2026-11'].map((r) =>
        r.dipendenteId === NERI
          ? {
              ...r,
              giorni: {},
              contratto: { ...r.contratto, dataAssunzione: dataISO('2026-12-01') },
            }
          : r,
      ),
    };
    const t = await montaGriglia({ righe });
    const p = await apriSostituti(t);
    expect(testoDi(p.querySelector(`[data-escluso="${NERI}"]`) as Element)).toContain(
      'fuori servizio quel giorno',
    );
  });

  it('passando su un candidato si evidenzia la sua settimana nella griglia e la griglia resta visibile', async () => {
    const t = await montaGriglia({
      righe: SCENARIO_SOSTITUTI,
      riepiloghiClassifica: () => Promise.resolve(STORICO),
      banche: BANCHE,
    });
    const p = await apriSostituti(t);
    expect(t.radice().querySelector('[role="grid"]')).not.toBeNull();
    const evidenziate = (id: string): string[] =>
      Array.from(t.radice().querySelectorAll<HTMLElement>(`[data-evidenza][data-r="${id}"]`)).map(
        (e) => e.getAttribute('data-g') ?? '',
      );
    expect(evidenziate(BIANCHI)).toEqual([]);
    const riga = p.querySelector(`[data-candidato="${BIANCHI}"]`) as HTMLElement;
    riga.dispatchEvent(new Event('pointerenter'));
    await t.assesta();
    // Lunedì 2 – domenica 8 novembre.
    expect(evidenziate(BIANCHI)).toEqual(['02', '03', '04', '05', '06', '07', '08']);
    expect(evidenziate(VERDI)).toEqual([]);
    p.querySelector('[data-disponibili]')?.closest('div')?.dispatchEvent(new Event('pointerleave'));
    await t.assesta();
    expect(evidenziate(BIANCHI)).toEqual([]);
  });

  it('«Assegna» registra la sostituzione su due righe: triangolo e tooltip «Sostituisce …», un solo passo di annulla', async () => {
    const t = await montaGriglia({
      righe: SCENARIO_SOSTITUTI,
      riepiloghiClassifica: () => Promise.resolve(STORICO),
      banche: BANCHE,
    });
    const p = await apriSostituti(t);
    (
      pulsante(
        p.querySelector(`[data-candidato="${BIANCHI}"]`) as HTMLElement,
        'Assegna',
      ) as HTMLElement
    ).click();
    await t.assesta();
    expect(pannelloSostituti(t)).toBeNull();
    expect(t.toast.messaggi().at(-1)?.testo).toContain('Sostituzione registrata con Bianchi L.');
    expect(fascia(t)).toContain('2 modifiche non salvate');

    // Il sostituto: chip del turno con il triangolo in alto a destra e il tooltip.
    const cella = t.cella(BIANCHI, '03');
    expect(cella.querySelector('[data-chip]')?.getAttribute('data-chip')).toBe('turno');
    expect(cella.querySelector<HTMLElement>('span.top-0.right-0')?.style.borderTop).toContain(
      'solid',
    );
    cella.focus();
    await t.assesta();
    expect(testoDi(document.querySelector('[role="tooltip"]') as Element)).toContain(
      'Sostituisce Rossi M.',
    );
    // L'assente: chip dell'assenza e tooltip «M1 coperto da …».
    expect(t.cella(ROSSI, '03').querySelector('[data-chip]')?.getAttribute('data-chip')).toBe(
      'assenza',
    );
    t.cella(ROSSI, '03').focus();
    await t.assesta();
    expect(testoDi(document.querySelector('[role="tooltip"]') as Element)).toContain(
      'M1 coperto da Bianchi L.',
    );

    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    const salvate = t.salvataggi[0]?.righe ?? [];
    expect(salvate.find((r) => r.dipendenteId === ROSSI)?.giorni['03']?.copertoDa).toBe(BIANCHI);
    const sostituto = salvate.find((r) => r.dipendenteId === BIANCHI)?.giorni['03'];
    expect(sostituto?.sostituisce).toBe(ROSSI);
    expect(sostituto?.turno?.codice).toBe('M1');
  });

  it('annullare con Ctrl+Z toglie la sostituzione da entrambe le righe', async () => {
    const t = await montaGriglia({ righe: SCENARIO_SOSTITUTI, banche: BANCHE });
    const p = await apriSostituti(t);
    (
      pulsante(
        p.querySelector(`[data-candidato="${VERDI}"]`) as HTMLElement,
        'Assegna',
      ) as HTMLElement
    ).click();
    await t.assesta();
    await t.tasto(t.cella(ROSSI, '03'), 'z', { ctrlKey: true });
    expect(fascia(t)).toContain('tutto salvato');
    expect(t.cella(VERDI, '03').querySelector('[data-chip]')).toBeNull();
  });

  it('«Rimuovi la sostituzione» riporta l’assente a scoperto', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [BIANCHI]: { '03': { ...cellaConTurno('M1'), sostituisce: ROSSI } },
          [ROSSI]: { '03': { ...scoperta('M1'), copertoDa: BIANCHI } },
        }),
      },
    });
    await clic(t, BIANCHI, '03');
    await apriMenu(t, BIANCHI, '03');
    await scegliVoce(t, 'Rimuovi la sostituzione');
    expect(fascia(t)).toContain('2 modifiche non salvate');
    expect(t.cella(ROSSI, '03').querySelector('[data-chip]')?.getAttribute('data-chip')).toBe(
      'scoperto',
    );
    expect(t.cella(BIANCHI, '03').querySelector('[data-chip]')).toBeNull();
  });

  it('si apre solo da una cella scoperta: un turno svolto o già coperto non offre la voce', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [ROSSI]: { '03': cellaConTurno('M1'), '04': { ...scoperta('M1'), copertoDa: BIANCHI } },
          [BIANCHI]: { '04': { ...cellaConTurno('M1'), sostituisce: ROSSI } },
        }),
      },
    });
    await clic(t, ROSSI, '03');
    await apriMenu(t, ROSSI, '03');
    expect(vociMenu().some((v) => v.startsWith('Trova sostituto'))).toBe(false);
    await t.tasto(document.querySelector('[role="menu"]') as Element, 'Escape');
    await clic(t, ROSSI, '04');
    await apriMenu(t, ROSSI, '04');
    expect(vociMenu().some((v) => v.startsWith('Trova sostituto'))).toBe(false);
    expect(vociMenu().some((v) => v.startsWith('Rimuovi la sostituzione'))).toBe(true);
    await t.tasto(document.querySelector('[role="menu"]') as Element, 'Escape');
  });

  it('da una reperibilità scoperta: classifica per la fascia e il collega prende la fascia', async () => {
    const t = await montaGriglia({
      righe: {
        '2026-11': righeDi({
          [ROSSI]: { '03': { ...cellaConReperibilita('R1'), assenza: MALATTIA } },
        }),
      },
      banche: BANCHE,
    });
    await clic(t, ROSSI, '03');
    await apriMenu(t, ROSSI, '03');
    expect(vociMenu().some((v) => v.startsWith('Trova sostituto per R1'))).toBe(true);
    await scegliVoce(t, 'Trova sostituto per R1');
    const p = pannelloSostituti(t) as HTMLElement;
    expect(testoDi(p.querySelector('[data-titolo]') as Element)).toContain('R1 14:00–20:00');
    (
      pulsante(
        p.querySelector(`[data-candidato="${VERDI}"]`) as HTMLElement,
        'Assegna',
      ) as HTMLElement
    ).click();
    await t.assesta();
    const fasciaVerdi = t.cella(VERDI, '03').querySelector('[data-reperibilita="R1"]');
    expect(fasciaVerdi).not.toBeNull();
    t.cella(VERDI, '03').focus();
    await t.assesta();
    expect(testoDi(document.querySelector('[role="tooltip"]') as Element)).toContain(
      'R1: sostituisce Rossi M.',
    );
  });

  it('errore nella lettura di storico e saldi: messaggio e «Riprova», senza classifica finta', async () => {
    let chiamate = 0;
    const t = await montaGriglia({
      righe: SCENARIO_SOSTITUTI,
      riepiloghiClassifica: () =>
        ++chiamate === 1 ? Promise.reject(new Error('rete')) : Promise.resolve(STORICO),
      banche: BANCHE,
    });
    const p = await apriSostituti(t);
    expect(testoDi(p)).toContain('Non è stato possibile leggere lo storico e i saldi');
    expect(p.querySelectorAll('[data-candidato]').length).toBe(0);
    pulsante(p, 'Riprova').click();
    await t.assesta();
    expect(p.querySelectorAll('[data-candidato]').length).toBe(2);
  });

  it('un saldo sconosciuto non è uno zero: il candidato lo dice', async () => {
    const t = await montaGriglia({ righe: SCENARIO_SOSTITUTI, banche: [] });
    const p = await apriSostituti(t);
    expect(testoDi(p.querySelector(`[data-candidato="${VERDI}"]`) as Element)).toContain(
      'saldo non disponibile',
    );
  });
});

describe('Griglia 3.2: salvataggio respinto', () => {
  it('le regole negano la scrittura: messaggio chiaro, modifiche locali intatte', async () => {
    const t = await montaGriglia({
      righe: { '2026-11': righeDi({ [ROSSI]: { '04': cellaConTurno('M1') } }) },
      salva: () => Promise.reject(new ErroreSalvataggio('RESPINTO')),
    });
    const p = await apriDettaglioTurno(t, ROSSI, '04');
    await scrivi(t, campoOra(p, 'fine'), '14:30');
    (pulsante(p, 'Applica') as HTMLButtonElement).click();
    await t.assesta();
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.toast.messaggi().at(-1)?.testo).toContain(
      'Il salvataggio è stato respinto dal server',
    );
    expect(fascia(t)).toContain('1 modifica non salvata');
    expect((pulsante(t.radice(), 'Salva bozza') as HTMLButtonElement).disabled).toBe(false);
  });
});
