import { codiceTurno, dataISO, oraLocale, type LeggiDatiPrivatiOutput } from '@turni/domain';
import type { DipendenteSalvato } from '../../dati/dipendenti.repo';
import type { TurnoSalvato } from '../../dati/turni.repo';
import {
  assestati,
  campoConEtichetta,
  montaDipendenti,
  pulsante,
  scrivi,
  testoDi,
} from '../../test/monta-dipendenti';

const CF = 'BNCLRA80A41H501D';
const PRIVATI: LeggiDatiPrivatiOutput = {
  codiceFiscale: CF,
  dataNascita: dataISO('1980-01-01'),
  email: 'laura.bianchi@ospedale.it',
};

const LAURA: DipendenteSalvato = {
  id: 'd1',
  nome: 'Laura',
  cognome: 'Bianchi',
  oreSettimanali: 36,
  turniEsclusi: [codiceTurno('N1')],
  dataAssunzione: null,
  dataCessazione: null,
  attivo: true,
};

function turno(codice: string, nome: string, cambi: Partial<TurnoSalvato> = {}): TurnoSalvato {
  return {
    codice: codiceTurno(codice),
    tipo: 'turno',
    nome,
    colore: 'azzurro',
    inizio: oraLocale('07:00'),
    fine: oraLocale('14:00'),
    pausaMinuti: 30,
    notturno: false,
    attivo: true,
    ordine: 1,
    ...cambi,
  };
}

const TURNI = [
  turno('M1', 'Mattina'),
  turno('N1', 'Notte', { colore: 'blu-notte', notturno: true }),
  turno('R1', 'Reperibilità pomeriggio', { tipo: 'reperibilita', colore: null }),
];

const URL_LAURA = '/reparti/r1/dipendenti/d1/anagrafica';

