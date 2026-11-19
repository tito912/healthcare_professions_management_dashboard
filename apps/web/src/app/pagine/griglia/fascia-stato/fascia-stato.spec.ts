import { testoStato, type DatiStato } from './fascia-stato';

const base: DatiStato = {
  eAdmin: false,
  stato: 'bozza',
  convalidatoIlMs: null,
  convalidatoDaNome: null,
  modifiche: 0,
  salvataggio: 'riposo',
  ultimoSalvataggio: null,
};

describe('Fascia di stato (U4, UX §9.7)', () => {
  it('bozza con modifiche non salvate: il conteggio e l’ultimo salvataggio', () => {
    expect(testoStato({ ...base, modifiche: 5, ultimoSalvataggio: '14:32' })).toEqual({
      tipo: 'bozzaModificata',
      testo: 'Bozza: 5 modifiche non salvate',
      destra: 'Ultimo salvataggio 14:32',
    });
    expect(testoStato({ ...base, modifiche: 1 }).testo).toBe('Bozza: 1 modifica non salvata');
  });

  it('bozza senza modifiche: «tutto salvato», con l’ora se si è salvato', () => {
    expect(testoStato(base)).toEqual({
      tipo: 'bozzaSalvata',
      testo: 'Bozza: tutto salvato',
      destra: null,
    });
    expect(testoStato({ ...base, ultimoSalvataggio: '14:32' }).destra).toBe('Salvato alle 14:32');
  });

  it('mese convalidato: data e ora a Europe/Rome e chi ha convalidato', () => {
    // 2026-12-03 08:14 UTC = 09:14 a Roma.
    expect(
      testoStato({
        ...base,
        stato: 'convalidato',
        convalidatoIlMs: 1796285640000,
        convalidatoDaNome: 'Maria Rossi',
      }),
    ).toEqual({
      tipo: 'convalidato',
      testo: 'Convalidato il 03/12/2026 alle 09:14 da Maria Rossi: sola lettura',
      destra: null,
    });
    expect(testoStato({ ...base, stato: 'convalidato' }).testo).toBe('Convalidato: sola lettura');
  });

  it('ADMIN: sola consultazione con lo stato del mese', () => {
    expect(testoStato({ ...base, eAdmin: true }).testo).toBe('Sola consultazione (ADMIN) · bozza');
    expect(
      testoStato({
        ...base,
        eAdmin: true,
        stato: 'convalidato',
        convalidatoIlMs: 1796285640000,
      }).testo,
    ).toBe('Sola consultazione (ADMIN) · convalidato il 03/12/2026 alle 09:14');
  });

  it('durante il salvataggio e dopo un errore (le modifiche restano)', () => {
    expect(testoStato({ ...base, modifiche: 3, salvataggio: 'inCorso' }).testo).toBe(
      'Salvataggio in corso…',
    );
    expect(testoStato({ ...base, modifiche: 3, salvataggio: 'errore' })).toEqual({
      tipo: 'errore',
      testo: 'Salvataggio non riuscito: riprova',
      destra: null,
    });
  });
});
