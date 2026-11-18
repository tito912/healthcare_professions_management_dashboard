import { MOSTRA_ACCOUNT_DISATTIVATO, Sessione, motivoDaErroreAccesso } from './sessione.service';

describe('motivoDaErroreAccesso', () => {
  it.each([
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/invalid-email',
    'auth/missing-password',
  ])('%s dà il motivo generico: non rivela se l’email esiste', (codice) => {
    expect(motivoDaErroreAccesso(codice)).toBe('credenziali');
  });

  it('user-disabled è generico finché non è provato che Auth lo dice solo con la password giusta', () => {
    expect(MOSTRA_ACCOUNT_DISATTIVATO).toBe(false);
    expect(motivoDaErroreAccesso('auth/user-disabled')).toBe('credenziali');
    expect(motivoDaErroreAccesso('auth/user-disabled', true)).toBe('disattivato');
  });

  it('distingue troppi tentativi, rete e il resto', () => {
    expect(motivoDaErroreAccesso('auth/too-many-requests')).toBe('troppiTentativi');
    expect(motivoDaErroreAccesso('auth/network-request-failed')).toBe('rete');
    expect(motivoDaErroreAccesso('auth/internal-error')).toBe('altro');
    expect(motivoDaErroreAccesso(null)).toBe('altro');
  });
});

describe('Sessione.testoUscita', () => {
  it('dà il testo per ogni motivo di uscita', () => {
    expect(Sessione.testoUscita('inattivita')).toBe('Sei uscito per inattività.');
    expect(Sessione.testoUscita('terminata')).toContain('accedi di nuovo');
    expect(Sessione.testoUscita('disattivato')).toContain('disattivato');
  });
});
