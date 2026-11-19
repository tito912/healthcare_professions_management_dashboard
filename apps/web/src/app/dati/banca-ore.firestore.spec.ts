// Convertitori della banca ore e dei riepiloghi per classifica e dettaglio (PIANO 3.2): un documento senza la forma
// attesa non entra nelle tabelle, mai un valore inventato.
import { bancaOreDaDati } from './banca-ore.firestore';
import { riepilogoDelDipendente, riepilogoPerClassifica } from './riepiloghi.firestore';

const BANCA = {
  dipendenteId: 'd1',
  anno: 2026,
  riportoMinuti: 600,
  mesi: { '10': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true } },
  saldoAnnoMinuti: -168,
  saldoDefinitivoMinuti: -168,
  provvisorio: false,
  calcolatoIl: 'istante',
};

describe('bancaOreDaDati', () => {
  it('legge un documento valido e non porta con sé l’istante del calcolo', () => {
    expect(bancaOreDaDati(BANCA)).toEqual({
      dipendenteId: 'd1',
      anno: 2026,
      riportoMinuti: 600,
      mesi: {
        '10': { minutiLavorati: 7440, minutiDovuti: 8208, saldoMinuti: -768, definitivo: true },
      },
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: -168,
      provvisorio: false,
    });
  });

  it.each([
    ['senza dipendente', { ...BANCA, dipendenteId: 1 }],
    ['anno non numerico', { ...BANCA, anno: '2026' }],
    ['saldo mancante', { ...BANCA, saldoAnnoMinuti: undefined }],
    ['provvisorio non booleano', { ...BANCA, provvisorio: 'no' }],
    ['mesi non una mappa', { ...BANCA, mesi: [] }],
    ['mese fuori dall’anno', { ...BANCA, mesi: { '13': BANCA.mesi['10'] } }],
    ['mese senza saldo', { ...BANCA, mesi: { '10': { ...BANCA.mesi['10'], saldoMinuti: null } } }],
    ['mese senza stato', { ...BANCA, mesi: { '10': { ...BANCA.mesi['10'], definitivo: 1 } } }],
  ])('rifiuta: %s', (_nome, dati) => {
    expect(bancaOreDaDati(dati)).toBeNull();
  });
});

describe('riepilogoPerClassifica', () => {
  it('legge dipendente, mese e conteggi per codice', () => {
    expect(
      riepilogoPerClassifica({
        dipendenteId: 'd1',
        chiaveMese: '2026-09',
        conteggiPerCodice: { M1: 2, R1: 1 },
        altro: 1,
      }),
    ).toEqual({ dipendenteId: 'd1', chiaveMese: '2026-09', conteggiPerCodice: { M1: 2, R1: 1 } });
  });

  it.each([
    ['mese non valido', { dipendenteId: 'd1', chiaveMese: '2026-13', conteggiPerCodice: {} }],
    [
      'conteggio non numerico',
      { dipendenteId: 'd1', chiaveMese: '2026-09', conteggiPerCodice: { M1: 'x' } },
    ],
    ['senza conteggi', { dipendenteId: 'd1', chiaveMese: '2026-09' }],
  ])('rifiuta: %s', (_nome, dati) => {
    expect(riepilogoPerClassifica(dati)).toBeNull();
  });
});

describe('riepilogoDelDipendente', () => {
  const RIEPILOGO = {
    dipendenteId: 'd1',
    chiaveMese: '2026-11',
    statoMese: 'bozza',
    valida: true,
    variazioni: 1,
    minutiVariazioni: 30,
    assenzePerCodice: { F: 2 },
  };

  it('legge i campi del dettaglio', () => {
    expect(riepilogoDelDipendente(RIEPILOGO)).toEqual(RIEPILOGO);
  });

  it.each([
    ['stato sconosciuto', { ...RIEPILOGO, statoMese: 'altro' }],
    ['validità mancante', { ...RIEPILOGO, valida: undefined }],
    ['assenze non valide', { ...RIEPILOGO, assenzePerCodice: { F: 'due' } }],
  ])('rifiuta: %s', (_nome, dati) => {
    expect(riepilogoDelDipendente(dati)).toBeNull();
  });
});
