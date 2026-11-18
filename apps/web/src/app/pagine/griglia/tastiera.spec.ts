import { azioneDaTasto, type Azione, type EventoTasto } from './tastiera';

const tasto = (key: string, modificatori: Partial<EventoTasto> = {}): EventoTasto => ({
  key,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...modificatori,
});

describe('Tastiera della griglia (UX §9.2)', () => {
  const libero = { pennelloAttivo: false };

  it.each<[string, EventoTasto, Azione | null]>([
    [
      'freccia a destra',
      tasto('ArrowRight'),
      { tipo: 'muovi', dRiga: 0, dColonna: 1, estendi: false },
    ],
    [
      'Maiusc+freccia in giù estende',
      tasto('ArrowDown', { shiftKey: true }),
      { tipo: 'muovi', dRiga: 1, dColonna: 0, estendi: true },
    ],
    ['Tab', tasto('Tab'), { tipo: 'tab', indietro: false }],
    ['Maiusc+Tab', tasto('Tab', { shiftKey: true }), { tipo: 'tab', indietro: true }],
    ['Home', tasto('Home'), { tipo: 'primoGiorno', estendi: false }],
    ['Fine', tasto('End'), { tipo: 'ultimoGiorno', estendi: false }],
    ['Ctrl+Home', tasto('Home', { ctrlKey: true }), { tipo: 'primaCella', estendi: false }],
    ['Ctrl+Fine', tasto('End', { ctrlKey: true }), { tipo: 'ultimaCella', estendi: false }],
    ['PagGiù', tasto('PageDown'), { tipo: 'pagina', direzione: 1, estendi: false }],
    [
      'Alt+Maiusc+→ cambia settimana',
      tasto('ArrowRight', { altKey: true, shiftKey: true }),
      { tipo: 'settimana', direzione: 1 },
    ],
    [
      'Alt+Maiusc+←',
      tasto('ArrowLeft', { altKey: true, shiftKey: true }),
      { tipo: 'settimana', direzione: -1 },
    ],
    [
      'Alt+← da solo non fa nulla (è «Indietro» del browser)',
      tasto('ArrowLeft', { altKey: true }),
      null,
    ],
    ['Alt+PagGiù: mese dopo', tasto('PageDown', { altKey: true }), { tipo: 'mese', direzione: 1 }],
    ['Alt+PagSu: mese prima', tasto('PageUp', { altKey: true }), { tipo: 'mese', direzione: -1 }],
    ['Invio apre il menu', tasto('Enter'), { tipo: 'menu' }],
    ['F2 apre il menu', tasto('F2'), { tipo: 'menu' }],
    ['Alt+↓ apre il menu', tasto('ArrowDown', { altKey: true }), { tipo: 'menu' }],
    ['tasto menu', tasto('ContextMenu'), { tipo: 'menu' }],
    ['Maiusc+F10', tasto('F10', { shiftKey: true }), { tipo: 'menu' }],
    ['F10 da solo', tasto('F10'), null],
    ['Canc svuota', tasto('Delete'), { tipo: 'svuota' }],
    ['Backspace svuota', tasto('Backspace'), { tipo: 'svuota' }],
    ['Esc', tasto('Escape'), { tipo: 'esc' }],
    ['Ctrl+Z annulla', tasto('z', { ctrlKey: true }), { tipo: 'annulla' }],
    ['Ctrl+Y ripristina', tasto('y', { ctrlKey: true }), { tipo: 'ripristina' }],
    [
      'Ctrl+Maiusc+Z ripristina',
      tasto('Z', { ctrlKey: true, shiftKey: true }),
      { tipo: 'ripristina' },
    ],
    ['Cmd+Z su Mac', tasto('z', { metaKey: true }), { tipo: 'annulla' }],
    ['Ctrl+S salva', tasto('s', { ctrlKey: true }), { tipo: 'salva' }],
    ['? apre la legenda', tasto('?'), { tipo: 'legenda' }],
    ['Maiusc+Spazio: riga', tasto(' ', { shiftKey: true }), { tipo: 'selezionaRiga' }],
    ['Ctrl+Spazio: colonna', tasto(' ', { ctrlKey: true }), { tipo: 'selezionaColonna' }],
    [
      'una lettera avvia l’inserimento in maiuscolo',
      tasto('m'),
      { tipo: 'inserisci', carattere: 'M' },
    ],
    ['una cifra avvia l’inserimento', tasto('1'), { tipo: 'inserisci', carattere: '1' }],
    ['Ctrl+lettera non avvia l’inserimento', tasto('a', { ctrlKey: true }), null],
    ['Ctrl+C e Ctrl+V sono degli eventi copy e paste', tasto('c', { ctrlKey: true }), null],
    ['Spazio senza pennello', tasto(' '), null],
    ['un simbolo', tasto('%'), null],
  ])('%s', (_nome, evento, atteso) => {
    expect(azioneDaTasto(evento, libero)).toEqual(atteso);
  });

  it('Spazio con il pennello lo applica alla selezione', () => {
    expect(azioneDaTasto(tasto(' '), { pennelloAttivo: true })).toEqual({
      tipo: 'applicaPennello',
    });
  });
});
