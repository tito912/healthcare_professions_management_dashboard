import {
  chiaveMese,
  codiceTurno,
  dataISO,
  idBimestre,
  type ConfigurazioneFestivita,
} from '@turni/domain';
import { conteggi, mesiDel, reportSalvato, riepilogoReport } from '../../test/monta-report';
import { dipendente } from '../../test/monta-griglia';
import {
  celleConteggi,
  durataVista,
  nomiMesi,
  righeReport,
  ultimoInvioVista,
  valoreVista,
  vistaBimestre,
  vistaFestivita,
} from './modello';

/** 6 gennaio 2027, 07:00 UTC (08:00 a Roma). */
const ISTANTE_INVIO = 1799218800000;

const ID = idBimestre('2026-B6');

describe('testi dei valori', () => {
  it('il provvisorio ha il prefisso «≈»; la durata zero è un trattino', () => {
    expect(valoreVista(5, false)).toBe('5');
    expect(valoreVista(5, true)).toBe('≈5');
    expect(durataVista(0, true)).toBe('—');
    expect(durataVista(90, false)).toBe('1 h 30');
    expect(durataVista(45, true)).toBe('≈45 min');
    expect(celleConteggi(conteggi({ turniSvolti: 2, minutiChiamate: 60 }), true)).toEqual({
      turni: '≈2',
      notti: '≈0',
      sabati: '≈0',
      domeniche: '≈0',
      reperibilita: '≈0',
      chiamate: '≈0',
      durata: '≈1 h',
    });
    expect(nomiMesi([chiaveMese('2026-11'), chiaveMese('2026-12')])).toEqual([
      'novembre',
      'dicembre',
    ]);
  });

  it('l’ultimo invio: accodato con data e ora, senza email, errore, nessuno', () => {
    expect(ultimoInvioVista(undefined)).toEqual({ testo: '—', esito: null });
    expect(
      ultimoInvioVista({ esito: 'senzaEmail', ilMs: 0, mailId: null, mesiInclusi: [] }),
    ).toEqual({
      testo: 'senza email',
      esito: 'senzaEmail',
    });
    expect(
      ultimoInvioVista({ esito: 'errore', ilMs: 0, mailId: null, mesiInclusi: [] }).testo,
    ).toBe('errore: riprova');
    expect(
      ultimoInvioVista({ esito: 'accodato', ilMs: ISTANTE_INVIO, mailId: 'm', mesiInclusi: [] })
        .testo,
    ).toMatch(/^accodato 06\/01\/2027 \d\d:\d\d$/);
  });
});

describe('vistaBimestre', () => {
  const riepiloghi = [
    riepilogoReport('d1', '2026-11', { turniSvolti: 3 }),
    riepilogoReport('d1', '2026-12', { turniSvolti: 2 }),
  ];
  const documento = reportSalvato(ID, {
    mesiInclusi: [chiaveMese('2026-11'), chiaveMese('2026-12')],
    righe: { d1: conteggi({ turniSvolti: 9 }) },
    totali: conteggi({ turniSvolti: 9 }),
  });

  it('con un mese in bozza somma i riepiloghi dei mesi creati ed è provvisoria', () => {
    const v = vistaBimestre(ID, mesiDel('convalidato', 'bozza'), documento, riepiloghi);
    expect(v.provvisorio).toBe(true);
    expect(v.daDocumento).toBe(false);
    expect(v.mesiMostrati).toEqual(['2026-11', '2026-12']);
    expect(v.mesiConvalidati).toEqual(['2026-11']);
    expect(v.mesiNonConvalidati).toEqual(['2026-12']);
    expect(v.righe['d1']?.turniSvolti).toBe(5);
    expect(v.totali.turniSvolti).toBe(5);
  });

  it('con entrambi i mesi convalidati e il documento completo usa il documento', () => {
    const v = vistaBimestre(ID, mesiDel('convalidato', 'convalidato'), documento, riepiloghi);
    expect(v.provvisorio).toBe(false);
    expect(v.daDocumento).toBe(true);
    expect(v.righe['d1']?.turniSvolti).toBe(9);
  });

  it('senza documento, o con un documento che non comprende entrambi i mesi, somma i riepiloghi', () => {
    const senza = vistaBimestre(ID, mesiDel('convalidato', 'convalidato'), null, riepiloghi);
    expect(senza.daDocumento).toBe(false);
    expect(senza.provvisorio).toBe(false);
    expect(senza.totali.turniSvolti).toBe(5);
    const parziale = vistaBimestre(
      ID,
      mesiDel('convalidato', 'convalidato'),
      { ...documento, mesiInclusi: [chiaveMese('2026-11')] },
      riepiloghi,
    );
    expect(parziale.daDocumento).toBe(false);
  });

  it('un mese non creato non entra nella somma ed è non convalidato', () => {
    const v = vistaBimestre(ID, mesiDel('convalidato', null), null, riepiloghi);
    expect(v.mesiMostrati).toEqual(['2026-11']);
    expect(v.mesiNonConvalidati).toEqual(['2026-12']);
    expect(v.totali.turniSvolti).toBe(3);
  });
});

