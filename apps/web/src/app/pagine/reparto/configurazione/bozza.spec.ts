import {
  TURNI_MODELLO,
  type ConfigurazioneFestivita,
  codiceAssenza,
  codiceTurno,
  oraLocale,
} from '@turni/domain';
import type { AssenzaSalvata } from '../../../dati/assenze.repo';
import type { RepartoConfigurazione } from '../../../dati/reparti.repo';
import type { TurnoSalvato } from '../../../dati/turni.repo';
import {
  bozzaIniziale,
  calcoliRiga,
  conCampo,
  impronta,
  nuovaRigaAssenza,
  nuovaRigaTurno,
  pianoDiSalvataggio,
  turniConOrarioCambiato,
  validaBozza,
  type Bozza,
  type DatiSalvati,
  type RigaTurno,
} from './bozza';

const FESTIVITA_VUOTA: ConfigurazioneFestivita = { nazionaliEscluse: [], locali: [] };

function reparto(passo: RepartoConfigurazione['passo'] = 'turni'): RepartoConfigurazione {
  return {
    id: 'r1',
    nome: 'Radiologia',
    coordinatoreUid: 'u1',
    passo,
    attribuzioneNotte: 'inizio',
    festivita: FESTIVITA_VUOTA,
  };
}

const R: AssenzaSalvata = {
  codice: codiceAssenza('R'),
  descrizione: 'Riposo',
  effetto: 'comeRiposo',
  malattia: false,
  predefinita: true,
  attivo: true,
  ordine: 0,
};
const MA: AssenzaSalvata = {
  codice: codiceAssenza('MA'),
  descrizione: 'Malattia',
  effetto: 'neutra',
  malattia: true,
  predefinita: true,
  attivo: true,
  ordine: 1,
};
const DOPO_PASSO_1: DatiSalvati = { turni: [], assenze: [R, MA] };

function contatore() {
  let n = 0;
  return () => ++n;
}

function turnoSalvato(codice: string, altro: Partial<TurnoSalvato> = {}): TurnoSalvato {
  return {
    codice: codiceTurno(codice),
    tipo: 'turno',
    nome: 'Mattina',
    colore: 'arancio',
    inizio: oraLocale('07:00'),
    fine: oraLocale('14:00'),
    pausaMinuti: 30,
    notturno: false,
    attivo: true,
    ordine: 0,
    ...altro,
  };
}

function riga(elenco: readonly RigaTurno[], indice: number): RigaTurno {
  const trovata = elenco[indice];
  if (trovata === undefined) {
    throw new Error(`Nessuna riga in posizione ${indice}`);
  }
  return trovata;
}

function con(bozza: Bozza, modifica: Partial<Bozza>): Bozza {
  return { ...bozza, ...modifica };
}

describe('bozzaIniziale', () => {
  it('un reparto appena creato parte dal modello M1, P1, N1', () => {
    const bozza = bozzaIniziale(reparto(), DOPO_PASSO_1, contatore());
    expect(bozza.turni.map((t) => t.codice)).toEqual(TURNI_MODELLO.map((t) => t.codice));
    expect(bozza.turni.every((t) => !t.salvato)).toBe(true);
    expect(bozza.fasce).toEqual([]);
    expect(bozza.assenze.map((a) => [a.codice, a.predefinita])).toEqual([
      ['R', true],
      ['MA', true],
    ]);
    expect(validaBozza(bozza).valida).toBe(true);
  });

  it('con turni già salvati non rimette il modello', () => {
    const bozza = bozzaIniziale(
      reparto(),
      { turni: [turnoSalvato('X1')], assenze: [R, MA] },
      contatore(),
    );
    expect(bozza.turni.map((t) => t.codice)).toEqual(['X1']);
    expect(bozza.turni[0]?.salvato).toBe(true);
  });
});

