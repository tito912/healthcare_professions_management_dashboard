import { codiceErroreFunzione, eErroreDiRete, testoErroreFunzione } from './errori';

describe('errori delle callable', () => {
  it('legge details.codice di un HttpsError', () => {
    expect(
      codiceErroreFunzione({
        code: 'functions/already-exists',
        details: { codice: 'EMAIL_GIA_USATA' },
      }),
    ).toBe('EMAIL_GIA_USATA');
  });

  it.each([
    null,
    undefined,
    'x',
    {},
    { details: null },
    { details: { codice: 'INVENTATO' } },
    { details: { codice: 5 } },
  ])('ignora %j', (errore) => {
    expect(codiceErroreFunzione(errore)).toBeNull();
  });

  it('traduce i codici noti, la rete e il resto', () => {
    expect(testoErroreFunzione({ details: { codice: 'EMAIL_GIA_USATA' } })).toBe(
      'Esiste già un utente con questa email.',
    );
    expect(testoErroreFunzione({ code: 'functions/unavailable' })).toBe(
      'Connessione assente: riprova tra poco.',
    );
    expect(testoErroreFunzione(new Error('x'))).toBe('Operazione non riuscita: riprova tra poco.');
    expect(eErroreDiRete({ code: 'auth/network-request-failed' })).toBe(true);
    expect(eErroreDiRete({ code: 'auth/user-disabled' })).toBe(false);
  });
});
