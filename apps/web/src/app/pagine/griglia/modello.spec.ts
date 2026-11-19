import {
  cellaVuota,
  chiaveMese,
  codiceAssenza,
  codiceTurno,
  dataISO,
  oraLocale,
  type CellaDoc,
  type Segnalazione,
} from '@turni/domain';
import { COLORI } from '../../ui/token';
import {
  celleDellaRiga,
  celleUguali,
  colonneDelMese,
  giorniModificati,
  nomeBreve,
  testoMotivo,
  testoNonDisponibile,
  testoSegnalazione,
  totaliDiVista,
  uguali,
  type ConfigVista,
  type InputCelleRiga,
} from './modello';
import { configurazioneVista } from './vista';

const NOVEMBRE = chiaveMese('2026-11');
const colonne = colonneDelMese(
  NOVEMBRE,
  { festivita: { '01': { id: 'ognissanti', nome: 'Ognissanti' } }, attribuzioneNotte: 'inizio' },
  dataISO('2026-11-03'),
);
const config: ConfigVista = {
  turni: new Map([
    ['M1', { nome: 'Mattina', colore: 'arancio' }],
    ['N1', { nome: 'Notte', colore: 'ardesia' }],
    ['R1', { nome: 'Reperibilità pomeriggio', colore: null }],
    ['R2', { nome: 'Reperibilità notte', colore: null }],
  ]),
  assenze: new Map([
    ['R', { descrizione: 'Riposo' }],
    ['MA', { descrizione: 'Malattia' }],
    ['F', { descrizione: 'Ferie' }],
  ]),
};

const turno = (codice: string, inizio = '07:00', fine = '14:00'): CellaDoc['turno'] => ({
  codice: codiceTurno(codice),
  inizio: oraLocale(inizio),
  fine: oraLocale(fine),
  pausaMinuti: 30,
  notturno: false,
});
const fascia = (codice: string, inizio: string, fine: string, minutiChiamata?: number) => ({
  codice: codiceTurno(codice),
  inizio: oraLocale(inizio),
  fine: oraLocale(fine),
  chiamate: minutiChiamata === undefined ? [] : [{ durataMinuti: minutiChiamata, oraInizio: null }],
  sostituisce: null,
  copertaDa: null,
});
const assenza = (codice: string, effetto: 'comeRiposo' | 'neutra') => ({
  codice: codiceAssenza(codice),
  effetto,
  malattia: codice === 'MA',
});

function celle(
  giorni: InputCelleRiga['giorni'],
  vista: InputCelleRiga['vista'] = configurazioneVista('mese', 958, 30),
  extra: Partial<InputCelleRiga> = {},
) {
  return celleDellaRiga({
    nome: 'Rossi M.',
    chiaveMese: NOVEMBRE,
    colonne,
    contratto: { dataAssunzione: null, dataCessazione: null },
    giorni,
    grezzi: {},
    segnalazioni: [],
    config,
    vista,
    ...extra,
  });
}
const cella = (
  giorni: InputCelleRiga['giorni'],
  giorno: string,
  vista?: InputCelleRiga['vista'],
  extra: Partial<InputCelleRiga> = {},
) => celle(giorni, vista, extra).find((c) => c.giorno === giorno);

describe('Colonne del mese', () => {
  it('classifica weekend e festivi e marca oggi', () => {
    const per = (g: string) => colonne.find((c) => c.giorno === g);
    expect(per('01')?.tipo).toBe('festivoNazionale');
    expect(per('01')?.festivita?.nome).toBe('Ognissanti');
    expect(per('07')?.tipo).toBe('sabato');
    expect(per('08')?.tipo).toBe('domenica');
    expect(per('03')).toMatchObject({ tipo: 'feriale', oggi: true, numero: 3, giornoSettimana: 2 });
    expect(per('03')?.etichetta).toBe('martedì 3 novembre 2026');
    expect(colonne.filter((c) => c.oggi)).toHaveLength(1);
  });
});

