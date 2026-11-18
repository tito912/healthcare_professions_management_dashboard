import { describe, expect, it } from 'vitest';
import { analizzaInput } from './analisi';
import {
  schemaLeggiDatiPrivatiInput,
  schemaSalvaDipendenteInput,
  type SalvaDipendenteInput,
} from './dipendenti';

const anagrafica = {
  nome: 'Laura',
  cognome: 'Bianchi',
  oreSettimanali: 36,
  turniEsclusi: ['N1'],
  dataAssunzione: null,
  dataCessazione: null,
  attivo: true,
};
const privati = { codiceFiscale: 'BNCLRA80A41H501D', dataNascita: '1980-01-01', email: 'l@b.it' };
const base: SalvaDipendenteInput = {
  repartoId: 'rep1',
  dipendenteId: null,
  anagrafica,
  privati,
};

function con(cambi: Partial<SalvaDipendenteInput>): unknown {
  return { ...base, ...cambi };
}
function conAnagrafica(cambi: Record<string, unknown>): unknown {
  return { ...base, anagrafica: { ...anagrafica, ...cambi } };
}

describe('salvaDipendente: input', () => {
  it('accetta una creazione completa', () => {
    expect(analizzaInput(schemaSalvaDipendenteInput, base).valido).toBe(true);
  });

  it('accetta una modifica senza dati riservati', () => {
    expect(
      analizzaInput(schemaSalvaDipendenteInput, con({ dipendenteId: 'd1', privati: null })),
    ).toMatchObject({
      valido: true,
    });
  });

  it('normalizza nomi ed email vuota', () => {
    const esito = analizzaInput(
      schemaSalvaDipendenteInput,
      conAnagrafica({ nome: ' Laura ', cognome: 'Bianchi' }),
    );
    expect(esito).toMatchObject({ valido: true, valore: { anagrafica: { nome: 'Laura' } } });
    const senzaEmail = analizzaInput(schemaSalvaDipendenteInput, {
      ...base,
      privati: { ...privati, email: '   ' },
    });
    expect(senzaEmail).toMatchObject({ valido: true, valore: { privati: { email: null } } });
  });

  it.each([
    ['nome vuoto', conAnagrafica({ nome: '  ' }), ['anagrafica.nome']],
    ['ore 0', conAnagrafica({ oreSettimanali: 0 }), ['anagrafica.oreSettimanali']],
    ['ore 36,25', conAnagrafica({ oreSettimanali: 36.25 }), ['anagrafica.oreSettimanali']],
    ['ore 49', conAnagrafica({ oreSettimanali: 49 }), ['anagrafica.oreSettimanali']],
    ['ore come testo', conAnagrafica({ oreSettimanali: '36' }), ['anagrafica.oreSettimanali']],
    [
      'turno escluso non valido',
      conAnagrafica({ turniEsclusi: ['n1'] }),
      ['anagrafica.turniEsclusi.0'],
    ],
    [
      'turni esclusi doppi',
      conAnagrafica({ turniEsclusi: ['N1', 'N1'] }),
      ['anagrafica.turniEsclusi'],
    ],
    [
      'data inesistente',
      conAnagrafica({ dataAssunzione: '2026-02-30' }),
      ['anagrafica.dataAssunzione'],
    ],
    [
      'disattivato senza data di cessazione',
      conAnagrafica({ attivo: false }),
      ['anagrafica.dataCessazione'],
    ],
    [
      'assunzione dopo la cessazione',
      conAnagrafica({ dataAssunzione: '2026-05-01', dataCessazione: '2026-04-30' }),
      ['anagrafica.dataCessazione'],
    ],
    ['campo in più nell’anagrafica', conAnagrafica({ ruolo: 'ADMIN' }), ['anagrafica']],
    [
      'data di nascita prima del 1900',
      con({ privati: { ...privati, dataNascita: '1899-12-31' } }),
      ['privati.dataNascita'],
    ],
    [
      'data di nascita non valida',
      con({ privati: { ...privati, dataNascita: '01/01/1980' } }),
      ['privati.dataNascita'],
    ],
    ['ID del reparto con barra', con({ repartoId: 'reparti/rep1' }), ['repartoId']],
    ['ID del dipendente riservato', con({ dipendenteId: '__x__' }), ['dipendenteId']],
    ['privati assenti', { repartoId: 'rep1', dipendenteId: null, anagrafica }, ['privati']],
  ])('%s', (_caso, dati, campi) => {
    expect(analizzaInput(schemaSalvaDipendenteInput, dati)).toEqual({ valido: false, campi });
  });

  it('nei campi non valido non compaiono mai i valori', () => {
    const esito = analizzaInput(
      schemaSalvaDipendenteInput,
      con({ privati: { ...privati, dataNascita: 'BNCLRA80A41H501D' } }),
    );
    expect(JSON.stringify(esito)).not.toContain('BNCLRA');
  });
});

describe('leggiDatiPrivati: input', () => {
  it('accetta due ID', () => {
    expect(
      analizzaInput(schemaLeggiDatiPrivatiInput, { repartoId: 'r1', dipendenteId: 'd1' }).valido,
    ).toBe(true);
  });

  it('rifiuta campi mancanti o in più', () => {
    expect(analizzaInput(schemaLeggiDatiPrivatiInput, { repartoId: 'r1' }).valido).toBe(false);
    expect(
      analizzaInput(schemaLeggiDatiPrivatiInput, { repartoId: 'r1', dipendenteId: 'd1', x: 1 })
        .valido,
    ).toBe(false);
  });
});
