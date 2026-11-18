// Copia e incolla (UX §9.4). Il blocco copiato è un testo per cella con i codici separati da spazio
// («M1», «M1 MA», «R1 R2», «» = cella vuota): lo stesso formato di `testoCella()` e di `incollaIntervallo()`.
// Negli appunti di sistema va un testo a colonne separate da tabulazioni e righe da a-capo, utile per Excel.
import { testoCella, type CellaDoc } from '@turni/domain';

export type BloccoTesti = readonly (readonly string[])[];

/** Dal rettangolo di celle (righe × colonne) ai testi del blocco. */
export function bloccoDaCelle(celle: readonly (readonly (CellaDoc | null)[])[]): string[][] {
  return celle.map((riga) => riga.map((cella) => (cella === null ? '' : testoCella(cella))));
}

/** Il testo per gli appunti di sistema: colonne separate da tabulazione, righe da a-capo. */
export function testoPerAppunti(blocco: BloccoTesti): string {
  return blocco.map((riga) => riga.join('\t')).join('\n');
}

/** Il blocco da un testo incollato (Excel, altra applicazione): un solo a-capo finale non conta come riga. */
export function bloccoDaTesto(testo: string): string[][] {
  const normalizzato = testo.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  return normalizzato.split('\n').map((riga) => riga.split('\t').map((cella) => cella.trim()));
}

export function stessoTesto(a: string, b: string): boolean {
  return a.replace(/\r\n?/g, '\n').trimEnd() === b.replace(/\r\n?/g, '\n').trimEnd();
}
