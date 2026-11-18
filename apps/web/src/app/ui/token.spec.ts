import { COLORI, SPAZIATURE, TIPOGRAFIA, applicaToken, variabiliCss } from './token';

describe('token', () => {
  it('ogni colore, altezza, larghezza, raggio e stile di testo ha la sua variabile CSS', () => {
    const variabili = variabiliCss();
    for (const nome of Object.keys(COLORI)) {
      const kebab = nome.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`);
      expect(variabili[`--t-c-${kebab}`]).toBe(COLORI[nome as keyof typeof COLORI]);
    }
    expect(variabili['--t-h-barra-superiore']).toBe('48px');
    expect(variabili['--t-h-menu-esteso']).toBe('208px');
    expect(variabili['--t-w-minima']).toBe('1280px');
    expect(variabili['--t-t-titolo-pagina-d']).toBe(`${TIPOGRAFIA.titoloPagina.dimensione}px`);
  });

  it('la scala delle spaziature è di 4 px', () => {
    expect([...SPAZIATURE]).toEqual([4, 8, 12, 16, 24, 32]);
    expect(SPAZIATURE.every((valore) => valore % 4 === 0)).toBe(true);
  });

  it('applicaToken scrive le variabili sull’elemento', () => {
    const elemento = document.createElement('div');
    applicaToken(elemento);
    expect(elemento.style.getPropertyValue('--t-c-focus')).toBe('#1D4ED8');
    expect(elemento.style.getPropertyValue('--t-s-3')).toBe('12px');
  });
});
