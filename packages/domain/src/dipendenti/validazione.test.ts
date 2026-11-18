import { describe, expect, it } from 'vitest';
import { dataISO } from '../codici';
import {
  dataNascitaPlausibile,
  eInServizioOCessaDopo,
  eOreSettimanaliValide,
  leggiOreSettimanali,
  ORE_SETTIMANALI_PREDEFINITE,
  periodoServizioValido,
  statoDipendente,
  validaEmail,
} from './validazione';

describe('ore settimanali (L39)', () => {
  it('il valore predefinito è valido', () => {
    expect(ORE_SETTIMANALI_PREDEFINITE).toBe(36);
    expect(eOreSettimanaliValide(ORE_SETTIMANALI_PREDEFINITE)).toBe(true);
  });

  it.each([1, 1.5, 18, 30, 36, 37.5, 47.5, 48])('%s è valido', (ore) => {
    expect(eOreSettimanaliValide(ore)).toBe(true);
  });

  it.each([0, 0.5, 48.5, 49, -36, 36.25, 36.1, Number.NaN, Number.POSITIVE_INFINITY])(
    '%s non è valido',
    (ore) => {
      expect(eOreSettimanaliValide(ore)).toBe(false);
    },
  );

  it('le ore dovute giornaliere restano in minuti interi per ogni valore ammesso', () => {
    for (let mezzeOre = 2; mezzeOre <= 96; mezzeOre += 1) {
      const minutiSettimana = (mezzeOre / 2) * 60;
      expect(Number.isInteger(minutiSettimana / 5)).toBe(true);
    }
  });

  it.each([
    ['36', 36],
    [' 37,5 ', 37.5],
    ['37.5', 37.5],
    ['30,0', 30],
    ['1', 1],
    ['48', 48],
  ])('legge «%s»', (testo, atteso) => {
    expect(leggiOreSettimanali(testo)).toBe(atteso);
  });

  it.each(['', 'abc', '36,25', '0', '49', '-36', '36 ore', '1e1', '036,5,1', '3 6'])(
    'rifiuta «%s»',
    (testo) => {
      expect(leggiOreSettimanali(testo)).toBeNull();
    },
  );
});

describe('email', () => {
  it('normalizza spazi e maiuscole', () => {
    expect(validaEmail('  L.Bianchi@Ospedale.IT ')).toEqual({
      valido: true,
      email: 'l.bianchi@ospedale.it',
    });
  });

  it('vuota', () => {
    expect(validaEmail('   ')).toEqual({ valido: false, motivo: 'vuota' });
  });

  it.each(['non-una-email', 'a@', '@b.it', 'a b@c.it', 'a@b', `${'x'.repeat(250)}@b.it`])(
    '«%s» ha un formato non valido',
    (valore) => {
      expect(validaEmail(valore)).toEqual({ valido: false, motivo: 'formato' });
    },
  );

  it('non riporta il valore nell’esito', () => {
    expect(JSON.stringify(validaEmail('segreta@'))).not.toContain('segreta');
  });
});

describe('data di nascita', () => {
  const oggi = '2026-11-18';
  it.each(['1900-01-01', '1980-01-01', '2026-11-18', '2008-02-29'])('%s è plausibile', (data) => {
    expect(dataNascitaPlausibile(data, oggi)).toBe(true);
  });

  it.each(['1899-12-31', '2026-11-19', '2030-01-01'])('%s non è plausibile', (data) => {
    expect(dataNascitaPlausibile(data, oggi)).toBe(false);
  });
});

describe('periodo di servizio e stato (L35)', () => {
  const d = dataISO;
  const oggi = '2026-11-18';

  it('assunzione dopo la cessazione non è coerente', () => {
    expect(periodoServizioValido(d('2026-05-01'), d('2026-04-30'))).toBe(false);
    expect(periodoServizioValido(d('2026-05-01'), d('2026-05-01'))).toBe(true);
    expect(periodoServizioValido(null, d('2026-04-30'))).toBe(true);
    expect(periodoServizioValido(d('2026-05-01'), null)).toBe(true);
    expect(periodoServizioValido(null, null)).toBe(true);
  });

  it.each([
    ['senza date', { attivo: true, dataAssunzione: null, dataCessazione: null }, 'inServizio'],
    [
      'assunto in passato',
      { attivo: true, dataAssunzione: d('2020-01-01'), dataCessazione: null },
      'inServizio',
    ],
    [
      'assunzione futura',
      { attivo: true, dataAssunzione: d('2026-12-01'), dataCessazione: null },
      'daAssumere',
    ],
    [
      'cessazione futura',
      { attivo: true, dataAssunzione: null, dataCessazione: d('2026-12-31') },
      'cessaIl',
    ],
    [
      'ultimo giorno di servizio è oggi',
      { attivo: true, dataAssunzione: null, dataCessazione: d('2026-11-18') },
      'cessaIl',
    ],
    [
      'cessazione ieri',
      { attivo: true, dataAssunzione: null, dataCessazione: d('2026-11-17') },
      'cessato',
    ],
    [
      'disattivato',
      { attivo: false, dataAssunzione: null, dataCessazione: d('2026-11-18') },
      'cessato',
    ],
    [
      'disattivato con cessazione futura',
      { attivo: false, dataAssunzione: null, dataCessazione: d('2027-01-31') },
      'cessato',
    ],
  ] as const)('%s → %s', (_caso, dati, atteso) => {
    expect(statoDipendente(dati, oggi)).toBe(atteso);
  });

  it('il filtro «in servizio» comprende cessa il e da assumere, non i cessati', () => {
    expect(
      eInServizioOCessaDopo(
        { attivo: true, dataAssunzione: null, dataCessazione: d('2026-12-31') },
        oggi,
      ),
    ).toBe(true);
    expect(
      eInServizioOCessaDopo(
        { attivo: false, dataAssunzione: null, dataCessazione: d('2026-11-01') },
        oggi,
      ),
    ).toBe(false);
  });
});
