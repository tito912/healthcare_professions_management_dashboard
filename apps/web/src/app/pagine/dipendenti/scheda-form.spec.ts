import { describe, expect, it } from 'vitest';
import { codiceTurno, dataISO } from '@turni/domain';
import { testi } from '../../testi/it';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import {
  cessazioneDaConfermareNelForm,
  codiceFiscaleDaSegnalare,
  erroreCodiceFiscale,
  formDa,
  formVuoto,
  improntaForm,
  inputSalvataggio,
  validaForm,
  type FormDipendente,
} from './scheda-form';

const OGGI = '2026-11-18';
const CF = 'BNCLRA80A41H501D';
const NUOVO = { nuovo: true, privatiCaricati: false, oggi: OGGI } as const;
const ESISTENTE = { nuovo: false, privatiCaricati: true, oggi: OGGI } as const;
const PRIVATI = { codiceFiscale: CF, dataNascita: dataISO('1980-01-01'), email: 'l@b.it' };

function completo(cambi: Partial<FormDipendente> = {}): FormDipendente {
  return {
    ...formVuoto(),
    nome: 'Laura',
    cognome: 'Bianchi',
    codiceFiscale: CF,
    dataNascita: '1980-01-01',
    email: 'L@B.it',
    ...cambi,
  };
}

const dipendente: DipendenteSalvato = {
  id: 'd1',
  nome: 'Laura',
  cognome: 'Bianchi',
  oreSettimanali: 37.5,
  turniEsclusi: [codiceTurno('N1')],
  dataAssunzione: null,
  dataCessazione: null,
  attivo: true,
};

describe('form vuoto', () => {
  it('propone 36 ore e nessun turno escluso', () => {
    expect(formVuoto()).toMatchObject({ ore: '36', turniEsclusi: [], attivo: true });
  });
});

describe('formDa', () => {
  it('ore con la virgola e dati riservati se disponibili', () => {
    expect(formDa(dipendente, PRIVATI)).toMatchObject({
      ore: '37,5',
      turniEsclusi: ['N1'],
      codiceFiscale: CF,
      dataNascita: '1980-01-01',
      email: 'l@b.it',
    });
  });

  it('senza dati riservati i campi restano vuoti', () => {
    expect(formDa(dipendente, null)).toMatchObject({
      codiceFiscale: '',
      dataNascita: '',
      email: '',
    });
  });
});

describe('validaForm: nuovo dipendente', () => {
  it('form completo → input normalizzato con i dati riservati', () => {
    const esito = validaForm(completo({ codiceFiscale: ' bnclra 80a41 h501d ' }), NUOVO, null);
    expect(esito).toEqual({
      valido: true,
      anagrafica: {
        nome: 'Laura',
        cognome: 'Bianchi',
        oreSettimanali: 36,
        turniEsclusi: [],
        dataAssunzione: null,
        dataCessazione: null,
        attivo: true,
      },
      privati: { codiceFiscale: CF, dataNascita: '1980-01-01', email: 'l@b.it' },
    });
  });

  it('email facoltativa', () => {
    const esito = validaForm(completo({ email: '  ' }), NUOVO, null);
    expect(esito).toMatchObject({ valido: true, privati: { email: null } });
  });

  it('campi vuoti: un errore per campo, con i testi dell’interfaccia', () => {
    const esito = validaForm(formVuoto(), NUOVO, null);
    expect(esito).toEqual({
      valido: false,
      errori: {
        nome: testi.dipendenti.errori.nome,
        cognome: testi.dipendenti.errori.cognome,
        codiceFiscale: testi.dipendenti.errori.cfVuoto,
        dataNascita: testi.dipendenti.errori.nascitaVuota,
      },
    });
  });

  it.each([
    [
      'codice fiscale con controllo errato',
      { codiceFiscale: 'BNCLRA80A41H501X' },
      'codiceFiscale',
      testi.dipendenti.errori.cfControllo,
    ],
    [
      'codice fiscale corto',
      { codiceFiscale: 'BNCLRA' },
      'codiceFiscale',
      testi.dipendenti.errori.cfLunghezza,
    ],
    [
      'codice fiscale con formato errato',
      { codiceFiscale: 'BNCLRA80X41H501D' },
      'codiceFiscale',
      testi.dipendenti.errori.cfFormato,
    ],
    [
      'data di nascita nel futuro',
      { dataNascita: '2027-01-01' },
      'dataNascita',
      testi.dipendenti.errori.nascitaNonValida,
    ],
    [
      'data di nascita inesistente',
      { dataNascita: '1980-02-30' },
      'dataNascita',
      testi.dipendenti.errori.nascitaNonValida,
    ],
    ['email non valida', { email: 'laura@' }, 'email', testi.dipendenti.errori.email],
    ['ore 36,25', { ore: '36,25' }, 'ore', testi.dipendenti.errori.ore],
    ['ore 0', { ore: '0' }, 'ore', testi.dipendenti.errori.ore],
    [
      'data di assunzione non valida',
      { dataAssunzione: '2026-13-01' },
      'dataAssunzione',
      testi.dipendenti.errori.data,
    ],
    [
      'cessazione prima dell’assunzione',
      { dataAssunzione: '2026-05-01', dataCessazione: '2026-04-30' },
      'dataCessazione',
      testi.dipendenti.errori.cessazionePrimaAssunzione,
    ],
    [
      'disattivato senza data di cessazione',
      { attivo: false },
      'dataCessazione',
      testi.dipendenti.errori.cessazioneObbligatoria,
    ],
  ] as const)('%s', (_caso, cambi, campo, messaggio) => {
    const esito = validaForm(completo(cambi), NUOVO, null);
    expect(esito).toMatchObject({ valido: false, errori: { [campo]: messaggio } });
  });

  it('turni esclusi ordinati e senza valori non validi', () => {
    const esito = validaForm(completo({ turniEsclusi: ['R1', 'N1', 'xx'] }), NUOVO, null);
    expect(esito).toMatchObject({ valido: true, anagrafica: { turniEsclusi: ['N1', 'R1'] } });
  });
});