describe('Scheda del dipendente: coordinatore', () => {
  it('all’apertura chiede i dati riservati al server e li mostra nei campi', async () => {
    const { radice, letture } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
    });
    expect(letture).toEqual([{ repartoId: 'r1', dipendenteId: 'd1' }]);
    const r = radice();
    expect(campoConEtichetta(r, 'Nome').value).toBe('Laura');
    expect(campoConEtichetta(r, 'Cognome').value).toBe('Bianchi');
    expect(campoConEtichetta(r, 'Codice fiscale').value).toBe(CF);
    expect(campoConEtichetta(r, 'Data di nascita').value).toBe('1980-01-01');
    expect(campoConEtichetta(r, 'Email').value).toBe('laura.bianchi@ospedale.it');
    expect(campoConEtichetta(r, 'Ore settimanali').value).toBe('36');
    expect(testoDi(r)).toContain('Scheda di Laura Bianchi');
  });

  it('mentre i dati riservati arrivano dice «Caricamento dei dati riservati…» e blocca il salvataggio dei campi', async () => {
    let risolvi: (dati: LeggiDatiPrivatiOutput) => void = () => undefined;
    const { harness, radice } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: () => new Promise((r) => (risolvi = r)),
    });
    expect(testoDi(radice())).toContain('Caricamento dei dati riservati…');
    expect(radice().querySelector('input[type=email]')).toBeNull();
    risolvi(PRIVATI);
    await assestati(harness);
    expect(testoDi(radice())).not.toContain('Caricamento dei dati riservati…');
    expect(campoConEtichetta(radice(), 'Codice fiscale').value).toBe(CF);
  });

  it('turni esclusi: caselle col chip colorato; la fascia di reperibilità è etichettata', async () => {
    const { radice } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
    });
    const caselle = Array.from(
      radice().querySelectorAll<HTMLInputElement>('fieldset input[type=checkbox]'),
    );
    expect(
      caselle.map((c) =>
        Array.from(c.closest('label')?.children ?? [])
          .map((figlio) => testoDi(figlio))
          .filter((testo) => testo !== '')
          .join(' '),
      ),
    ).toEqual(['M1 Mattina', 'N1 Notte', 'R1 Reperibilità pomeriggio (reperibilità)']);
    expect(caselle.map((c) => c.checked)).toEqual([false, true, false]);
  });

  it('dati riservati non disponibili: messaggio, «Riprova» e si salva comunque il resto senza dati riservati', async () => {
    let tentativi = 0;
    const { harness, radice, salvataggi } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: () => {
        tentativi += 1;
        return tentativi === 1 ? Promise.reject(new Error('rete')) : Promise.resolve(PRIVATI);
      },
    });
    expect(testoDi(radice())).toContain('Dati riservati non disponibili.');
    scrivi(campoConEtichetta(radice(), 'Ore settimanali'), '30');
    await assestati(harness);
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi).toHaveLength(1);
    expect(salvataggi[0]).toMatchObject({ dipendenteId: 'd1', privati: null });
    expect(salvataggi[0]?.anagrafica.oreSettimanali).toBe(30);
  });

  it('modificando solo le ore i dati riservati non si rimandano; si torna all’elenco senza avvisi', async () => {
    const { harness, radice, salvataggi, router, dialoghi, toast } = await montaDipendenti(
      URL_LAURA,
      {
        dipendenti: [LAURA],
        turni: TURNI,
        privati: PRIVATI,
      },
    );
    scrivi(campoConEtichetta(radice(), 'Ore settimanali'), '37,5');
    await assestati(harness);
    expect(testoDi(radice())).toContain('Ci sono modifiche non salvate.');
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi).toEqual([
      {
        repartoId: 'r1',
        dipendenteId: 'd1',
        anagrafica: {
          nome: 'Laura',
          cognome: 'Bianchi',
          oreSettimanali: 37.5,
          turniEsclusi: ['N1'],
          dataAssunzione: null,
          dataCessazione: null,
          attivo: true,
        },
        privati: null,
      },
    ]);
    expect(router.url).toBe('/reparti/r1/dipendenti');
    expect(dialoghi.conferma).not.toHaveBeenCalled();
    expect(toast.messaggi().map((m) => m.testo)).toContain('Dipendente salvato.');
  });

  it('modificando un dato riservato si mandano tutti e tre', async () => {
    const { harness, radice, salvataggi } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
    });
    scrivi(campoConEtichetta(radice(), 'Email'), 'nuova@ospedale.it');
    await assestati(harness);
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi[0]?.privati).toEqual({
      codiceFiscale: CF,
      dataNascita: '1980-01-01',
      email: 'nuova@ospedale.it',
    });
  });

  it('turni esclusi: si possono aggiungere e togliere', async () => {
    const { harness, radice, salvataggi } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
    });
    const caselle = Array.from(
      radice().querySelectorAll<HTMLInputElement>('fieldset input[type=checkbox]'),
    );
    caselle[0]?.click(); // M1
    caselle[1]?.click(); // N1 via
    await assestati(harness);
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi[0]?.anagrafica.turniEsclusi).toEqual(['M1']);
  });

  it('«Disattiva…» chiede la data e la applica al form; il salvataggio resta esplicito', async () => {
    const { harness, radice, salvataggi, dialoghi } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
      esitoDialogoDisattiva: '2026-12-31',
    });
    pulsante(radice(), 'Disattiva…').click();
    await assestati(harness);
    expect(dialoghi.apri).toHaveBeenCalledTimes(1);
    expect(salvataggi).toEqual([]);
    expect(campoConEtichetta(radice(), 'Data di cessazione').value).toBe('2026-12-31');
    expect(testoDi(radice())).toContain(
      'Disattivato con data di cessazione 31/12/2026: salva per confermare.',
    );
    // Il pulsante diventa «Riattiva».
    expect(() => pulsante(radice(), 'Riattiva')).not.toThrow();
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi[0]?.anagrafica).toMatchObject({
      attivo: false,
      dataCessazione: '2026-12-31',
    });
  });

  it('«Disattiva…» annullato non cambia nulla', async () => {
    const { harness, radice } = await montaDipendenti(URL_LAURA, {
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
      esitoDialogoDisattiva: undefined,
    });
    pulsante(radice(), 'Disattiva…').click();
    await assestati(harness);
    expect(campoConEtichetta(radice(), 'Data di cessazione').value).toBe('');
    expect(testoDi(radice())).not.toContain('Ci sono modifiche non salvate.');
  });

  it('«Riattiva» toglie la data di cessazione', async () => {
    const cessata: DipendenteSalvato = {
      ...LAURA,
      attivo: false,
      dataCessazione: dataISO('2026-06-30'),
    };
    const { harness, radice, salvataggi } = await montaDipendenti(URL_LAURA, {
      dipendenti: [cessata],
      turni: TURNI,
      privati: PRIVATI,
    });
    expect(testoDi(radice())).toContain('Disattivato: ultimo giorno di servizio 30/06/2026.');
    pulsante(radice(), 'Riattiva').click();
    await assestati(harness);
    expect(campoConEtichetta(radice(), 'Data di cessazione').value).toBe('');
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi[0]?.anagrafica).toMatchObject({ attivo: true, dataCessazione: null });
  });

  it('dipendente inesistente: «Dipendente non trovato.»', async () => {
    const { radice } = await montaDipendenti('/reparti/r1/dipendenti/zzz/anagrafica', {
      dipendenti: [LAURA],
    });
    expect(testoDi(radice())).toContain('Dipendente non trovato.');
  });

  describe('modifiche non salvate', () => {
    it('uscendo con modifiche chiede conferma e, se si resta, non cambia pagina', async () => {
      const { harness, radice, router, dialoghi } = await montaDipendenti(URL_LAURA, {
        dipendenti: [LAURA],
        turni: TURNI,
        privati: PRIVATI,
        confermaUscita: false,
      });
      scrivi(campoConEtichetta(radice(), 'Nome'), 'Laurina');
      await assestati(harness);
      await router.navigateByUrl('/reparti/r1/dipendenti');
      await assestati(harness);
      expect(dialoghi.conferma).toHaveBeenCalledTimes(1);
      expect(router.url).toBe(URL_LAURA);
      expect(campoConEtichetta(radice(), 'Nome').value).toBe('Laurina');
    });

    it('confermando l’uscita le modifiche si perdono', async () => {
      const { harness, radice, router } = await montaDipendenti(URL_LAURA, {
        dipendenti: [LAURA],
        turni: TURNI,
        privati: PRIVATI,
        confermaUscita: true,
      });
      scrivi(campoConEtichetta(radice(), 'Nome'), 'Laurina');
      await assestati(harness);
      await router.navigateByUrl('/reparti/r1/dipendenti');
      await assestati(harness);
      expect(router.url).toBe('/reparti/r1/dipendenti');
    });

    it('senza modifiche si esce senza chiedere nulla', async () => {
      const { harness, radice, router, dialoghi } = await montaDipendenti(URL_LAURA, {
        dipendenti: [LAURA],
        turni: TURNI,
        privati: PRIVATI,
      });
      pulsante(radice(), 'Annulla').click();
      await assestati(harness);
      expect(dialoghi.conferma).not.toHaveBeenCalled();
      expect(router.url).toBe('/reparti/r1/dipendenti');
    });

    it('anche passando a un altro dipendente le modifiche vengono segnalate', async () => {
      const ALTRA: DipendenteSalvato = { ...LAURA, id: 'd2', nome: 'Anna', cognome: 'Verdi' };
      const { harness, radice, router, dialoghi } = await montaDipendenti(URL_LAURA, {
        dipendenti: [LAURA, ALTRA],
        turni: TURNI,
        privati: PRIVATI,
        confermaUscita: false,
      });
      scrivi(campoConEtichetta(radice(), 'Nome'), 'Laurina');
      await assestati(harness);
      await router.navigateByUrl('/reparti/r1/dipendenti/d2/anagrafica');
      await assestati(harness);
      expect(dialoghi.conferma).toHaveBeenCalledTimes(1);
      expect(router.url).toBe(URL_LAURA);
    });
  });
});

