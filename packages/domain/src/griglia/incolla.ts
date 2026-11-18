// Incolla di un intervallo (UX §9.4), anche su altre righe. Il blocco copiato è un testo per cella con i codici
// separati da spazio («M1», «M1 MA», «R1 R2», «» = vuota): è lo stesso formato degli appunti di sistema
// (`testoCella()`), così si incolla allo stesso modo dalla griglia e da Excel.
// Ogni cella incollata prende il contenuto copiato al posto del proprio (prima la gomma, poi turno, assenza e
// reperibilità con `applicaAssegnazione()`): se uno solo dei passi è rifiutato, la cella si salta tutta.
import { dataDelGiorno } from '../calendario/mesi';
import { inServizioIl, type PeriodoServizio } from '../calendario/servizio';
import type { CellaDoc, RigaDoc } from '../documenti';
import type { MotivoRifiuto } from '../regole/livelli';
import type { ConfigurazioneGriglia } from '../regole/opzioni-cella';
import { CHIAVI_GIORNO, type ChiaveGiorno, type ChiaveMese, type CodiceTurno } from '../tipi';
import { applicaAssegnazione, type Assegnazione, type ContestoAssegnazione } from './cella';
import { assegnazioneDaCodice } from './inserimento';

export interface RigaDestinazione {
  readonly dipendenteId: string;
  readonly turniEsclusi: readonly CodiceTurno[];
  readonly contratto: PeriodoServizio;
  /** Le celle attuali della riga, comprese le modifiche non salvate. */
  readonly giorni: RigaDoc['giorni'];
}

export interface RichiestaIncolla {
  readonly chiaveMese: ChiaveMese;
  /** Giorno della cella attiva: angolo in alto a sinistra dell'incolla. */
  readonly giornoIniziale: ChiaveGiorno;
  /** Righe × colonne di testi, uno per cella. */
  readonly blocco: readonly (readonly string[])[];
  /** Le righe di destinazione nell'ordine della griglia, a partire da quella della cella attiva. */
  readonly righe: readonly RigaDestinazione[];
  readonly configurazione: ConfigurazioneGriglia;
}

export interface CellaApplicata {
  readonly dipendenteId: string;
  readonly giorno: ChiaveGiorno;
  readonly cella: CellaDoc;
}

export interface CellaSaltata {
  readonly dipendenteId: string;
  readonly giorno: ChiaveGiorno;
  readonly motivo: MotivoRifiuto;
  /** Il codice che ha causato il salto, se uno solo ne è responsabile. */
  readonly codice: string | null;
}

export interface EsitoIncolla {
  readonly applicate: readonly CellaApplicata[];
  readonly saltate: readonly CellaSaltata[];
  /** Celle del blocco fuori dal mese o oltre l'ultima riga: si scartano senza nota. */
  readonly scartate: number;
}

type EsitoCellaIncollata =
  | { readonly esito: 'applicata'; readonly cella: CellaDoc }
  | { readonly esito: 'saltata'; readonly motivo: MotivoRifiuto; readonly codice: string | null };

/** Ordine di applicazione dei codici di una cella: turno, poi assenza (che può lasciarlo scoperto), poi fasce. */
const ORDINE_TIPI: Readonly<Record<Assegnazione['tipo'], number>> = {
  gomma: 0,
  turno: 1,
  assenza: 2,
  reperibilita: 3,
  eliminaTurnoScoperto: 4,
  rimuoviReperibilita: 5,
};

function incollaCella(
  testo: string,
  cella: CellaDoc | null,
  contesto: ContestoAssegnazione,
  configurazione: ConfigurazioneGriglia,
): EsitoCellaIncollata {
  const passi: { readonly codice: string; readonly assegnazione: Assegnazione }[] = [];
  for (const codice of testo
    .trim()
    .toUpperCase()
    .split(/\s+/u)
    .filter((parte) => parte !== '')) {
    const trovato = assegnazioneDaCodice(codice, configurazione);
    if (trovato.esito === 'nonTrovata') {
      return { esito: 'saltata', motivo: trovato.motivo, codice };
    }
    passi.push({ codice, assegnazione: trovato.assegnazione });
  }
  const quanti = (tipo: Assegnazione['tipo']): number =>
    passi.filter((p) => p.assegnazione.tipo === tipo).length;
  if (quanti('turno') > 1 || quanti('assenza') > 1) {
    return { esito: 'saltata', motivo: 'testoNonValido', codice: null };
  }
  const svuotata = applicaAssegnazione(cella, { tipo: 'gomma' }, contesto);
  if (svuotata.esito === 'rifiutata') {
    return { esito: 'saltata', motivo: svuotata.motivo, codice: null };
  }
  let corrente = svuotata.cella;
  for (const passo of passi.sort(
    (a, b) => ORDINE_TIPI[a.assegnazione.tipo] - ORDINE_TIPI[b.assegnazione.tipo],
  )) {
    const esito = applicaAssegnazione(corrente, passo.assegnazione, contesto);
    if (esito.esito === 'rifiutata') {
      return { esito: 'saltata', motivo: esito.motivo, codice: passo.codice };
    }
    corrente = esito.cella;
  }
  return { esito: 'applicata', cella: corrente };
}

/** Quali celle si applicano e quali si saltano, con il motivo. Non modifica le righe ricevute. */
export function incollaIntervallo(richiesta: RichiestaIncolla): EsitoIncolla {
  const applicate: CellaApplicata[] = [];
  const saltate: CellaSaltata[] = [];
  let scartate = 0;
  const primaColonna = Number(richiesta.giornoIniziale) - 1;
  richiesta.blocco.forEach((testi, indiceRiga) => {
    const riga = richiesta.righe[indiceRiga];
    testi.forEach((testo, indiceColonna) => {
      const giorno = CHIAVI_GIORNO[primaColonna + indiceColonna];
      const data = giorno === undefined ? null : dataDelGiorno(richiesta.chiaveMese, giorno);
      if (riga === undefined || giorno === undefined || data === null) {
        scartate += 1;
        return;
      }
      const esito = incollaCella(
        testo,
        riga.giorni[giorno] ?? null,
        { turniEsclusi: riga.turniEsclusi, inServizio: inServizioIl(riga.contratto, data) },
        richiesta.configurazione,
      );
      if (esito.esito === 'applicata') {
        applicate.push({ dipendenteId: riga.dipendenteId, giorno, cella: esito.cella });
      } else {
        saltate.push({
          dipendenteId: riga.dipendenteId,
          giorno,
          motivo: esito.motivo,
          codice: esito.codice,
        });
      }
    });
  });
  return { applicate, saltate, scartate };
}
