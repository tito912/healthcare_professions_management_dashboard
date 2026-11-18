import { Cronologia, MAX_PASSI_CRONOLOGIA, type Passo } from './cronologia';

const passo = (n: number): Passo => [
  { dipendenteId: `d${n}`, giorno: '05', prima: null, dopo: null },
];

describe('Cronologia', () => {
  it('annulla e ripristina un passo per volta, in ordine', () => {
    const c = new Cronologia();
    const [a, b] = [passo(1), passo(2)];
    c.registra(a);
    c.registra(b);
    expect(c.puoAnnullare()).toBe(true);
    expect(c.annulla()).toBe(b);
    expect(c.annulla()).toBe(a);
    expect(c.annulla()).toBeNull();
    expect(c.ripristina()).toBe(a);
    expect(c.ripristina()).toBe(b);
    expect(c.ripristina()).toBeNull();
  });

  it('una nuova modifica dopo un annulla scarta i passi ripristinabili', () => {
    const c = new Cronologia();
    c.registra(passo(1));
    c.registra(passo(2));
    c.annulla();
    c.registra(passo(3));
    expect(c.puoRipristinare()).toBe(false);
    expect(c.lunghezza).toBe(2);
  });

  it('tiene al massimo 200 passi e butta i più vecchi', () => {
    const c = new Cronologia();
    for (let i = 0; i < MAX_PASSI_CRONOLOGIA + 25; i++) {
      c.registra(passo(i));
    }
    expect(c.lunghezza).toBe(MAX_PASSI_CRONOLOGIA);
    let annullati = 0;
    while (c.annulla() !== null) {
      annullati += 1;
    }
    expect(annullati).toBe(MAX_PASSI_CRONOLOGIA);
  });

  it('un passo vuoto non si registra; azzera svuota tutto', () => {
    const c = new Cronologia();
    c.registra([]);
    expect(c.lunghezza).toBe(0);
    c.registra(passo(1));
    c.azzera();
    expect(c.puoAnnullare()).toBe(false);
    expect(c.puoRipristinare()).toBe(false);
  });
});