describe('Scheda del dipendente: nuovo dipendente', () => {
  const URL_NUOVO = '/reparti/r1/dipendenti/nuovo';

  async function compila(radice: () => HTMLElement, harnessAssesta: () => Promise<void>) {
    scrivi(campoConEtichetta(radice(), 'Nome'), 'Laura');
    scrivi(campoConEtichetta(radice(), 'Cognome'), 'Bianchi');
    scrivi(campoConEtichetta(radice(), 'Codice fiscale'), CF.toLowerCase());
    scrivi(campoConEtichetta(radice(), 'Data di nascita'), '1980-01-01');
    scrivi(campoConEtichetta(radice(), 'Email'), 'Laura.Bianchi@Ospedale.it');
    await harnessAssesta();
  }

  it('parte con 36 ore e non chiede dati riservati al server', async () => {
    const { radice, letture } = await montaDipendenti(URL_NUOVO, { turni: TURNI });
    expect(letture).toEqual([]);
    expect(campoConEtichetta(radice(), 'Ore settimanali').value).toBe('36');
    expect(testoDi(radice())).toContain('Nuovo dipendente');
    expect(testoDi(radice())).not.toContain('Disattiva…');
  });

  it('il codice fiscale si scrive in maiuscolo e si segnala quando è completo e sbagliato', async () => {
    const { harness, radice } = await montaDipendenti(URL_NUOVO, { turni: TURNI });
    const campo = campoConEtichetta(radice(), 'Codice fiscale');
    scrivi(campo, 'bnclra');
    await assestati(harness);
    expect(campo.value).toBe('BNCLRA');
    expect(testoDi(radice())).not.toContain('Il codice fiscale ha 16 caratteri.');
    scrivi(campo, 'bnclra80a41h501x');
    await assestati(harness);
    expect(testoDi(radice())).toContain('Il carattere di controllo non corrisponde');
    scrivi(campo, CF);
    await assestati(harness);
    expect(testoDi(radice())).not.toContain('carattere di controllo');
  });

  it('un form incompleto non invia nulla e porta il focus sul primo errore', async () => {
    const { harness, radice, salvataggi } = await montaDipendenti(URL_NUOVO, { turni: TURNI });
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi).toEqual([]);
    const testo = testoDi(radice());
    expect(testo).toContain('Scrivi il nome (al massimo 60 caratteri).');
    expect(testo).toContain('Scrivi il codice fiscale.');
    expect(testo).toContain('Scrivi la data di nascita.');
    expect(testo).toContain('Correggi i campi segnalati prima di salvare.');
    expect(document.activeElement).toBe(campoConEtichetta(radice(), 'Nome'));
  });

  it('con tutti i dati invia la creazione con i dati riservati normalizzati e torna all’elenco', async () => {
    const { harness, radice, salvataggi, router } = await montaDipendenti(URL_NUOVO, {
      turni: TURNI,
    });
    await compila(radice, () => assestati(harness));
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi).toEqual([
      {
        repartoId: 'r1',
        dipendenteId: null,
        anagrafica: {
          nome: 'Laura',
          cognome: 'Bianchi',
          oreSettimanali: 36,
          turniEsclusi: [],
          dataAssunzione: null,
          dataCessazione: null,
          attivo: true,
        },
        privati: {
          codiceFiscale: CF,
          dataNascita: '1980-01-01',
          email: 'laura.bianchi@ospedale.it',
        },
      },
    ]);
    expect(router.url).toBe('/reparti/r1/dipendenti');
  });

  it('codice fiscale già presente: l’errore del server sta sotto il campo e le modifiche restano', async () => {
    const { harness, radice, salvataggi, toast, router } = await montaDipendenti(URL_NUOVO, {
      turni: TURNI,
      erroreSalvataggio: 'CF_DUPLICATO',
    });
    await compila(radice, () => assestati(harness));
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(salvataggi).toHaveLength(1);
    expect(testoDi(radice())).toContain('Questo codice fiscale è già presente in anagrafica.');
    expect(toast.messaggi()).toEqual([]);
    expect(router.url).toBe('/reparti/r1/dipendenti/nuovo');
    expect(campoConEtichetta(radice(), 'Nome').value).toBe('Laura');
    // Cambiando il codice fiscale l'errore del server scompare.
    scrivi(campoConEtichetta(radice(), 'Codice fiscale'), 'RSSMRA85T10A562S');
    await assestati(harness);
    expect(testoDi(radice())).not.toContain('già presente');
  });

  it('un errore imprevisto del server è un avviso, non un campo', async () => {
    const { harness, radice, toast } = await montaDipendenti(URL_NUOVO, {
      turni: TURNI,
      erroreSalvataggio: 'ERRORE_INTERNO',
    });
    await compila(radice, () => assestati(harness));
    pulsante(radice(), 'Salva').click();
    await assestati(harness);
    expect(toast.messaggi().map((m) => m.testo)).toEqual([
      'Errore del servizio: riprova tra poco.',
    ]);
  });

  it('il nuovo dipendente con modifiche chiede conferma prima di uscire', async () => {
    const { harness, radice, router, dialoghi } = await montaDipendenti(URL_NUOVO, {
      turni: TURNI,
      confermaUscita: false,
    });
    scrivi(campoConEtichetta(radice(), 'Nome'), 'Laura');
    await assestati(harness);
    await router.navigateByUrl('/reparti/r1/dipendenti');
    await assestati(harness);
    expect(dialoghi.conferma).toHaveBeenCalledTimes(1);
    expect(router.url).toBe(URL_NUOVO);
  });
});

