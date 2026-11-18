// Test della revisione 1.2 (docs/review/1.2.md, rilievo 4): dimostra un difetto, non va «aggiustato» qui.
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

const finti = vi.hoisted(() => ({
  utente: {
    uid: 'c1',
    getIdTokenResult: () => Promise.resolve({ claims: { ruolo: 'COORDINATORE' } }),
  },
}));

// Solo moduli di pacchetto: il runner di Angular non permette vi.mock sui moduli relativi.
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: () => undefined,
}));
vi.mock('firebase/auth', () => ({
  initializeAuth: () => ({}),
  browserSessionPersistence: {},
  connectAuthEmulator: () => undefined,
  onAuthStateChanged: () => () => undefined,
  signInWithEmailAndPassword: () => Promise.resolve({ user: finti.utente }),
  signOut: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
}));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  memoryLocalCache: () => ({}),
  connectFirestoreEmulator: () => undefined,
  doc: () => ({}),
  onSnapshot: () => () => undefined,
  // Firestore non raggiungibile dopo che Auth ha accettato la password giusta.
  getDoc: () =>
    Promise.reject(
      Object.assign(new Error('Failed to get document because the client is offline.'), {
        code: 'unavailable',
      }),
    ),
}));

import { Sessione } from './sessione.service';

describe('Sessione.accedi (revisione 1.2)', () => {
  it('password giusta ma profilo non leggibile per la rete: non dice «credenziali errate»', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const sessione = TestBed.inject(Sessione);
    const esito = await sessione.accedi('m.rossi@esempio.it', 'giusta');
    expect(esito).toEqual({ ok: false, motivo: 'rete' });
  });
});
