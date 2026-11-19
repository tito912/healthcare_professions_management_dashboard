import { PaginatoreUnito, type SorgentePagina } from './registro.paginatore';

/** Sorgente finta: elenco già ordinato (numeri decrescenti = più recenti prima), letto a blocchi. */
function sorgente(valori: readonly number[]) {
  let letti = 0;
  const carica = vi.fn((quante: number) => {
    const elementi = valori.slice(letti, letti + quante);
    letti += elementi.length;
    return Promise.resolve({ elementi, esaurita: elementi.length < quante });
  });
  const s: SorgentePagina<number> = { carica };
  return { s, carica };
}

const recente = (a: number, b: number): number => b - a;

describe('PaginatoreUnito', () => {
  it('con una sola sorgente restituisce le pagine in ordine e segnala la fine', async () => {
    const { s } = sorgente([9, 8, 7, 6, 5]);
    const p = new PaginatoreUnito([s], recente, 2);
    expect(await p.successiva()).toEqual({ elementi: [9, 8], ancora: true });
    expect(await p.successiva()).toEqual({ elementi: [7, 6], ancora: true });
    expect(await p.successiva()).toEqual({ elementi: [5], ancora: false });
  });

  it('fonde più sorgenti dalla voce più recente, senza perdere né ripetere voci tra le pagine', async () => {
    const a = sorgente([10, 7, 4, 1]);
    const b = sorgente([9, 8, 3]);
    const c = sorgente([]);
    const p = new PaginatoreUnito([a.s, b.s, c.s], recente, 3);
    const tutte: number[] = [];
    let ancora = true;
    while (ancora) {
      const pagina = await p.successiva();
      tutte.push(...pagina.elementi);
      ancora = pagina.ancora;
    }
    expect(tutte).toEqual([10, 9, 8, 7, 4, 3, 1]);
  });

  it('non rilegge una sorgente esaurita', async () => {
    const a = sorgente([3, 2]);
    const p = new PaginatoreUnito([a.s], recente, 5);
    await p.successiva();
    await p.successiva();
    expect(a.carica).toHaveBeenCalledTimes(1);
  });

  it('una sorgente che finisce a metà pagina non ferma le altre', async () => {
    const a = sorgente([5]);
    const b = sorgente([4, 3, 2, 1]);
    const p = new PaginatoreUnito([a.s, b.s], recente, 3);
    expect((await p.successiva()).elementi).toEqual([5, 4, 3]);
    expect((await p.successiva()).elementi).toEqual([2, 1]);
  });

  it("propaga l'errore di una sorgente", async () => {
    const guasta: SorgentePagina<number> = { carica: () => Promise.reject(new Error('rete')) };
    await expect(new PaginatoreUnito([guasta], recente, 2).successiva()).rejects.toThrow('rete');
  });
});