describe('modifica degli orari', () => {
  const base = nuovaRigaTurno('turno', [], 1);

  it('propone la pausa 30/0 finché non la si tocca (D5)', () => {
    const notte = conCampo(conCampo(base, 'turno', 'inizio', '22:00'), 'turno', 'fine', '07:00');
    expect(notte.pausa).toBe('0');
    const giorno = conCampo(conCampo(notte, 'turno', 'inizio', '08:00'), 'turno', 'fine', '16:00');
    expect(giorno.pausa).toBe('30');
    const scelta = conCampo(giorno, 'turno', 'pausa', '45');
    expect(conCampo(scelta, 'turno', 'fine', '14:00').pausa).toBe('45');
  });

  it('durata e notturno si calcolano dal dominio', () => {
    expect(calcoliRiga({ ...base, inizio: '22:00', fine: '07:00', pausa: '0' })).toEqual({
      durataMinuti: 540,
      notturno: true,
    });
    expect(calcoliRiga({ ...base, inizio: '07:00', fine: '14:00', pausa: '30' })).toEqual({
      durataMinuti: 390,
      notturno: false,
    });
    expect(calcoliRiga({ ...base, inizio: '', fine: '14:00' })).toBeNull();
  });

  it('il codice si scrive in maiuscolo', () => {
    expect(conCampo(base, 'turno', 'codice', 'm2').codice).toBe('M2');
  });
});

describe('validaBozza', () => {
  const partenza = bozzaIniziale(reparto(), DOPO_PASSO_1, contatore());

  it('segnala il codice collidente con il nome di chi lo usa', () => {
    const nuova: RigaTurno = {
      ...nuovaRigaTurno('turno', partenza.turni, 90),
      codice: 'N1',
      nome: 'Altro',
    };
    const errori = validaBozza(con(partenza, { turni: [...partenza.turni, nuova] }));
    expect(errori.valida).toBe(false);
    expect(errori.turni.get(90)?.codice).toBe('Codice già usato da N1 Notte');
  });

  it('turni, fasce e assenze non possono usare lo stesso codice', () => {
    const fascia: RigaTurno = {
      ...nuovaRigaTurno('reperibilita', [], 91),
      codice: 'M1',
      nome: 'Fascia',
    };
    const errori = validaBozza(con(partenza, { fasce: [fascia] }));
    expect(errori.fasce.get(91)?.codice).toContain('Codice già usato da M1');
    const assenza = { ...nuovaRigaAssenza(92), codice: 'M1', descrizione: 'Prova' };
    expect(
      validaBozza(con(partenza, { assenze: [...partenza.assenze, assenza] })).assenze.get(92)
        ?.codice,
    ).toBe('Il codice di un’assenza è una o due lettere, per esempio F.');
    const doppia = { ...nuovaRigaAssenza(93), codice: 'R', descrizione: 'Prova' };
    expect(
      validaBozza(con(partenza, { assenze: [...partenza.assenze, doppia] })).assenze.get(93)
        ?.codice,
    ).toBe('Codice già usato da R Riposo');
  });

  it('due righe nuove con lo stesso codice sono entrambe segnalate', () => {
    const a: RigaTurno = { ...nuovaRigaTurno('turno', [], 80), codice: 'Z1', nome: 'A' };
    const b: RigaTurno = { ...nuovaRigaTurno('turno', [], 81), codice: 'Z1', nome: 'B' };
    const errori = validaBozza(con(partenza, { turni: [a, b] }));
    expect(errori.turni.get(80)?.codice).toBe('Codice già usato da Z1 B');
    expect(errori.turni.get(81)?.codice).toBe('Codice già usato da Z1 A');
  });

  it('segnala formato del codice, nome, orari e pausa', () => {
    const riga: RigaTurno = {
      ...nuovaRigaTurno('turno', [], 70),
      codice: 'ABC',
      nome: '',
      inizio: '',
      pausa: 'x',
    };
    const errori = validaBozza(con(partenza, { turni: [riga] })).turni.get(70);
    expect(errori?.codice).toBe('Il codice di un turno è una lettera e una cifra, per esempio M1.');
    expect(errori?.nome).toBe('Scrivi il nome.');
    expect(errori?.inizio).toBe('Scrivi un orario valido (ore e minuti).');
    expect(errori?.pausa).toBe('La pausa è un numero intero di minuti.');
  });

  it('senza turni attivi segnala nessunTurno; nome del reparto vuoto è un errore', () => {
    const errori = validaBozza(con(partenza, { turni: [], nome: ' ' }));
    expect(errori.nessunTurno).toBe(true);
    expect(errori.nome).not.toBeNull();
    expect(errori.valida).toBe(false);
  });

  it('un’assenza senza descrizione è un errore', () => {
    const assenza = { ...nuovaRigaAssenza(60), codice: 'F' };
    expect(
      validaBozza(con(partenza, { assenze: [...partenza.assenze, assenza] })).assenze.get(60)
        ?.descrizione,
    ).toBe('Scrivi la descrizione.');
  });
});

