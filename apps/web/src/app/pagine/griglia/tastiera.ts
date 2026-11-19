// Tastiera della griglia (UX §9.2, modalità navigazione): dal tasto premuto all'azione. Funzione pura: la pagina
// esegue l'azione. `Ctrl+C`/`Ctrl+V` non sono qui: si gestiscono con gli eventi `copy`/`paste`, che non chiedono
// permessi al browser.

export interface EventoTasto {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export type Azione =
  | {
      readonly tipo: 'muovi';
      readonly dRiga: number;
      readonly dColonna: number;
      readonly estendi: boolean;
    }
  | { readonly tipo: 'tab'; readonly indietro: boolean }
  | { readonly tipo: 'primoGiorno' | 'ultimoGiorno'; readonly estendi: boolean }
  | { readonly tipo: 'primaCella' | 'ultimaCella'; readonly estendi: boolean }
  | { readonly tipo: 'pagina'; readonly direzione: 1 | -1; readonly estendi: boolean }
  | { readonly tipo: 'settimana'; readonly direzione: 1 | -1 }
  | { readonly tipo: 'mese'; readonly direzione: 1 | -1 }
  | { readonly tipo: 'inserisci'; readonly carattere: string }
  | { readonly tipo: 'menu' }
  | { readonly tipo: 'applicaPennello' }
  | { readonly tipo: 'svuota' }
  | { readonly tipo: 'esc' }
  | { readonly tipo: 'annulla' }
  | { readonly tipo: 'ripristina' }
  | { readonly tipo: 'salva' }
  | { readonly tipo: 'legenda' }
  | { readonly tipo: 'selezionaRiga' }
  | { readonly tipo: 'selezionaColonna' };

export interface ContestoTasto {
  readonly pennelloAttivo: boolean;
}

const FRECCE: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
};

/** Lettera o cifra senza modificatori: avvia l'inserimento veloce (UX §9.2). */
function eCarattereDiCodice(e: EventoTasto): boolean {
  return /^[a-zA-Z0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey;
}

export function azioneDaTasto(e: EventoTasto, contesto: ContestoTasto): Azione | null {
  const comando = e.ctrlKey || e.metaKey;
  const { key } = e;

  if (comando && !e.altKey) {
    switch (key.toLowerCase()) {
      case 'z':
        return e.shiftKey ? { tipo: 'ripristina' } : { tipo: 'annulla' };
      case 'y':
        return { tipo: 'ripristina' };
      case 's':
        return { tipo: 'salva' };
      case ' ':
        return { tipo: 'selezionaColonna' };
      case 'home':
        return { tipo: 'primaCella', estendi: e.shiftKey };
      case 'end':
        return { tipo: 'ultimaCella', estendi: e.shiftKey };
      default:
        return null;
    }
  }

  if (e.altKey && !comando) {
    if (e.shiftKey && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      return { tipo: 'settimana', direzione: key === 'ArrowRight' ? 1 : -1 };
    }
    if (key === 'PageUp' || key === 'PageDown') {
      return { tipo: 'mese', direzione: key === 'PageDown' ? 1 : -1 };
    }
    return key === 'ArrowDown' ? { tipo: 'menu' } : null;
  }

  const freccia = FRECCE[key];
  if (freccia !== undefined) {
    return { tipo: 'muovi', dRiga: freccia[0], dColonna: freccia[1], estendi: e.shiftKey };
  }
  switch (key) {
    case 'Tab':
      return { tipo: 'tab', indietro: e.shiftKey };
    case 'Home':
      return { tipo: 'primoGiorno', estendi: e.shiftKey };
    case 'End':
      return { tipo: 'ultimoGiorno', estendi: e.shiftKey };
    case 'PageUp':
    case 'PageDown':
      return { tipo: 'pagina', direzione: key === 'PageDown' ? 1 : -1, estendi: e.shiftKey };
    case 'Enter':
    case 'F2':
    case 'ContextMenu':
      return { tipo: 'menu' };
    case 'F10':
      return e.shiftKey ? { tipo: 'menu' } : null;
    case 'Delete':
    case 'Backspace':
      return { tipo: 'svuota' };
    case 'Escape':
      return { tipo: 'esc' };
    case '?':
      return { tipo: 'legenda' };
    case ' ':
      if (e.shiftKey) {
        return { tipo: 'selezionaRiga' };
      }
      return contesto.pennelloAttivo ? { tipo: 'applicaPennello' } : null;
    default:
      return eCarattereDiCodice(e) ? { tipo: 'inserisci', carattere: key.toUpperCase() } : null;
  }
}
