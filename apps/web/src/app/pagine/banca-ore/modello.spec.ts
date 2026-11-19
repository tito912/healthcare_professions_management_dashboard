import { dipendente } from '../../test/monta-griglia';
import { righeBancaOre, saldoVista } from './modello';

describe('Modello della banca ore (UX §7.8)', () => {
  it('saldoVista: segno, colore e «≈» solo per il provvisorio; zero resta neutro', () => {
    expect(saldoVista(210, false)).toEqual({ testo: '+3,5', segno: 'credito', provvisorio: false });
    expect(saldoVista(-432, false)).toEqual({ testo: '−7,2', segno: 'debito', provvisorio: false });
    expect(saldoVista(72, true)).toEqual({ testo: '≈+1,2', segno: 'credito', provvisorio: true });
    expect(saldoVista(0, false)).toEqual({ testo: '+0,0', segno: 'zero', provvisorio: false });
    // Un saldo che arrotonda a zero resta «+0,0» con il vero segno meno solo oltre il decimale.
    expect(saldoVista(-2, false).testo).toBe('+0,0');
  });

  it('un cessato senza banca ore dell’anno non compare; con una banca ore compare', () => {
    const cessato = dipendente('d9', 'Gialli', 'Paolo', { attivo: false });
    const attivo = dipendente('d1', 'Rossi', 'Maria');
    expect(righeBancaOre([cessato, attivo], [], '').map((r) => r.id)).toEqual(['d1']);
    const banca = {
      dipendenteId: 'd9',
      anno: 2026,
      riportoMinuti: 0,
      mesi: {},
      saldoAnnoMinuti: 0,
      saldoDefinitivoMinuti: 0,
      provvisorio: false,
    };
    expect(righeBancaOre([cessato, attivo], [banca], '').map((r) => r.id)).toEqual(['d9', 'd1']);
  });

  it('ordine per cognome e nome, con la ricerca anche sul nome', () => {
    const elenco = [
      dipendente('a', 'Rossi', 'Maria'),
      dipendente('b', 'Bianchi', 'Laura'),
      dipendente('c', 'Rossi', 'Anna'),
    ];
    expect(righeBancaOre(elenco, [], '').map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(righeBancaOre(elenco, [], 'anna').map((r) => r.id)).toEqual(['c']);
  });
});