describe('pianoDiSalvataggio', () => {
  it('il modello crea tre turni, con N1 notturno', () => {
    const bozza = bozzaIniziale(reparto(), DOPO_PASSO_1, contatore());
    const piano = pianoDiSalvataggio(bozza, DOPO_PASSO_1);
    expect(piano.map((o) => [o.tipo, 'codice' in o ? o.codice : ''])).toEqual([
      ['creaTurno', 'M1'],
      ['creaTurno', 'P1'],
      ['creaTurno', 'N1'],
    ]);
    const notte = piano.find((o) => o.tipo === 'creaTurno' && o.codice === 'N1');
    expect(notte?.tipo === 'creaTurno' && notte.campi.notturno).toBe(true);
    expect(notte?.tipo === 'creaTurno' && notte.campi.pausaMinuti).toBe(0);
  });

  it('scenario di accettazione: 4 turni (uno notturno), 2 fasce, 2 assenze', () => {
    const chiave = contatore();
    const iniziale = bozzaIniziale(reparto(), DOPO_PASSO_1, chiave);
    const quarto: RigaTurno = {
      ...nuovaRigaTurno('turno', iniziale.turni, chiave()),
      codice: 'G1',
      nome: 'Giornata',
      inizio: '08:00',
      fine: '17:00',
    };
    const fasce: RigaTurno[] = [
      {
        ...nuovaRigaTurno('reperibilita', [], chiave()),
        codice: 'R1',
        nome: 'Reperibilità giorno',
      },
      {
        ...nuovaRigaTurno('reperibilita', [], chiave()),
        codice: 'R2',
        nome: 'Reperibilità notte',
        inizio: '20:00',
        fine: '08:00',
      },
    ];
    const assenze = [
      ...iniziale.assenze,
      { ...nuovaRigaAssenza(chiave()), codice: 'F', descrizione: 'Ferie' },
      {
        ...nuovaRigaAssenza(chiave()),
        codice: 'PS',
        descrizione: 'Permesso',
        effetto: 'comeRiposo' as const,
      },
    ];
    const bozza = con(iniziale, { turni: [...iniziale.turni, quarto], fasce, assenze });
    expect(validaBozza(bozza).valida).toBe(true);
    const piano = pianoDiSalvataggio(bozza, DOPO_PASSO_1);
    expect(piano.filter((o) => o.tipo === 'creaTurno')).toHaveLength(6);
    expect(piano.filter((o) => o.tipo === 'creaAssenza')).toHaveLength(2);
    const turniCreati = piano.filter((o) => o.tipo === 'creaTurno');
    expect(turniCreati.filter((o) => o.campi.tipo === 'turno')).toHaveLength(4);
    expect(turniCreati.filter((o) => o.campi.tipo === 'turno' && o.campi.notturno)).toHaveLength(1);
    expect(turniCreati.filter((o) => o.campi.tipo === 'reperibilita')).toHaveLength(2);
    const r2 = turniCreati.find((o) => o.codice === 'R2');
    expect(r2?.campi.notturno).toBe(true);
    expect(r2?.campi.colore).toBeNull();
    expect(r2?.campi.pausaMinuti).toBe(0);
    // ordine continuo dai turni alle fasce
    expect(turniCreati.map((o) => o.campi.ordine)).toEqual([0, 1, 2, 3, 4, 5]);
    const ps = piano.find((o) => o.tipo === 'creaAssenza' && o.codice === 'PS');
    expect(ps?.tipo === 'creaAssenza' && ps.campi.effetto).toBe('comeRiposo');
  });

  it('non scrive ciò che non è cambiato; aggiorna e disattiva ciò che è cambiato', () => {
    const salvati: DatiSalvati = {
      turni: [turnoSalvato('M1'), turnoSalvato('P1', { ordine: 1, nome: 'Pomeriggio' })],
      assenze: [R, MA],
    };
    const bozza = bozzaIniziale(reparto('completata'), salvati, contatore());
    expect(pianoDiSalvataggio(bozza, salvati)).toEqual([]);
    const modificata = con(bozza, {
      turni: [{ ...riga(bozza.turni, 0), nome: 'Mattino', attivo: false }, riga(bozza.turni, 1)],
    });
    const piano = pianoDiSalvataggio(modificata, salvati);
    expect(piano).toHaveLength(1);
    expect(piano[0]).toMatchObject({
      tipo: 'aggiornaTurno',
      codice: 'M1',
      campi: { nome: 'Mattino', attivo: false },
    });
  });

  it('una riga salvata tolta dalla bozza diventa un’eliminazione', () => {
    const salvati: DatiSalvati = { turni: [turnoSalvato('M1')], assenze: [R, MA] };
    const bozza = bozzaIniziale(reparto(), salvati, contatore());
    expect(pianoDiSalvataggio(con(bozza, { turni: [] }), salvati)).toEqual([
      { tipo: 'eliminaTurno', codice: 'M1' },
    ]);
  });

  it('R e MA non compaiono mai nel piano', () => {
    const salvati: DatiSalvati = { turni: [turnoSalvato('M1')], assenze: [R, MA] };
    const bozza = bozzaIniziale(reparto(), salvati, contatore());
    const senzaPredefinite = con(bozza, { assenze: [] });
    expect(pianoDiSalvataggio(senzaPredefinite, salvati)).toEqual([]);
  });
});