describe('Cella: chip secondo UX §8.3', () => {
  it('turno: codice sul colore del turno con il suo bordo', () => {
    const c = cella({ '03': { ...cellaVuota(), turno: turno('M1') } }, '03');
    expect(c?.chip).toMatchObject({
      codice: 'M1',
      categoria: 'turno',
      sfondo: '#FDBA74',
      testo: '#111827',
    });
    expect(c?.etichetta).toBe('Rossi M., martedì 3 novembre 2026: M1 Mattina 07:00–14:00');
  });

  it('riposo senza bordo, assenza con bordo grigio e codice in grassetto', () => {
    const riposo = cella({ '03': { ...cellaVuota(), assenza: assenza('R', 'comeRiposo') } }, '03');
    expect(riposo?.chip).toMatchObject({
      categoria: 'riposo',
      sfondo: COLORI.sfondoNeutro,
      bordo: null,
      grassetto: false,
    });
    const ferie = cella({ '03': { ...cellaVuota(), assenza: assenza('F', 'neutra') } }, '03');
    expect(ferie?.chip).toMatchObject({
      categoria: 'assenza',
      bordo: COLORI.bordoNeutro,
      grassetto: true,
    });
  });

  it('turno scoperto: righe diagonali, bordo tratteggiato e, nelle settimane, «MA scoperto»', () => {
    const giorni = {
      '03': { ...cellaVuota(), turno: turno('M1'), assenza: assenza('MA', 'neutra') },
    };
    const mese = cella(giorni, '03');
    expect(mese?.chip).toMatchObject({
      categoria: 'scoperto',
      bordoTratteggiato: true,
      pastiglia: true,
      nota: null,
    });
    expect(mese?.chip?.sfondo).toContain('repeating-linear-gradient');
    expect(mese?.etichetta).toContain('M1 scoperto (MA Malattia)');
    const settimana = cella(giorni, '03', configurazioneVista('settimana', 958, 7));
    expect(settimana?.chip?.nota).toBe('MA scoperto');
  });

  it('un turno sconosciuto alla configurazione è neutro con il bordo tratteggiato', () => {
    const c = cella({ '03': { ...cellaVuota(), turno: turno('Z9') } }, '03');
    expect(c?.chip).toMatchObject({ sfondo: COLORI.sfondoNeutro, bordoTratteggiato: true });
  });

  it('l’orario sotto il codice solo nella vista 1 settimana', () => {
    const giorni = { '03': { ...cellaVuota(), turno: turno('M1') } };
    expect(cella(giorni, '03')?.chip?.orario).toBeNull();
    expect(cella(giorni, '03', configurazioneVista('settimana', 958, 7))?.chip?.orario).toBe(
      '07:00–14:00',
    );
  });
});

describe('Cella: reperibilità secondo la vista (U2, UX §8.2)', () => {
  const giorni = {
    '03': {
      ...cellaVuota(),
      turno: turno('M1'),
      reperibilita: [fascia('R1', '14:00', '20:00', 45), fascia('R2', '20:30', '08:00')],
    },
  };

  it('mese a 1366: solo l’ora di inizio, anche se i minuti non sono 00', () => {
    expect(
      cella(giorni, '03', configurazioneVista('mese', 958, 30))?.striscia.map((v) => v.testo),
    ).toEqual(['14', '20']);
  });

  it('mese a 1920: i minuti non nulli si mostrano', () => {
    expect(
      cella(giorni, '03', configurazioneVista('mese', 1512, 30))?.striscia.map((v) => v.testo),
    ).toEqual(['14', '20:30']);
  });

  it('2 settimane: una riga per reperibilità, codice e fascia, minuti solo se diversi da 00', () => {
    expect(
      cella(giorni, '03', configurazioneVista('settimane2', 958, 14))?.striscia.map((v) => v.testo),
    ).toEqual(['R1 14–20', 'R2 20:30–08']);
  });

  it('1 settimana: fascia completa e durata della chiamata', () => {
    const voci = cella(giorni, '03', configurazioneVista('settimana', 958, 7))?.striscia ?? [];
    expect(voci.map((v) => v.testo)).toEqual(['R1 14:00–20:00', 'R2 20:30–08:00']);
    expect(voci[0]?.chiamata).toBe('☎ 45′');
    expect(voci[1]?.chiamata).toBeNull();
  });

  it('il tooltip e l’etichetta riportano codice, nome, fascia e durata in ogni vista', () => {
    const c = cella(giorni, '03');
    expect(c?.striscia[0]?.tooltip).toBe('R1 Reperibilità pomeriggio · 14:00–20:00 · 6 h');
    expect(c?.etichetta).toContain('reperibilità R1 14:00–20:00; reperibilità R2 20:30–08:00');
  });

  it('segni degli angoli dai dati della cella', () => {
    expect(cella(giorni, '03')?.segni).toEqual({
      chiamata: true,
      sostituzione: false,
      orarioVariato: false,
    });
    const variato = {
      '03': {
        ...cellaVuota(),
        turno: turno('M1'),
        orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:30') },
      },
    };
    expect(cella(variato, '03')?.segni.orarioVariato).toBe(true);
  });
});