describe('righeReport', () => {
  it('in ordine di cognome e nome, con i rimossi in fondo e lo stato dell’invio', () => {
    const dipendenti = [dipendente('d1', 'Rossi', 'Mario'), dipendente('d2', 'Bianchi', 'Laura')];
    const v = vistaBimestre(ID, mesiDel('convalidato', 'convalidato'), null, [
      riepilogoReport('dX', '2026-11', {}),
      riepilogoReport('d1', '2026-11', { turniSvolti: 1 }),
      riepilogoReport('d2', '2026-11', {}),
    ]);
    const report = reportSalvato(ID, {
      righe: {},
      totali: conteggi({}),
      invii: { d1: { esito: 'senzaEmail', ilMs: 0, mailId: null, mesiInclusi: [] } },
    });
    const righe = righeReport(dipendenti, v, report);
    expect(righe.map((r) => r.nome)).toEqual(['Bianchi L.', 'Rossi M.', 'Dipendente rimosso']);
    expect(righe[1]?.nomeCompleto).toBe('Rossi Mario');
    expect(righe[1]?.ultimoInvio.testo).toBe('senza email');
    expect(righe[0]?.ultimoInvio.testo).toBe('—');
  });
});

describe('vistaFestivita', () => {
  const config: ConfigurazioneFestivita = { nazionaliEscluse: [], locali: [] };
  const lavorata = (idFestivita: string, codice: string) => ({
    idFestivita,
    giorno: '01' as const,
    codice: codiceTurno(codice),
  });
  const dipendenti = [
    dipendente('d1', 'Rossi', 'Mario'),
    dipendente('d2', 'Bianchi', 'Laura', { dataCessazione: dataISO('2025-12-31') }),
    dipendente('d3', 'Verdi', 'Anna', { dataAssunzione: dataISO('2027-01-01') }),
    dipendente('d4', 'Neri', 'Elisa', { dataCessazione: dataISO('2025-06-01') }),
  ];

  it('righe: in servizio nell’anno o con festività lavorate; colonne ordinate per data; «Dipendente rimosso» in fondo', () => {
    const v = vistaFestivita(2026, config, dipendenti, [
      {
        dipendenteId: 'd4',
        chiaveMese: chiaveMese('2026-01'),
        anno: 2026,
        statoMese: 'convalidato',
        festivitaLavorate: [lavorata('capodanno', 'M1')],
      },
      {
        dipendenteId: 'dZ',
        chiaveMese: chiaveMese('2026-12'),
        anno: 2026,
        statoMese: 'bozza',
        festivitaLavorate: [lavorata('natale', 'P1')],
      },
    ]);
    expect(v.righe.map((r) => r.id)).toEqual(['d4', 'd1', 'dZ']);
    expect(v.righe.map((r) => r.nome)).toEqual(['Neri E.', 'Rossi M.', 'Dipendente rimosso']);
    expect(v.colonne[0]).toMatchObject({ id: 'capodanno', data: '01/01' });
    const indiceNatale = v.colonne.findIndex((c) => c.id === 'natale');
    expect(v.righe[2]?.celle[indiceNatale]).toBe('P1');
    expect(v.righe[1]?.totale).toBe(0);
    expect(v.conBozza).toBe(true);
  });

  it('senza mesi in bozza con festività non avverte', () => {
    const v = vistaFestivita(2026, config, dipendenti, [
      {
        dipendenteId: 'd1',
        chiaveMese: chiaveMese('2026-01'),
        anno: 2026,
        statoMese: 'convalidato',
        festivitaLavorate: [lavorata('capodanno', 'M1')],
      },
      {
        dipendenteId: 'd1',
        chiaveMese: chiaveMese('2026-02'),
        anno: 2026,
        statoMese: 'bozza',
        festivitaLavorate: [],
      },
    ]);
    expect(v.conBozza).toBe(false);
  });
});