describe('cambio d’orario di un turno salvato', () => {
  const salvati: DatiSalvati = { turni: [turnoSalvato('M1')], assenze: [R, MA] };

  it('chiede conferma solo se cambiano inizio, fine o pausa di un turno già salvato', () => {
    const bozza = bozzaIniziale(reparto('completata'), salvati, contatore());
    expect(turniConOrarioCambiato(bozza, salvati)).toEqual([]);
    const prima = riga(bozza.turni, 0);
    expect(
      turniConOrarioCambiato(con(bozza, { turni: [{ ...prima, nome: 'X' }] }), salvati),
    ).toEqual([]);
    expect(
      turniConOrarioCambiato(con(bozza, { turni: [{ ...prima, fine: '15:00' }] }), salvati),
    ).toEqual(['M1']);
    expect(
      turniConOrarioCambiato(con(bozza, { turni: [{ ...prima, pausa: '0' }] }), salvati),
    ).toEqual(['M1']);
  });

  it('una riga nuova non chiede conferma', () => {
    const bozza = bozzaIniziale(reparto(), DOPO_PASSO_1, contatore());
    expect(turniConOrarioCambiato(bozza, DOPO_PASSO_1)).toEqual([]);
  });
});

describe('impronta', () => {
  it('ignora le chiavi locali e cambia con i dati', () => {
    const a = bozzaIniziale(reparto(), DOPO_PASSO_1, contatore());
    const b = bozzaIniziale(
      reparto(),
      DOPO_PASSO_1,
      (() => {
        let n = 100;
        return () => ++n;
      })(),
    );
    expect(impronta(a)).toBe(impronta(b));
    expect(impronta(con(a, { nome: 'Altro' }))).not.toBe(impronta(a));
  });
});