describe('Cella: avvisi e fuori servizio', () => {
  it('un avviso dà il livello, il testo e l’etichetta (mai solo il colore)', () => {
    const riposo: Segnalazione = {
      livello: 'avviso',
      codice: 'riposoInsufficiente',
      giorno: dataISO('2026-11-05'),
      giornoPrecedente: dataISO('2026-11-04'),
      minutiRiposo: 540,
      origine: 'turno',
    };
    const c = cella({ '05': { ...cellaVuota(), turno: turno('M1') } }, '05', undefined, {
      segnalazioni: [riposo],
    });
    expect(c?.livello).toBe('avviso');
    expect(c?.avvisi).toBe('Riposo di 9 ore tra il 4 e il 5');
    expect(c?.etichetta).toBe(
      'Rossi M., giovedì 5 novembre 2026: M1 Mattina 07:00–14:00; avviso: Riposo di 9 ore tra il 4 e il 5',
    );
    expect(cella({}, '06', undefined, { segnalazioni: [riposo] })?.livello).toBeNull();
  });

  it('un blocco prevale sull’avviso; una cella non valida salvata è un blocco', () => {
    const c = cella({}, '09', undefined, { grezzi: { '09': { turno: 'boh' } } });
    expect(c).toMatchObject({ livello: 'blocco', grezza: true, chip: null });
    expect(c?.etichetta).toContain('dati non validi');
  });

  it('prima dell’assunzione e dopo la cessazione la cella è fuori servizio con il motivo', () => {
    const assunto = celle({}, undefined, {
      contratto: { dataAssunzione: dataISO('2026-11-15'), dataCessazione: null },
    });
    expect(assunto.find((x) => x.giorno === '14')?.fuoriServizio).toBe(
      'Fuori servizio: assunzione il 15/11/2026',
    );
    expect(assunto.find((x) => x.giorno === '15')?.fuoriServizio).toBeNull();
    const cessato = celle({}, undefined, {
      contratto: { dataAssunzione: null, dataCessazione: dataISO('2026-11-10') },
    });
    expect(cessato.find((x) => x.giorno === '11')?.fuoriServizio).toBe(
      'Fuori servizio: cessazione il 10/11/2026',
    );
    expect(cessato.find((x) => x.giorno === '11')?.etichetta).toContain('fuori servizio');
  });
});

