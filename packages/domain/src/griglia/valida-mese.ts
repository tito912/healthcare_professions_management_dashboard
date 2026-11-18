// validaMese (ARCHITETTURA §5.9): i controlli tra le righe dello stesso mese, con tutte le righe già lette.
// Ogni sostituzione ha il suo corrispettivo nella riga del collega, nello stesso giorno:
//   turno con `sostituisce: B`        ⇔ nella riga di B, `copertoDa: A`;
//   reperibilità con `sostituisce: B` ⇔ nella riga di B, una reperibilità con `copertaDa: A`.
// Un turno scoperto ha un solo `copertoDa`: un secondo sostituto non trova il corrispettivo ed è un errore.
// Le righe si suppongono già valide per `validaRiga()`. Restituisce blocchi, mai testi.
import { eChiaveGiorno } from '../calendario/mesi';
import type { CellaDoc, RigaDoc } from '../documenti';
import type { CodiceProblemaRiga, ProblemaRiga } from '../regole/livelli';

type RigaDelMese = Pick<RigaDoc, 'dipendenteId' | 'giorni'>;

function cellaDi(
  righe: ReadonlyMap<string, RigaDelMese>,
  id: string,
  giorno: string,
): CellaDoc | undefined {
  return eChiaveGiorno(giorno) ? righe.get(id)?.giorni[giorno] : undefined;
}

export function validaMese(righe: readonly RigaDelMese[]): ProblemaRiga[] {
  const perId = new Map(righe.map((riga) => [riga.dipendenteId, riga]));
  const problemi: ProblemaRiga[] = [];
  for (const riga of righe) {
    const io = riga.dipendenteId;
    for (const [giorno, cella] of Object.entries(riga.giorni).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (cella === undefined) {
        continue;
      }
      const codici = new Set<CodiceProblemaRiga>();
      /** Verifica un riferimento al collega `id`: la sua riga esiste e la sua cella risponde con `reciproca`. */
      const verifica = (id: string | null, reciproca: (altra: CellaDoc) => boolean): void => {
        if (id === null) {
          return;
        }
        if (!perId.has(id)) {
          codici.add('sostituzioneSenzaRiga');
          return;
        }
        const altra = cellaDi(perId, id, giorno);
        if (altra === undefined || !reciproca(altra)) {
          codici.add('sostituzioneNonReciproca');
        }
      };
      verifica(cella.sostituisce, (altra) => altra.copertoDa === io);
      verifica(cella.copertoDa, (altra) => altra.sostituisce === io);
      for (const reperibilita of cella.reperibilita) {
        verifica(reperibilita.sostituisce, (altra) =>
          altra.reperibilita.some((r) => r.copertaDa === io),
        );
        verifica(reperibilita.copertaDa, (altra) =>
          altra.reperibilita.some((r) => r.sostituisce === io),
        );
      }
      for (const codice of codici) {
        problemi.push({ livello: 'blocco', codice, dipendenteId: io, chiaveGiorno: giorno });
      }
    }
  }
  return problemi;
}