describe('validaForm: dipendente esistente', () => {
  const form = formDa(dipendente, PRIVATI);

  it('dati riservati invariati → privati null (il server li lascia come sono)', () => {
    expect(validaForm(form, ESISTENTE, PRIVATI)).toMatchObject({ valido: true, privati: null });
    // Anche con maiuscole e spazi diversi nel codice fiscale e nell'email.
    expect(
      validaForm(
        { ...form, codiceFiscale: ' bnclra80a41h501d ', email: 'L@B.it ' },
        ESISTENTE,
        PRIVATI,
      ),
    ).toMatchObject({ valido: true, privati: null });
  });

  it('dati riservati cambiati → si mandano tutti e tre', () => {
    expect(validaForm({ ...form, email: 'nuova@b.it' }, ESISTENTE, PRIVATI)).toMatchObject({
      valido: true,
      privati: { codiceFiscale: CF, dataNascita: '1980-01-01', email: 'nuova@b.it' },
    });
    expect(validaForm({ ...form, email: '' }, ESISTENTE, PRIVATI)).toMatchObject({
      valido: true,
      privati: { email: null },
    });
  });

  it('dati riservati non letti: non si validano né si mandano', () => {
    const senzaDati = formDa(dipendente, null);
    expect(
      validaForm(senzaDati, { nuovo: false, privatiCaricati: false, oggi: OGGI }, null),
    ).toMatchObject({ valido: true, privati: null });
  });

  it('un dato riservato non valido blocca il salvataggio', () => {
    expect(validaForm({ ...form, codiceFiscale: 'X' }, ESISTENTE, PRIVATI)).toMatchObject({
      valido: false,
      errori: { codiceFiscale: testi.dipendenti.errori.cfLunghezza },
    });
  });
});

describe('input della callable', () => {
  it('riporta reparto, dipendente, anagrafica e dati riservati', () => {
    const esito = validaForm(completo(), NUOVO, null);
    if (!esito.valido) throw new Error('atteso valido');
    expect(inputSalvataggio('r1', null, esito)).toEqual({
      repartoId: 'r1',
      dipendenteId: null,
      anagrafica: esito.anagrafica,
      privati: esito.privati,
    });
  });
});

describe('cessazione da confermare (audit 4.4, I1)', () => {
  function valido(cambi: Partial<FormDipendente>) {
    const esito = validaForm(completo({ attivo: false, ...cambi }), NUOVO, null);
    if (!esito.valido) throw new Error('atteso valido');
    return esito;
  }

  it('una cessazione di oltre un anno fa va confermata', () => {
    expect(
      cessazioneDaConfermareNelForm(valido({ dataCessazione: '2016-03-31' }), null, OGGI),
    ).toBe(true);
  });

  it('oggi, il futuro o meno di un anno fa no', () => {
    for (const data of ['2026-11-18', '2027-06-30', '2025-11-18']) {
      expect(cessazioneDaConfermareNelForm(valido({ dataCessazione: data }), null, OGGI)).toBe(
        false,
      );
    }
  });

  it('se la data è quella già salvata non si chiede di nuovo', () => {
    expect(
      cessazioneDaConfermareNelForm(valido({ dataCessazione: '2016-03-31' }), '2016-03-31', OGGI),
    ).toBe(false);
  });

  it('senza data di cessazione non c’è nulla da confermare', () => {
    expect(cessazioneDaConfermareNelForm(valido({ attivo: true }), null, OGGI)).toBe(false);
  });

  it('l’input della callable porta la conferma solo se data', () => {
    const esito = valido({ dataCessazione: '2016-03-31' });
    expect(inputSalvataggio('r1', 'd1', esito)).not.toHaveProperty('cessazioneConfermata');
    expect(inputSalvataggio('r1', 'd1', esito, true)).toMatchObject({ cessazioneConfermata: true });
  });
});

describe('impronta e codice fiscale', () => {
  it('spazi e maiuscole non cambiano l’impronta', () => {
    expect(improntaForm(completo({ nome: ' Laura ', codiceFiscale: ' bnclra80a41h501d' }))).toBe(
      improntaForm(completo({ nome: 'Laura', codiceFiscale: CF, email: 'l@b.it' })),
    );
  });

  it('un turno escluso in più cambia l’impronta; l’ordine no', () => {
    expect(improntaForm(completo({ turniEsclusi: ['R1', 'N1'] }))).toBe(
      improntaForm(completo({ turniEsclusi: ['N1', 'R1'] })),
    );
    expect(improntaForm(completo({ turniEsclusi: ['N1'] }))).not.toBe(improntaForm(completo()));
  });

  it('il codice fiscale si segnala quando è completo o dopo averlo lasciato', () => {
    expect(codiceFiscaleDaSegnalare('BNCLRA', false)).toBe(false);
    expect(codiceFiscaleDaSegnalare('BNCLRA', true)).toBe(true);
    expect(codiceFiscaleDaSegnalare('BNCLRA80A41H501X', false)).toBe(true);
    expect(erroreCodiceFiscale(CF)).toBeNull();
  });
});