describe('Testi', () => {
  it.each<[string, string]>([
    [testoMotivo('turnoEscluso', 'N1', 'Rossi M.'), 'N1 escluso per Rossi M.'],
    [testoMotivo('codiceInesistente', 'X9', 'Rossi M.'), 'X9: codice inesistente'],
    [testoMotivo('massimoReperibilita', 'R1', 'Rossi M.'), 'Massimo 2 reperibilità al giorno'],
    [testoMotivo('reperibilitaGiaPresente', 'R1', 'Rossi M.'), 'R1 già presente in questa cella'],
    [testoMotivo('consuntivo', '', ''), 'La cella ha dati di consuntivo: modificala dal dettaglio'],
    [
      testoMotivo('fuoriServizio', 'M1', 'Rossi M.', {
        dataAssunzione: dataISO('2026-11-15'),
        dataCessazione: null,
      }),
      'Fuori servizio: assunzione il 15/11/2026',
    ],
  ])('%s', (testo, atteso) => {
    expect(testo).toBe(atteso);
  });

  it('riposo a cavallo di mese: il giorno del mese dopo porta il mese', () => {
    const s: Segnalazione = {
      livello: 'avviso',
      codice: 'riposoInsufficiente',
      giorno: dataISO('2026-12-01'),
      giornoPrecedente: dataISO('2026-11-30'),
      minutiRiposo: 570,
      origine: 'turno',
    };
    expect(testoSegnalazione(s, { nome: 'Rossi M.', chiaveMese: NOVEMBRE })).toBe(
      'Riposo di 9,5 ore tra il 30 e il 1/12',
    );
  });

  it('reperibilità oltre il limite e turno scoperto', () => {
    expect(
      testoSegnalazione(
        {
          livello: 'avviso',
          codice: 'reperibilitaOltreLimite',
          giorno: null,
          minutiReperibilita: 5400,
          unita: 7.5,
          limiteUnita: 7,
        },
        { nome: 'Rossi M.', chiaveMese: NOVEMBRE },
      ),
    ).toBe('Reperibilità: 7,5 su 7 nel mese');
    expect(
      testoSegnalazione(
        {
          livello: 'avviso',
          codice: 'turnoScoperto',
          giorno: dataISO('2026-11-03'),
          codiceTurno: codiceTurno('M1'),
          codiceAssenza: null,
        },
        { nome: 'Rossi M.', chiaveMese: NOVEMBRE },
      ),
    ).toBe('Turno M1 scoperto');
  });

  it('nome breve', () => {
    expect(nomeBreve('Rossi', 'Maria')).toBe('Rossi M.');
    expect(nomeBreve('Rossi', ' ')).toBe('Rossi');
  });
});

