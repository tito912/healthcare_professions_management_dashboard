import { describe, expect, it } from 'vitest';
import {
  FINESTRA_MESI_PRODUZIONE,
  FUSO,
  MESI_STORICO_SOSTITUTI,
  REGIONE_FUNZIONI,
  VERSIONE_CALCOLO,
} from './impostazioni';

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

  it('la classifica dei sostituti guarda i 12 mesi precedenti (ARCHITETTURA §12)', () => {
    expect(MESI_STORICO_SOSTITUTI).toBe(12);
  });

  it('i riepiloghi con ore lavorate, saldo e variazioni hanno la versione di calcolo 2 (step 3.1a)', () => {
    expect(VERSIONE_CALCOLO).toBe(2);
  });
});
