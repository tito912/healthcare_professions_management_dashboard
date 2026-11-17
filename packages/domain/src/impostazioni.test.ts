import { describe, expect, it } from 'vitest';
import { FINESTRA_MESI_PRODUZIONE, FUSO, REGIONE_FUNZIONI } from './impostazioni';

describe('impostazioni del dominio', () => {
  it('lavora nel fuso di Torino', () => {
    expect(FUSO).toBe('Europe/Rome');
  });

  it('usa la regione europe-west12 per le Functions', () => {
    expect(REGIONE_FUNZIONI).toBe('europe-west12');
  });

  it('apre due mesi modificabili in produzione', () => {
    expect(FINESTRA_MESI_PRODUZIONE).toBe(2);
  });
});
