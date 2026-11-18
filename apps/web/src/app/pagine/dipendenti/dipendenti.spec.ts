import { codiceTurno, dataISO } from '@turni/domain';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import type { TurnoSalvato } from '../../dati/turni.repo';
import { oraLocale } from '@turni/domain';
import { assestati, montaDipendenti, pulsante, scrivi, testoDi } from '../../test/monta-dipendenti';

function dipendente(
  id: string,
  nome: string,
  cognome: string,
  cambi: Partial<DipendenteSalvato> = {},
): DipendenteSalvato {
  return {
    id,
    nome,
    cognome,
    oreSettimanali: 36,
    turniEsclusi: [],
    dataAssunzione: null,
    dataCessazione: null,
    attivo: true,
    ...cambi,
  };
}

const NOTTE: TurnoSalvato = {
  codice: codiceTurno('N1'),
  tipo: 'turno',
  nome: 'Notte',
  colore: 'blu-notte',
  inizio: oraLocale('21:00'),
  fine: oraLocale('07:00'),
  pausaMinuti: 0,
  notturno: true,
  attivo: true,
  ordine: 2,
};

const DIPENDENTI: DipendenteSalvato[] = [
  dipendente('d1', 'Laura', 'Bianchi', { turniEsclusi: [codiceTurno('N1')] }),
  dipendente('d2', 'Anna', 'Verdi', { oreSettimanali: 30, dataCessazione: dataISO('2099-12-31') }),
  dipendente('d3', 'Nicolò', 'Rossi'),
  dipendente('d4', 'Carlo', 'Neri', { attivo: false, dataCessazione: dataISO('2025-01-31') }),
  dipendente('d5', 'Elena', 'Bruni', { dataCessazione: dataISO('2020-06-30') }),
];

/** Una stringa per riga, con le celle separate da uno spazio (testoDi sulla riga le attaccherebbe). */
const righe = (radice: HTMLElement): string[] =>
  Array.from(radice.querySelectorAll('tbody tr')).map((r) =>
    Array.from(r.children)
      .map((cella) => testoDi(cella))
      .filter((testo) => testo !== '')
      .join(' '),
  );

describe('Elenco dei dipendenti', () => {
  it('mostra gli in servizio in ordine di cognome, con ore, turni esclusi e stato', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      dipendenti: DIPENDENTI,
      turni: [NOTTE],
    });
    const testo = testoDi(radice());
    expect(testo).toContain('Dipendenti di Radiologia');
    expect(righe(radice())).toEqual([
      'Bianchi Laura 36,0 N1 in servizio',
      'Rossi Nicolò 36,0 — in servizio',
      'Verdi Anna 30,0 — cessa il 31/12/2099',
    ]);
    // Il chip del turno escluso porta il codice e il colore del turno.
    const chip = radice().querySelector<HTMLElement>('app-chip-turno');
    expect(testoDi(chip as Element)).toBe('N1');
    expect(chip?.style.backgroundColor).not.toBe('');
  });

  it('il filtro «Cessati» mostra solo i cessati (disattivati o con cessazione passata)', async () => {
    const { harness, radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      dipendenti: DIPENDENTI,
    });
    const cessati = Array.from(
      radice().querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ).find((r) => r.value === 'cessati');
    cessati?.click();
    await assestati(harness);
    expect(righe(radice())).toEqual([
      'Bruni Elena 36,0 — cessato il 30/06/2020',
      'Neri Carlo 36,0 — cessato il 31/01/2025',
    ]);
    const tutti = Array.from(radice().querySelectorAll<HTMLInputElement>('input[type=radio]')).find(
      (r) => r.value === 'tutti',
    );
    tutti?.click();
    await assestati(harness);
    expect(righe(radice())).toHaveLength(5);
    expect(testoDi(radice())).toContain('5 dipendenti');
  });

  it('la ricerca per nome ignora maiuscole e accenti', async () => {
    const { harness, radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      dipendenti: DIPENDENTI,
    });
    const campo = radice().querySelector<HTMLInputElement>('input[type=text]');
    scrivi(campo as HTMLInputElement, 'NICOLO');
    await assestati(harness);
    expect(righe(radice())).toEqual(['Rossi Nicolò 36,0 — in servizio']);
    scrivi(campo as HTMLInputElement, 'zzz');
    await assestati(harness);
    expect(testoDi(radice())).toContain('Nessun dipendente corrisponde alla ricerca');
  });

  it('non mostra né chiede dati riservati', async () => {
    const { radice, funzioni } = await montaDipendenti('/reparti/r1/dipendenti', {
      dipendenti: DIPENDENTI,
    });
    expect(funzioni.leggiDatiPrivati).not.toHaveBeenCalled();
    const intestazioni = Array.from(radice().querySelectorAll('thead th')).map((t) => testoDi(t));
    expect(intestazioni).toEqual([
      'Cognome',
      'Nome',
      'Ore sett.',
      'Turni esclusi',
      'Stato',
      'Azioni',
    ]);
  });

  it('senza dipendenti: stato vuoto con «Aggiungi dipendente»', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti');
    expect(testoDi(radice())).toContain('Nessun dipendente');
    expect(() => pulsante(radice(), 'Aggiungi dipendente')).not.toThrow();
  });

  it('errore di caricamento con «Riprova»', async () => {
    let tentativi = 0;
    const { harness, radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      letturaDipendenti: () => {
        tentativi += 1;
        return tentativi === 1 ? Promise.reject(new Error('rete')) : Promise.resolve(DIPENDENTI);
      },
    });
    expect(testoDi(radice())).toContain('Impossibile caricare i dipendenti.');
    pulsante(radice(), 'Riprova').click();
    await assestati(harness);
    expect(righe(radice())).toHaveLength(3);
  });

  it('reparto non leggibile: «Reparto non disponibile.»', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      letturaReparto: () => Promise.resolve(null),
    });
    expect(testoDi(radice())).toContain('Reparto non disponibile.');
  });

  it('ADMIN: sola consultazione, nessun pulsante di modifica', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      ruolo: 'ADMIN',
      passo: 'dipendenti',
      dipendenti: DIPENDENTI,
    });
    const testo = testoDi(radice());
    expect(testo).toContain('Sola consultazione (ADMIN)');
    expect(testo).not.toContain('Nuovo dipendente');
    expect(testo).not.toContain('Fine: vai alla pianificazione');
  });
});