describe('Scheda del dipendente: ADMIN (sola consultazione)', () => {
  it('non chiede i dati riservati finché non si preme «Mostra dati riservati»', async () => {
    const { harness, radice, letture } = await montaDipendenti(URL_LAURA, {
      ruolo: 'ADMIN',
      dipendenti: [LAURA],
      turni: TURNI,
      privati: PRIVATI,
    });
    expect(letture).toEqual([]);
    const testo = testoDi(radice());
    expect(testo).toContain('Laura');
    expect(testo).not.toContain(CF);
    expect(testo).not.toContain('laura.bianchi@ospedale.it');
    pulsante(radice(), 'Mostra dati riservati').click();
    await assestati(harness);
    expect(letture).toEqual([{ repartoId: 'r1', dipendenteId: 'd1' }]);
    expect(testoDi(radice())).toContain(CF);
    expect(testoDi(radice())).toContain('01/01/1980');
    expect(testoDi(radice())).toContain('laura.bianchi@ospedale.it');
  });

  it('nessun campo, nessun «Salva», nessun «Disattiva…»', async () => {
    const { radice } = await montaDipendenti(URL_LAURA, {
      ruolo: 'ADMIN',
      dipendenti: [LAURA],
      turni: TURNI,
    });
    expect(
      radice().querySelectorAll('aside input[type=text], aside input[type=email]'),
    ).toHaveLength(0);
    const testo = testoDi(radice());
    expect(testo).not.toMatch(/\bSalva\b/u);
    expect(testo).not.toContain('Disattiva…');
  });

  it('la rotta «nuovo» non è per l’ADMIN: torna alla Home', async () => {
    const { router } = await montaDipendenti('/reparti/r1/dipendenti/nuovo', { ruolo: 'ADMIN' });
    expect(router.url).toBe('/home');
  });

  it('dati riservati non disponibili: messaggio e «Riprova»', async () => {
    const { harness, radice } = await montaDipendenti(URL_LAURA, {
      ruolo: 'ADMIN',
      dipendenti: [LAURA],
      privati: () => Promise.reject(new Error('rete')),
    });
    pulsante(radice(), 'Mostra dati riservati').click();
    await assestati(harness);
    expect(testoDi(radice())).toContain('Dati riservati non disponibili.');
    expect(() => pulsante(radice(), 'Riprova')).not.toThrow();
  });
});