describe('Totali e confronto con il salvato', () => {
  it('totali con una cifra decimale, segno e unità', () => {
    const t = totaliDiVista(
      {
        minutiPianificati: 8640,
        minutiDovuti: 9072,
        differenzaMinuti: -432,
        minutiReperibilita: 2160,
        unitaReperibilita: 3,
      },
      7,
    );
    expect(t).toEqual({
      pianificate: '144,0',
      dovute: '151,2',
      differenza: '−7,2',
      differenzaNegativa: true,
      reperibilita: '3,0',
      reperibilitaOltre: false,
    });
    expect(
      totaliDiVista(
        {
          minutiPianificati: 0,
          minutiDovuti: 0,
          differenzaMinuti: 0,
          minutiReperibilita: 6120,
          unitaReperibilita: 8.5,
        },
        7,
      ),
    ).toMatchObject({
      reperibilita: '8,5',
      reperibilitaOltre: true,
    });
  });

  it('uguaglianza strutturale indipendente dall’ordine delle chiavi', () => {
    expect(uguali({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(uguali({ a: 1 }, { a: 2 })).toBe(false);
    expect(uguali([1], [1, 2])).toBe(false);
    expect(uguali({ a: undefined }, { b: undefined })).toBe(false);
  });

  it('una cella vuota e una cella assente sono la stessa cosa; tornare al salvato toglie la modifica', () => {
    const m1 = { ...cellaVuota(), turno: turno('M1') };
    expect(celleUguali(cellaVuota(), undefined)).toBe(true);
    expect(celleUguali(m1, { ...m1 })).toBe(true);
    expect(celleUguali(m1, undefined)).toBe(false);
    expect([
      ...giorniModificati({ '03': m1, '04': cellaVuota() }, { '03': { ...m1 }, '05': m1 }),
    ]).toEqual(['05']);
    expect([...giorniModificati({ '03': m1 }, undefined)]).toEqual(['03']);
  });
});

describe('Consuntivo nella cella (step 3.2, UX §8.2, §9.11)', () => {
  const nomi = (id: string): string => (id === 'b' ? 'Bianchi L.' : id === 'r' ? 'Rossi M.' : id);
  const base: CellaDoc = { ...cellaVuota(), turno: turno('M1') };

  it('l’orario variato è quello del dominio: uguale al previsto non è un segno; diverso sì, con tooltip e differenza', () => {
    const uguale = cella(
      { '03': { ...base, orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:00') } } },
      '03',
    );
    expect(uguale?.segni.orarioVariato).toBe(false);
    expect(uguale?.dettagli).toEqual([]);
    const variata = cella(
      { '03': { ...base, orarioReale: { inizio: oraLocale('07:00'), fine: oraLocale('14:30') } } },
      '03',
    );
    expect(variata?.segni.orarioVariato).toBe(true);
    expect(variata?.dettagli).toEqual(['Orario reale 07:00–14:30 (previsto 07:00–14:00): +30 min']);
    expect(variata?.etichetta).toContain('Orario reale 07:00–14:30');
    // Orari spostati con la stessa durata: segno sì, differenza «durata invariata».
    const spostata = cella(
      { '03': { ...base, orarioReale: { inizio: oraLocale('08:00'), fine: oraLocale('15:00') } } },
      '03',
      undefined,
      { nomeDi: nomi },
    );
    expect(spostata?.dettagli[0]).toContain('durata invariata');
  });

  it('«Sostituisce …» e «coperto da …» per il turno, «R1: sostituisce …» per le fasce', () => {
    const sostituto = cella({ '03': { ...base, sostituisce: 'r' } }, '03', undefined, {
      nomeDi: nomi,
    });
    expect(sostituto?.dettagli).toEqual(['Sostituisce Rossi M.']);
    expect(sostituto?.segni.sostituzione).toBe(true);
    const assente = cella(
      { '03': { ...base, assenza: assenza('MA', 'neutra'), copertoDa: 'b' } },
      '03',
      undefined,
      { nomeDi: nomi },
    );
    expect(assente?.dettagli).toEqual(['M1 coperto da Bianchi L.']);
    const conFascia = cella(
      {
        '03': {
          ...cellaVuota(),
          assenza: assenza('MA', 'neutra'),
          reperibilita: [
            { ...fascia('R1', '14:00', '20:00'), copertaDa: 'b' },
            { ...fascia('R2', '20:00', '08:00'), sostituisce: 'r' },
          ],
        },
      },
      '03',
      undefined,
      { nomeDi: nomi },
    );
    expect(conFascia?.dettagli).toEqual(['R1 coperta da Bianchi L.', 'R2: sostituisce Rossi M.']);
  });

  it('senza `nomeDi` il collega è «Dipendente rimosso», mai un ID', () => {
    const sostituto = cella({ '03': { ...base, sostituisce: 'xyz' } }, '03');
    expect(sostituto?.dettagli).toEqual(['Sostituisce Dipendente rimosso']);
  });

  it('un testo per ogni motivo di «Non disponibili» (L9), fuoriServizio compreso', () => {
    const assenzaDescrizione = (codice: string): string => (codice === 'F' ? 'Ferie' : codice);
    const testo = (m: Parameters<typeof testoNonDisponibile>[0]): string =>
      testoNonDisponibile(m, assenzaDescrizione);
    expect(testo({ codice: 'fuoriServizio' })).toBe('fuori servizio quel giorno');
    expect(testo({ codice: 'assente', codiceAssenza: codiceAssenza('F') })).toBe('assente (Ferie)');
    expect(testo({ codice: 'turnoEscluso', codiceTurno: codiceTurno('M1') })).toBe(
      'M1 tra i turni esclusi',
    );
    expect(
      testo({
        codice: 'giaInServizio',
        tipo: 'turno',
        giorno: dataISO('2026-11-02'),
        codiceTurno: codiceTurno('N1'),
        inizio: oraLocale('22:00'),
        fine: oraLocale('07:00'),
      }),
    ).toBe('già in servizio (N1 22:00–07:00 del 2 nov)');
    expect(
      testo({
        codice: 'giaInServizio',
        tipo: 'reperibilita',
        giorno: dataISO('2026-11-03'),
        codiceTurno: codiceTurno('R1'),
        inizio: oraLocale('14:00'),
        fine: oraLocale('20:00'),
      }),
    ).toBe('già in reperibilità (R1 14:00–20:00 del 3 nov)');
    expect(
      testo({
        codice: 'haGiaTurno',
        codiceTurno: codiceTurno('P1'),
        inizio: oraLocale('14:00'),
        fine: oraLocale('22:00'),
      }),
    ).toBe('ha già il turno P1 (14:00–22:00)');
    expect(testo({ codice: 'massimoReperibilita' })).toBe('ha già 2 reperibilità');
  });
});
