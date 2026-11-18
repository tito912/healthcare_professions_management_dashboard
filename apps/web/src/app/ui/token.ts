// Token dell'interfaccia (UX §4 e §5.2): l'unica fonte di colori, spaziature, altezze e tipografia.
// All'avvio `applicaToken()` li scrive come variabili CSS `--t-*` su :root; `styles/styles.css` li espone a
// Tailwind (`@theme inline`) con i soli nomi. La palette dei turni sta nel dominio (`PALETTE_TURNI`).

export const COLORI = {
  testo: '#111827',
  testoSecondario: '#4B5563',
  sfondo: '#FFFFFF',
  sfondoPagina: '#F9FAFB',
  sfondoWeekend: '#F1F5F9',
  sfondoFestivo: '#EEF2FF',
  sfondoNeutro: '#F3F4F6',
  testoNeutro: '#374151',
  rigaColonnaAttiva: '#EFF6FF',
  nomeColonnaAttiva: '#DBEAFE',
  selezione: 'rgba(37, 99, 235, 0.12)',
  selezioneBordo: '#2563EB',
  bordo: '#D1D5DB',
  focus: '#1D4ED8',
  primario: '#1D4ED8',
  primarioHover: '#1E40AF',
  avviso: '#C2410C',
  avvisoTesto: '#9A3412',
  avvisoSfondo: '#FFF7ED',
  blocco: '#B91C1C',
  bloccoTesto: '#991B1B',
  bloccoSfondo: '#FEF2F2',
  nota: '#1E40AF',
  notaSfondo: '#EFF6FF',
  successo: '#166534',
  successoSfondo: '#F0FDF4',
  bozza: '#78350F',
  bozzaSfondo: '#FFFBEB',
  credito: '#15803D',
  debito: '#B91C1C',
} as const;

/** Scala delle spaziature in px (multipli di 4). */
export const SPAZIATURE = [4, 8, 12, 16, 24, 32] as const;

export const ALTEZZE = {
  controllo: 32,
  controlloCompatto: 28,
  rigaTabella: 36,
  intestazioneTabella: 36,
  barraSuperiore: 48,
  menuRidotto: 48,
  menuEsteso: 208,
  pannelloLaterale: 360,
} as const;

export const LARGHEZZE = {
  minima: 1280,
  contenutoMassima: 1440,
  margineContenuto: 24,
  schedaAccesso: 400,
} as const;

export const RAGGI = { campo: 4, pannello: 6 } as const;

export interface StileTesto {
  readonly dimensione: number;
  readonly interlinea: number;
  readonly peso: number;
}

export const TIPOGRAFIA = {
  titoloPagina: { dimensione: 20, interlinea: 28, peso: 600 },
  titoloSezione: { dimensione: 16, interlinea: 24, peso: 600 },
  testo: { dimensione: 14, interlinea: 20, peso: 400 },
  pulsante: { dimensione: 14, interlinea: 20, peso: 500 },
  tabella: { dimensione: 13, interlinea: 18, peso: 400 },
  nota: { dimensione: 12, interlinea: 16, peso: 400 },
} as const satisfies Record<string, StileTesto>;

/** Durate in millisecondi. */
export const DURATE = {
  ritardoSpinner: 300,
  ritardoTooltip: 400,
  toast: 5000,
} as const;

function kebab(nome: string): string {
  return nome.replace(/[A-Z]/g, (lettera) => `-${lettera.toLowerCase()}`);
}

/** Tutte le variabili CSS dei token: nome → valore. */
export function variabiliCss(): Record<string, string> {
  const variabili: Record<string, string> = {};
  for (const [nome, valore] of Object.entries(COLORI)) {
    variabili[`--t-c-${kebab(nome)}`] = valore;
  }
  for (const [nome, valore] of Object.entries(ALTEZZE)) {
    variabili[`--t-h-${kebab(nome)}`] = `${valore}px`;
  }
  for (const [nome, valore] of Object.entries(LARGHEZZE)) {
    variabili[`--t-w-${kebab(nome)}`] = `${valore}px`;
  }
  for (const [nome, valore] of Object.entries(RAGGI)) {
    variabili[`--t-r-${kebab(nome)}`] = `${valore}px`;
  }
  for (const [nome, stile] of Object.entries<StileTesto>(TIPOGRAFIA)) {
    variabili[`--t-t-${kebab(nome)}-d`] = `${stile.dimensione}px`;
    variabili[`--t-t-${kebab(nome)}-i`] = `${stile.interlinea}px`;
    variabili[`--t-t-${kebab(nome)}-p`] = String(stile.peso);
  }
  SPAZIATURE.forEach((valore, indice) => {
    variabili[`--t-s-${indice + 1}`] = `${valore}px`;
  });
  return variabili;
}

/** Scrive le variabili dei token sull'elemento radice (di norma `document.documentElement`). */
export function applicaToken(radice: HTMLElement): void {
  for (const [nome, valore] of Object.entries(variabiliCss())) {
    radice.style.setProperty(nome, valore);
  }
}
