import { describe, expect, it } from 'vitest';
import { adesso, oggi } from './orologio';

describe('orologio', () => {
  it('restituisce l’istante nel fuso Europe/Rome', () => {
    expect(adesso().zoneName).toBe('Europe/Rome');
  });

  it('restituisce il giorno corrente nel formato AAAA-MM-GG', () => {
    expect(oggi()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
