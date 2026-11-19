// Aiuti per i test dei file Excel: si apre il file generato con exceljs, come lo aprirebbe chi lo scarica.
import { Workbook, type Worksheet } from 'exceljs';

/** Il foglio «Report» di un file generato. */
export async function apriFoglio(contenuto: Buffer): Promise<Worksheet> {
  const cartella = new Workbook();
  await cartella.xlsx.load(new Uint8Array(contenuto).buffer);
  const foglio = cartella.getWorksheet('Report');
  if (foglio === undefined) {
    throw new Error('Foglio «Report» mancante');
  }
  return foglio;
}

/** I valori di una riga (1 = prima riga), dalla colonna A. */
export function valoriRiga(foglio: Worksheet, numero: number): unknown[] {
  const valori = foglio.getRow(numero).values;
  return Array.isArray(valori) ? valori.slice(1) : [];
}