describe('Passo 3 della creazione guidata', () => {
  it('con il passo «dipendenti»: indicatore dei passi e «Fine» disabilitato senza dipendenti', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', { passo: 'dipendenti' });
    expect(testoDi(radice())).toContain('Dipendenti(in corso)');
    const fine = pulsante(radice(), 'Fine: vai alla pianificazione') as HTMLButtonElement;
    expect(fine.disabled).toBe(true);
    expect(testoDi(radice())).toContain('Aggiungi almeno un dipendente per continuare.');
  });

  it('«Fine» con almeno un dipendente imposta il passo «completata» e apre la pianificazione', async () => {
    const { harness, radice, router, completamenti, elenco } = await montaDipendenti(
      '/reparti/r1/dipendenti',
      { passo: 'dipendenti', dipendenti: DIPENDENTI },
    );
    const fine = pulsante(radice(), 'Fine: vai alla pianificazione') as HTMLButtonElement;
    expect(fine.disabled).toBe(false);
    fine.click();
    await assestati(harness);
    expect(completamenti).toEqual([{ repartoId: 'r1', uid: 'u1' }]);
    expect(elenco.carica).toHaveBeenCalledWith(true);
    expect(router.url).toBe('/reparti/r1');
  });

  it('un errore nel completamento non cambia pagina e lo dice', async () => {
    const { harness, radice, router, configurazione, toast } = await montaDipendenti(
      '/reparti/r1/dipendenti',
      { passo: 'dipendenti', dipendenti: DIPENDENTI },
    );
    configurazione.completa.mockRejectedValueOnce(new Error('rifiutato'));
    pulsante(radice(), 'Fine: vai alla pianificazione').click();
    await assestati(harness);
    expect(router.url).toBe('/reparti/r1/dipendenti');
    expect(toast.messaggi().map((m) => m.testo)).toContain(
      'Non è stato possibile completare la configurazione: riprova.',
    );
  });

  it('con il passo «turni» non si può chiudere la configurazione: rimanda ai turni', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      passo: 'turni',
      dipendenti: DIPENDENTI,
    });
    const testo = testoDi(radice());
    expect(testo).not.toContain('Fine: vai alla pianificazione');
    expect(testo).toContain('Prima di continuare completa i turni e le reperibilità.');
  });

  it('a configurazione completata non ci sono né indicatore né «Fine»', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti', {
      passo: 'completata',
      dipendenti: DIPENDENTI,
    });
    const testo = testoDi(radice());
    expect(testo).not.toContain('in corso');
    expect(testo).not.toContain('Fine: vai alla pianificazione');
  });
});
