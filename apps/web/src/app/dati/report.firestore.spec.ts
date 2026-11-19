// Convertitori del report (PIANO 4.1): un documento senza la forma attesa non entra nella schermata, mai un valore
// inventato.
import { reportDaDati } from './report.firestore';
import { riepilogoFestivitaAnno, riepilogoPerReport } from './riepiloghi.firestore';

const istante = (ms: number) => ({ toMillis: () => ms });
const CONTEGGI = {
  turniSvolti: 6,
  notti: 2,
  sabati: 1,
  domenicheEFestivi: 4,
  reperibilitaSvolte: 1,
  chiamate: 1,
  minutiChiamate: 90,
};
const REPORT = {
  idBimestre: '2026-B6',
  anno: 2026,
  bimestre: 6,
  mesi: ['2026-11', '2026-12'],
  mesiInclusi: ['2026-11', '2026-12'],
  righe: { d1: CONTEGGI },
  totali: CONTEGGI,
  generatoIl: istante(1000),
  generatoDa: 'sistema',
  file: null,
  invii: {
    d1: {
      esito: 'accodato',
      il: istante(5000),
      mailId: 'auto_r1_2026-B6_d1',
      mesiInclusi: ['2026-11', '2026-12'],
    },
    d2: {
      esito: 'senzaEmail',
      il: istante(4000),
      mailId: null,
      mesiInclusi: ['2026-11', '2026-12'],
    },
  },
  invioAutomaticoIl: istante(3000),
};

describe('reportDaDati', () => {
  it('legge righe, totali, esiti dei singoli invii e l’ultimo invio', () => {
    const r = reportDaDati(REPORT);
    expect(r?.idBimestre).toBe('2026-B6');
    expect(r?.mesiInclusi).toEqual(['2026-11', '2026-12']);
    expect(r?.righe['d1']).toEqual(CONTEGGI);
    expect(r?.totali).toEqual(CONTEGGI);
    expect(r?.generatoIlMs).toBe(1000);
    expect(r?.invii['d1']).toEqual({
      esito: 'accodato',
      ilMs: 5000,
      mailId: 'auto_r1_2026-B6_d1',
      mesiInclusi: ['2026-11', '2026-12'],
    });
    expect(r?.invii['d2']).toEqual({
      esito: 'senzaEmail',
      ilMs: 4000,
      mailId: null,
      mesiInclusi: ['2026-11', '2026-12'],
    });
    expect(r?.invioAutomaticoIlMs).toBe(3000);
    expect(r?.inviato).toBe(true);
    expect(r?.ultimoInvioMs).toBe(5000);
  });

  it('senza invio automatico conta l’ultima email accodata a mano; con tutti senza email è evaso', () => {
    const manuale = reportDaDati({ ...REPORT, invioAutomaticoIl: null });
    expect(manuale?.inviato).toBe(true);
    expect(manuale?.invioAutomaticoIlMs).toBeNull();
    expect(manuale?.ultimoInvioMs).toBe(5000);
    const nessuno = reportDaDati({
      ...REPORT,
      invioAutomaticoIl: null,
      invii: { d2: REPORT.invii.d2 },
    });
    expect(nessuno?.inviato).toBe(true); // nessuno ha l'email: non c'è altro da fare (rilievo 6)
    expect(nessuno?.ultimoInvioMs).toBeNull();
    const vuoto = reportDaDati({ ...REPORT, invioAutomaticoIl: null, invii: {} });
    expect(vuoto?.inviato).toBe(false);
  });

  it('un invio a mano con un errore o con un solo mese non chiude il bimestre (review 4.1, rilievi 1 e 3)', () => {
    const conErrore = reportDaDati({
      ...REPORT,
      invioAutomaticoIl: null,
      invii: { d1: REPORT.invii.d1, d2: { ...REPORT.invii.d2, esito: 'errore' } },
    });
    expect(conErrore?.inviato).toBe(false);
    const parziale = reportDaDati({
      ...REPORT,
      invioAutomaticoIl: null,
      invii: { d1: { ...REPORT.invii.d1, mesiInclusi: ['2026-11'] } },
    });
    expect(parziale?.inviato).toBe(false);
    expect(parziale?.ultimoInvioMs).toBe(5000);
  });

  it.each([
    ['bimestre non valido', { ...REPORT, idBimestre: '2026-B7' }],
    ['mesi non un elenco', { ...REPORT, mesiInclusi: 'x' }],
    ['mese non valido', { ...REPORT, mesiInclusi: ['2026-13'] }],
    ['righe non una mappa', { ...REPORT, righe: [] }],
    ['riga senza conteggi', { ...REPORT, righe: { d1: { turniSvolti: 1 } } }],
    ['totali mancanti', { ...REPORT, totali: undefined }],
    ['invii non una mappa', { ...REPORT, invii: [] }],
    ['invio non una mappa', { ...REPORT, invii: { d1: 'x' } }],
    [
      'esito sconosciuto',
      { ...REPORT, invii: { d1: { esito: 'boh', il: istante(1), mailId: null } } },
    ],
    [
      'invio senza istante',
      { ...REPORT, invii: { d1: { esito: 'accodato', il: 1, mailId: null } } },
    ],
    [
      'mailId non valido',
      { ...REPORT, invii: { d1: { esito: 'accodato', il: istante(1), mailId: 5 } } },
    ],
  ])('rifiuta: %s', (_nome, dati) => {
    expect(reportDaDati(dati)).toBeNull();
  });
});

describe('riepilogoPerReport', () => {
  it('legge i conteggi del report', () => {
    expect(riepilogoPerReport({ dipendenteId: 'd1', chiaveMese: '2026-11', ...CONTEGGI })).toEqual({
      dipendenteId: 'd1',
      chiaveMese: '2026-11',
      ...CONTEGGI,
    });
  });

  it.each([
    ['senza dipendente', { chiaveMese: '2026-11', ...CONTEGGI }],
    ['mese non valido', { dipendenteId: 'd1', chiaveMese: '2026-13', ...CONTEGGI }],
    ['conteggio negativo', { dipendenteId: 'd1', chiaveMese: '2026-11', ...CONTEGGI, notti: -1 }],
    [
      'conteggio mancante',
      { dipendenteId: 'd1', chiaveMese: '2026-11', ...CONTEGGI, chiamate: undefined },
    ],
  ])('rifiuta: %s', (_nome, dati) => {
    expect(riepilogoPerReport(dati)).toBeNull();
  });
});

describe('riepilogoFestivitaAnno', () => {
  const BASE = {
    dipendenteId: 'd1',
    chiaveMese: '2026-12',
    anno: 2026,
    festivitaLavorate: [{ idFestivita: 'natale', giorno: '25', codice: 'P1' }],
  };

  it('porta con sé lo stato del mese', () => {
    expect(riepilogoFestivitaAnno({ ...BASE, statoMese: 'bozza' })).toMatchObject({
      statoMese: 'bozza',
      dipendenteId: 'd1',
    });
  });

  it('rifiuta uno stato sconosciuto o un riepilogo non leggibile', () => {
    expect(riepilogoFestivitaAnno({ ...BASE, statoMese: 'boh' })).toBeNull();
    expect(
      riepilogoFestivitaAnno({ ...BASE, statoMese: 'bozza', festivitaLavorate: 'x' }),
    ).toBeNull();
  });
});
