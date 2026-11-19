// Selezione della griglia (UX §9.1): una cella attiva e un'ancora; l'intervallo è il rettangolo che le unisce.
// Le posizioni sono indici nell'elenco delle righe e dei giorni visibili.

export interface Posizione {
  readonly riga: number;
  readonly colonna: number;
}

export interface Rettangolo {
  readonly rigaDa: number;
  readonly rigaA: number;
  readonly colonnaDa: number;
  readonly colonnaA: number;
}

export function rettangolo(ancora: Posizione, attiva: Posizione): Rettangolo {
  return {
    rigaDa: Math.min(ancora.riga, attiva.riga),
    rigaA: Math.max(ancora.riga, attiva.riga),
    colonnaDa: Math.min(ancora.colonna, attiva.colonna),
    colonnaA: Math.max(ancora.colonna, attiva.colonna),
  };
}

export function numeroCelle(r: Rettangolo): number {
  return (r.rigaA - r.rigaDa + 1) * (r.colonnaA - r.colonnaDa + 1);
}

export function contiene(r: Rettangolo, p: Posizione): boolean {
  return (
    p.riga >= r.rigaDa && p.riga <= r.rigaA && p.colonna >= r.colonnaDa && p.colonna <= r.colonnaA
  );
}

/** Le posizioni del rettangolo per righe, da sinistra a destra. */
export function posizioniDi(r: Rettangolo): Posizione[] {
  const posizioni: Posizione[] = [];
  for (let riga = r.rigaDa; riga <= r.rigaA; riga++) {
    for (let colonna = r.colonnaDa; colonna <= r.colonnaA; colonna++) {
      posizioni.push({ riga, colonna });
    }
  }
  return posizioni;
}

/** Tiene la posizione dentro la griglia (almeno una riga e una colonna). */
export function limita(p: Posizione, righe: number, colonne: number): Posizione {
  return {
    riga: Math.min(Math.max(0, p.riga), Math.max(0, righe - 1)),
    colonna: Math.min(Math.max(0, p.colonna), Math.max(0, colonne - 1)),
  };
}

/** La riga intera (`Maiusc+Spazio`) e la colonna intera (`Ctrl+Spazio`) per le viste correnti. */
export function rigaIntera(riga: number, colonne: number): Rettangolo {
  return { rigaDa: riga, rigaA: riga, colonnaDa: 0, colonnaA: Math.max(0, colonne - 1) };
}

export function colonnaIntera(colonna: number, righe: number): Rettangolo {
  return { rigaDa: 0, rigaA: Math.max(0, righe - 1), colonnaDa: colonna, colonnaA: colonna };
}

/** Uguaglianza di due rettangoli (per i `computed` delle righe, che così non si ridisegnano senza motivo). */
export function stessoRettangolo(a: Rettangolo | null, b: Rettangolo | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.rigaDa === b.rigaDa &&
    a.rigaA === b.rigaA &&
    a.colonnaDa === b.colonnaDa &&
    a.colonnaA === b.colonnaA
  );
}
