// Azioni comuni dei test di componente della griglia (clic, menu, campi dei pannelli). Solo per i test.
import { testoDi, type montaGriglia } from './monta-griglia';

export type Montata = Awaited<ReturnType<typeof montaGriglia>>;

/** Un clic con il mouse su una cella: la rende attiva. */
export async function clic(t: Montata, id: string, giorno: string): Promise<void> {
  t.cella(id, giorno).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

/** Seleziona i giorni da `da` a `a` (compresi) della riga, con Maiusc+freccia destra. */
export async function selezionaGiorni(
  t: Montata,
  id: string,
  da: number,
  a: number,
): Promise<void> {
  await clic(t, id, String(da).padStart(2, '0'));
  for (let giorno = da; giorno < a; giorno++) {
    await t.tasto(t.cella(id, String(giorno).padStart(2, '0')), 'ArrowRight', { shiftKey: true });
  }
}

/** Le voci del menu aperto (testo). */
export function vociMenu(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).map((v) =>
    testoDi(v),
  );
}

/** Apre il menu della cella attiva con Invio. */
export async function apriMenu(t: Montata, id: string, giorno: string): Promise<void> {
  await t.tasto(t.cella(id, giorno), 'Enter');
}

/** Sceglie dal menu aperto la voce il cui testo comincia con `testo`. */
export async function scegliVoce(t: Montata, testo: string): Promise<void> {
  const voce = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((v) =>
    testoDi(v).startsWith(testo),
  );
  if (voce === undefined) {
    throw new Error(`Voce «${testo}» non trovata nel menu`);
  }
  voce.click();
  await t.assesta();
}

/** Scrive in un campo e avvisa Angular. */
export async function scrivi(t: Montata, campo: HTMLInputElement, valore: string): Promise<void> {
  campo.value = valore;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  await t.assesta();
}

export const fascia = (t: Montata): string =>
  testoDi(t.radice().querySelector('app-fascia-stato') as Element);
