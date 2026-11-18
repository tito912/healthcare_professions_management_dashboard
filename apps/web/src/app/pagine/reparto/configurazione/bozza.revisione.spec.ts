// Review 1.3, rilievo 1: una riga salvata tolta dalla bozza («Elimina», prima del completamento) libera il suo
// codice nel modulo, ma il documento resta a database fino al salvataggio. Una riga nuova con lo stesso codice
// supera la validazione e il piano la scrive come `creaTurno`/`creaAssenza`: un `set` su un documento esistente,
// che le regole trattano come update e respingono (creatoIl cambia; per una fascia anche il tipo). Tutto il
// batch fallisce con «salvataggio non riuscito» e la collisione non è segnalata nel modulo (PIANO 1.3, criterio 4).
// Il test non impone una correzione: chiede solo che una bozza valida non produca creazioni su codici già salvati.
import { codiceAssenza, codiceTurno, oraLocale } from '@turni/domain';
import type { AssenzaSalvata } from '../../../dati/assenze.repo';
import type { RepartoConfigurazione } from '../../../dati/reparti.repo';
import type { TurnoSalvato } from '../../../dati/turni.repo';
import {
  bozzaIniziale,
  conCampo,
  nuovaRigaAssenza,
  nuovaRigaTurno,
  pianoDiSalvataggio,
  validaBozza,
  type Bozza,
  type DatiSalvati,
} from './bozza';

const REPARTO: RepartoConfigurazione = {
  id: 'r1',
  nome: 'Radiologia',
  coordinatoreUid: 'u1',
  passo: 'turni',
  attribuzioneNotte: 'inizio',
  festivita: { nazionaliEscluse: [], locali: [] },
};

function assenza(codice: string, predefinita: boolean, ordine: number): AssenzaSalvata {
  return {
    codice: codiceAssenza(codice),
    descrizione: codice === 'R' ? 'Riposo' : codice === 'MA' ? 'Malattia' : 'Ferie',
    effetto: codice === 'R' ? 'comeRiposo' : 'neutra',
    malattia: codice === 'MA',
    predefinita,
    attivo: true,
    ordine,
  };
}

const M1: TurnoSalvato = {
  codice: codiceTurno('M1'),
  tipo: 'turno',
  nome: 'Mattina',
  colore: 'arancio',
  inizio: oraLocale('07:00'),
  fine: oraLocale('14:00'),
  pausaMinuti: 30,
  notturno: false,
  attivo: true,
  ordine: 0,
};

const SALVATI: DatiSalvati = {
  turni: [M1],
  assenze: [assenza('R', true, 0), assenza('MA', true, 1), assenza('F', false, 2)],
};

function partenza(): Bozza {
  let n = 0;
  return bozzaIniziale(REPARTO, SALVATI, () => ++n);
}

/** Codici che il piano «crea» pur essendo già a database: il batch verrebbe respinto per intero. */
function creazioniSuCodiciSalvati(bozza: Bozza): readonly string[] {
  return pianoDiSalvataggio(bozza, SALVATI)
    .filter(
      (op) =>
        (op.tipo === 'creaTurno' && SALVATI.turni.some((t) => t.codice === op.codice)) ||
        (op.tipo === 'creaAssenza' && SALVATI.assenze.some((a) => a.codice === op.codice)),
    )
    .map((op) => op.codice);
}

describe('revisione 1.3: codice di una riga salvata, tolta e ricreata nella stessa bozza', () => {
  it('turno M1 eliminato e un turno nuovo M1: o il modulo lo segnala, o il piano non ricrea M1', () => {
    const bozza = partenza();
    const nuova = {
      ...conCampo(nuovaRigaTurno('turno', [], 100), 'turno', 'codice', 'm1'),
      nome: 'Mattina lunga',
      fine: '15:00',
    };
    const conM1Ricreato: Bozza = { ...bozza, turni: [nuova] };
    const errori = validaBozza(conM1Ricreato);
    const segnalato = errori.turni.get(100)?.codice !== undefined;
    expect(segnalato || creazioniSuCodiciSalvati(conM1Ricreato).length === 0).toBe(true);
  });

  it('turno M1 eliminato e una fascia nuova M1: il modulo deve segnalarlo (il tipo non cambia a database)', () => {
    const bozza = partenza();
    const fascia = {
      ...conCampo(nuovaRigaTurno('reperibilita', [], 101), 'reperibilita', 'codice', 'M1'),
      nome: 'Reperibilità mattina',
    };
    const errori = validaBozza({ ...bozza, turni: [], fasce: [fascia] });
    expect(errori.fasce.get(101)?.codice).toBeDefined();
  });

  it('assenza F eliminata e un’assenza nuova F: o il modulo lo segnala, o il piano non ricrea F', () => {
    const bozza = partenza();
    const nuova = { ...nuovaRigaAssenza(102), codice: 'F', descrizione: 'Ferie estive' };
    const conFRicreata: Bozza = {
      ...bozza,
      assenze: [...bozza.assenze.filter((a) => a.codice !== 'F'), nuova],
    };
    const errori = validaBozza(conFRicreata);
    const segnalato = errori.assenze.get(102)?.codice !== undefined;
    expect(segnalato || creazioniSuCodiciSalvati(conFRicreata).length === 0).toBe(true);
  });
});

// Review 1.3, rilievo 2: le righe del modello (U11) nascono con `pausaScelta: true` (bozza.ts:109), quindi
// cambiando gli orari la pausa non è più proposta, anche se l'utente non l'ha mai toccata (UX §7.4, D5).
describe('revisione 1.3: pausa proposta sulle righe del modello', () => {
  it('M1 del modello portato a 22:00-06:00 propone pausa 0 (notturno), come una riga nuova', () => {
    let n = 0;
    const bozza = bozzaIniziale(REPARTO, { turni: [], assenze: SALVATI.assenze }, () => ++n);
    const m1 = bozza.turni.find((r) => r.codice === 'M1');
    if (m1 === undefined) {
      throw new Error('Il modello non contiene M1');
    }
    const notte = conCampo(conCampo(m1, 'turno', 'inizio', '22:00'), 'turno', 'fine', '06:00');
    expect(notte.pausa).toBe('0');
  });
});
