// Confronto di due valori di Firestore indipendente dall'ordine delle chiavi.
function normalizza(valore: unknown): unknown {
  if (Array.isArray(valore)) {
    return valore.map(normalizza);
  }
  if (typeof valore === 'object' && valore !== null) {
    return Object.fromEntries(
      Object.entries(valore)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chiave, v]) => [chiave, normalizza(v)]),
    );
  }
  return valore;
}

export function stessiDati(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizza(a)) === JSON.stringify(normalizza(b));
}
