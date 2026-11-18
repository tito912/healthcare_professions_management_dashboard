// Validazione di una tipologia di assenza prima del salvataggio (stessi limiti di firestore.rules).
export const LUNGHEZZA_MASSIMA_DESCRIZIONE_ASSENZA = 40;

export type MotivoErroreAssenza = 'descrizioneVuota' | 'descrizioneTroppoLunga';

export function validaDescrizioneAssenza(descrizione: string): MotivoErroreAssenza | null {
  const testo = descrizione.trim();
  if (testo === '') {
    return 'descrizioneVuota';
  }
  return testo.length > LUNGHEZZA_MASSIMA_DESCRIZIONE_ASSENZA ? 'descrizioneTroppoLunga' : null;
}
