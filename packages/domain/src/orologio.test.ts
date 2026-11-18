import { describe, expect, it } from 'vitest';
import { adesso, adessoMs, meseCorrente, oggi } from './orologio';

describe('orologio', () => {
  it('restituisce l’istante nel fuso Europe/Rome', () => {
    expect(adesso().zoneName).toBe('Europe/Rome');
  });

  it('restituisce il giorno corrente nel formato AAAA-MM-GG', () => {
    expect(oggi()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('meseCorrente è la chiave AAAA-MM del giorno corrente', () => {
    expect(meseCorrente()).toBe(oggi().slice(0, 7));
  });

  it('adessoMs coincide con l’istante di adesso()', () => {
    expect(Math.abs(adessoMs() - adesso().toMillis())).toBeLessThan(1000);
  });
});
