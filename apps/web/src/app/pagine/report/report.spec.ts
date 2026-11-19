// Test di componente del Report (PIANO 4.1 criterio 5, UX §7.10): provvisorio, file e invio solo con i mesi convalidati,
// tabella dal documento, «Scarica Excel», «Invia a tutti…» con conferma, reinvio per riga, ADMIN senza invio, scheda
// «Festività dell'anno».
import { codiceTurno, idBimestre, chiaveMese } from '@turni/domain';
import {
  conteggi,
  mesiDel,
  montaReport,
  reportSalvato,
  riepilogoReport,
} from '../../test/monta-report';
import { pulsante, testoDi } from '../../test/monta-griglia';

/** 6 gennaio 2027, 07:00 UTC (08:00 a Roma). */
const ISTANTE_INVIO = 1799218800000;

const NOV_DIC = idBimestre('2026-B6');

const RIEPILOGHI = [
  riepilogoReport('d1', '2026-11', {
    turniSvolti: 3,
    notti: 1,
    sabati: 1,
    domenicheEFestivi: 1,
    reperibilitaSvolte: 1,
    chiamate: 1,
    minutiChiamate: 90,
  }),
  riepilogoReport('d1', '2026-12', { turniSvolti: 2, domenicheEFestivi: 1 }),
  riepilogoReport('d2', '2026-11', { turniSvolti: 4, sabati: 2 }),
  riepilogoReport('d3', '2026-11', {}),
];

const riga = (radice: HTMLElement, id: string): HTMLElement =>
  radice.querySelector(`tbody tr[data-dipendente="${id}"]`) as HTMLElement;
const cella = (radice: HTMLElement, id: string, nome: string): HTMLElement =>
  riga(radice, id).querySelector(`[data-cella="${nome}"]`) as HTMLElement;
const totale = (radice: HTMLElement, nome: string): HTMLElement =>
  radice.querySelector(`tfoot [data-totale="${nome}"]`) as HTMLElement;

describe('Report: bimestre in corso (provvisorio)', () => {
  const opzioni = {
    mesi: () => mesiDel('convalidato', 'bozza'),
    riepiloghi: RIEPILOGHI,
  };

  it('mostra titolo, bimestre e una riga per dipendente con i conteggi dei due mesi, in ordine di cognome', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    expect(testoDi(radice.querySelector('h1') as Element)).toBe('Radiologia › Report');
    expect(testoDi(radice.querySelector('[data-bimestre]') as Element)).toBe('nov–dic 2026');
    const nomi = Array.from(radice.querySelectorAll('tbody th')).map(testoDi);
    expect(nomi).toEqual(['Bianchi L.', 'Rossi M.', 'Verdi A.']);
    const intestazioni = Array.from(radice.querySelectorAll('thead th')).map(testoDi);
    expect(intestazioni).toEqual([
      'Dipendente',
      'Turni svolti',
      'di cui notti',
      'di cui sabati',
      'di cui domeniche e festivi',
      'Reperibilità svolte',
      'Chiamate',
      'Durata chiamate',
      'Ultimo invio',
      'Azioni',
    ]);
    expect(t.reportRepo.leggi).toHaveBeenCalledWith('r1', NOV_DIC);
    expect(t.riepiloghiRepo.perReport).toHaveBeenCalledWith('r1', '2026-11', '2026-12');
  });

  it('i valori sono provvisori: prefisso «≈», corsivo, e l’intestazione dice quale mese manca; file e invio solo novembre', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    // Rossi: 3 + 2 turni, 1 notte, 1 sabato, 1 + 1 domeniche e festivi, 1 reperibilità, 1 chiamata di 1 h 30.
    const rossi = [
      'turni',
      'notti',
      'sabati',
      'domeniche',
      'reperibilita',
      'chiamate',
      'durata',
    ].map((n) => testoDi(cella(radice, 'd1', n)));
    expect(rossi).toEqual(['≈5', '≈1', '≈1', '≈2', '≈1', '≈1', '≈1 h 30']);
    expect(cella(radice, 'd1', 'turni').classList.contains('italic')).toBe(true);
    expect(testoDi(cella(radice, 'd3', 'durata'))).toBe('—');
    expect(testoDi(totale(radice, 'turni'))).toBe('≈9');
    expect(testoDi(totale(radice, 'sabati'))).toBe('≈3');
    expect(testoDi(radice.querySelector('[data-provvisorio]') as Element)).toBe(
      'Provvisorio: dicembre non ancora convalidato',
    );
    expect(testoDi(radice.querySelector('[data-file-e-invio]') as Element)).toBe(
      'File e invio: solo novembre',
    );
    expect(testoDi(radice)).toContain('Provvisorio: calcolato con i mesi in bozza');
  });

  it('«Scarica Excel» e «Invia a tutti…» sono attivi con almeno un mese convalidato', async () => {
    const t = await montaReport(opzioni);
    expect((pulsante(t.radice(), 'Scarica Excel') as HTMLButtonElement).disabled).toBe(false);
    expect((pulsante(t.radice(), 'Invia a tutti…') as HTMLButtonElement).disabled).toBe(false);
  });

  it('senza mesi convalidati la tabella è provvisoria e i due pulsanti sono disabilitati con il motivo', async () => {
    const t = await montaReport({ mesi: () => mesiDel('bozza', 'bozza'), riepiloghi: RIEPILOGHI });
    const radice = t.radice();
    expect(testoDi(cella(radice, 'd2', 'turni'))).toBe('≈4');
    const scarica = pulsante(radice, 'Scarica Excel') as HTMLButtonElement;
    const invia = pulsante(radice, 'Invia a tutti…') as HTMLButtonElement;
    expect(scarica.disabled).toBe(true);
    expect(invia.disabled).toBe(true);
    const motivo = radice.querySelector('#motivo-azioni') as HTMLElement;
    expect(testoDi(motivo)).toBe(
      'Nessun mese convalidato: file e invio comprendono solo i mesi convalidati',
    );
    expect(scarica.getAttribute('aria-describedby')).toBe('motivo-azioni');
    expect(radice.querySelector('[data-file-e-invio]')).toBeNull();
    expect(testoDi(radice.querySelector('[data-provvisorio]') as Element)).toBe(
      'Provvisorio: novembre e dicembre non ancora convalidati',
    );
  });

  it('un mese non ancora creato conta come non convalidato e non compare nei dati', async () => {
    const t = await montaReport({
      mesi: () => mesiDel('convalidato', null),
      riepiloghi: RIEPILOGHI.filter((r) => r.chiaveMese === '2026-11'),
    });
    expect(testoDi(t.radice().querySelector('[data-provvisorio]') as Element)).toBe(
      'Provvisorio: dicembre non ancora convalidato',
    );
    expect(testoDi(cella(t.radice(), 'd1', 'turni'))).toBe('≈3');
  });

  it('nessun mese creato: stato vuoto e nessuna tabella', async () => {
    const t = await montaReport({ mesi: () => mesiDel(null, null) });
    expect(testoDi(t.radice())).toContain('Nessun mese pianificato in questo bimestre');
    expect(t.radice().querySelector('table')).toBeNull();
  });

  it('un dipendente non più in anagrafica compare come «Dipendente rimosso», in fondo', async () => {
    const t = await montaReport({
      mesi: () => mesiDel('convalidato', 'bozza'),
      riepiloghi: [...RIEPILOGHI, riepilogoReport('dX', '2026-11', { turniSvolti: 1 })],
    });
    const nomi = Array.from(t.radice().querySelectorAll('tbody th')).map(testoDi);
    expect(nomi[nomi.length - 1]).toBe('Dipendente rimosso');
  });
});

describe('Report: bimestre convalidato (dal documento)', () => {
  const documento = reportSalvato(NOV_DIC, {
    mesiInclusi: [chiaveMese('2026-11'), chiaveMese('2026-12')],
    righe: {
      d1: conteggi({
        turniSvolti: 6,
        notti: 2,
        domenicheEFestivi: 2,
        chiamate: 2,
        minutiChiamate: 150,
      }),
      d2: conteggi({ turniSvolti: 4 }),
      d3: conteggi({ turniSvolti: 5 }),
    },
    totali: conteggi({
      turniSvolti: 15,
      notti: 2,
      domenicheEFestivi: 2,
      chiamate: 2,
      minutiChiamate: 150,
    }),
    invii: {
      d1: {
        esito: 'accodato',
        ilMs: ISTANTE_INVIO,
        mailId: 'm1',
        mesiInclusi: [chiaveMese('2026-11'), chiaveMese('2026-12')],
      },
      d3: {
        esito: 'senzaEmail',
        ilMs: ISTANTE_INVIO,
        mailId: null,
        mesiInclusi: [chiaveMese('2026-11'), chiaveMese('2026-12')],
      },
    },
    inviato: true,
    ultimoInvioMs: ISTANTE_INVIO,
  });
  const opzioni = {
    oggi: '2027-01-08',
    url: '/reparti/r1/report?bimestre=2026-B6',
    mesi: () => mesiDel('convalidato', 'convalidato'),
    report: () => documento,
    riepiloghi: [],
  };

  it('usa i valori del documento, senza «≈» e senza intestazione di provvisorio', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    expect(testoDi(cella(radice, 'd1', 'turni'))).toBe('6');
    expect(testoDi(cella(radice, 'd1', 'durata'))).toBe('2 h 30');
    expect(cella(radice, 'd1', 'turni').classList.contains('italic')).toBe(false);
    expect(testoDi(totale(radice, 'turni'))).toBe('15');
    expect(radice.querySelector('[data-provvisorio]')).toBeNull();
    expect(radice.querySelector('[data-file-e-invio]')).toBeNull();
  });

  it('mostra lo stato dell’ultimo invio per ciascuno', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    expect(testoDi(cella(radice, 'd1', 'ultimo-invio'))).toMatch(
      /^accodato 06\/01\/2027 \d\d:\d\d$/,
    );
    expect(testoDi(cella(radice, 'd3', 'ultimo-invio'))).toBe('senza email');
    expect(testoDi(cella(radice, 'd2', 'ultimo-invio'))).toBe('—');
  });

  it('se il documento non comprende entrambi i mesi si somma dai riepiloghi', async () => {
    const t = await montaReport({
      ...opzioni,
      report: () => ({ ...documento, mesiInclusi: [chiaveMese('2026-11')] }),
      riepiloghi: RIEPILOGHI,
    });
    expect(testoDi(cella(t.radice(), 'd2', 'turni'))).toBe('4');
    expect(testoDi(cella(t.radice(), 'd1', 'turni'))).toBe('5');
  });

  it('con un errore di lettura mostra il messaggio e «riprova» rilegge', async () => {
    const t = await montaReport({ ...opzioni, letturaRiepiloghiFallisce: true });
    expect(testoDi(t.radice())).toContain('Impossibile caricare il report.');
    expect(t.radice().querySelector('table')).toBeNull();
  });

  it('le frecce cambiano il bimestre nell’URL, e non si va oltre quello in corso', async () => {
    const t = await montaReport({ ...opzioni, oggi: '2026-11-19' });
    const successivo = t
      .radice()
      .querySelector('[aria-label="Bimestre successivo"]') as HTMLButtonElement;
    expect(successivo.disabled).toBe(true);
    const precedente = t
      .radice()
      .querySelector('[aria-label="Bimestre precedente"]') as HTMLButtonElement;
    precedente.click();
    await t.assesta();
    expect(t.router.url).toContain('bimestre=2026-B5');
    expect(testoDi(t.radice().querySelector('[data-bimestre]') as Element)).toBe('set–ott 2026');
    expect(t.reportRepo.leggi).toHaveBeenLastCalledWith('r1', '2026-B5');
  });

  it('un bimestre nell’URL nel futuro o malformato ricade su quello in corso', async () => {
    const t = await montaReport({
      ...opzioni,
      oggi: '2026-11-19',
      url: '/reparti/r1/report?bimestre=2027-B3',
    });
    expect(testoDi(t.radice().querySelector('[data-bimestre]') as Element)).toBe('nov–dic 2026');
    await t.vai('/reparti/r1/report?bimestre=boh');
    expect(testoDi(t.radice().querySelector('[data-bimestre]') as Element)).toBe('nov–dic 2026');
  });
});

describe('Report: azioni del coordinatore', () => {
  const opzioni = {
    mesi: () => mesiDel('convalidato', 'convalidato'),
    riepiloghi: RIEPILOGHI,
    esiti: [
      { dipendenteId: 'd1', esito: 'accodato' as const },
      { dipendenteId: 'd2', esito: 'accodato' as const },
      { dipendenteId: 'd3', esito: 'senzaEmail' as const },
    ],
  };

  it('«Scarica Excel» chiede il file del bimestre e lo scarica', async () => {
    const t = await montaReport(opzioni);
    pulsante(t.radice(), 'Scarica Excel').click();
    await t.assesta();
    expect(t.funzioni.genera).toHaveBeenCalledWith({ repartoId: 'r1', idBimestre: NOV_DIC });
    expect(t.funzioni.scarica).toHaveBeenCalledWith('report-2026-B6-radiologia.xlsx', 'AAAA');
    expect(t.toast.messaggi().map((m) => m.testo)).toContain(
      'File scaricato: report-2026-B6-radiologia.xlsx',
    );
  });

  it('se il file non si genera dice «Impossibile generare il file.»', async () => {
    const t = await montaReport(opzioni);
    t.funzioni.genera.mockRejectedValueOnce(new Error('boom'));
    pulsante(t.radice(), 'Scarica Excel').click();
    await t.assesta();
    expect(t.funzioni.scarica).not.toHaveBeenCalled();
    expect(t.toast.messaggi().map((m) => m.testo)).toContain('Impossibile generare il file.');
  });

  it('«Invia a tutti…» controlla chi ha l’email, chiede conferma con i numeri e poi invia', async () => {
    const t = await montaReport(opzioni);
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.funzioni.invia).toHaveBeenNthCalledWith(1, {
      repartoId: 'r1',
      idBimestre: NOV_DIC,
      dipendenteIds: null,
      anteprima: true,
    });
    expect(t.dialoghi.conferma).toHaveBeenCalledTimes(1);
    expect(t.dialoghi.conferma).toHaveBeenCalledWith({
      titolo: 'Invia il report',
      messaggio: 'Invierai il report a 2 dipendenti con email. 1 non ha email e non lo riceverà.',
      etichettaConferma: 'Invia',
    });
    expect(t.funzioni.invia).toHaveBeenNthCalledWith(2, {
      repartoId: 'r1',
      idBimestre: NOV_DIC,
      dipendenteIds: null,
    });
    expect(t.toast.messaggi().map((m) => m.testo)).toContain(
      'Report accodato per 2 dipendenti · 1 senza email.',
    );
  });

  it('se il report è già stato inviato la conferma lo dice (review 4.1, rilievo 5)', async () => {
    const t = await montaReport({
      ...opzioni,
      report: () =>
        reportSalvato(NOV_DIC, {
          righe: {},
          totali: conteggi({}),
          ultimoInvioMs: ISTANTE_INVIO,
          inviato: true,
        }),
    });
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.dialoghi.conferma.mock.calls[0]?.[0].messaggio).toMatch(
      /^Invierai il report a 2 dipendenti con email\. 1 non ha email e non lo riceverà\. Il report è già stato inviato il \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}: chi lo ha ricevuto ne riceverà un altro\.$/,
    );
  });

  it('se si annulla la conferma non si invia nulla', async () => {
    const t = await montaReport({ ...opzioni, dialogoConferma: false });
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.funzioni.invia).toHaveBeenCalledTimes(1);
    expect(t.toast.messaggi()).toHaveLength(0);
  });

  it('con un mese ancora in bozza la conferma dice che l’invio comprende solo quelli convalidati', async () => {
    const t = await montaReport({ ...opzioni, mesi: () => mesiDel('convalidato', 'bozza') });
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.dialoghi.conferma.mock.calls[0]?.[0].messaggio).toContain(
      'Il report comprende solo novembre, gli altri mesi non sono ancora convalidati.',
    );
  });

  it('se nessuno ha un indirizzo email lo dice e non chiede conferma', async () => {
    const t = await montaReport({
      ...opzioni,
      esiti: [
        { dipendenteId: 'd1', esito: 'senzaEmail' },
        { dipendenteId: 'd2', esito: 'senzaEmail' },
      ],
    });
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.dialoghi.conferma).not.toHaveBeenCalled();
    expect(t.funzioni.invia).toHaveBeenCalledTimes(1);
    expect(t.toast.messaggi().map((m) => m.testo)).toContain(
      'Nessun dipendente ha un indirizzo email: non c’è nessuno a cui inviare il report.',
    );
  });

  it('un errore del controllo degli indirizzi lo dice e non apre la conferma', async () => {
    const t = await montaReport(opzioni);
    t.funzioni.invia.mockRejectedValueOnce(new Error('boom'));
    pulsante(t.radice(), 'Invia a tutti…').click();
    await t.assesta();
    expect(t.dialoghi.conferma).not.toHaveBeenCalled();
    expect(t.toast.messaggi().map((m) => m.testo)).toContain(
      'Impossibile controllare gli indirizzi: riprova.',
    );
  });

  it('«Reinvia» su una riga chiede una conferma breve e invia a quel solo dipendente', async () => {
    const t = await montaReport(opzioni);
    (riga(t.radice(), 'd2').querySelector('button') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.dialoghi.conferma).toHaveBeenCalledWith({
      titolo: 'Reinvia il report',
      messaggio: 'Reinviare il report a Bianchi Laura?',
      etichettaConferma: 'Reinvia',
    });
    expect(t.funzioni.invia).toHaveBeenCalledWith({
      repartoId: 'r1',
      idBimestre: NOV_DIC,
      dipendenteIds: ['d2'],
    });
    expect(t.toast.messaggi().map((m) => m.testo)).toContain('Report accodato per Bianchi Laura.');
  });

  it('il reinvio a chi non ha email e quello andato male sono segnalati', async () => {
    const t = await montaReport(opzioni);
    (riga(t.radice(), 'd3').querySelector('button') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.toast.messaggi().map((m) => m.testo)).toContain(
      'Verdi Anna non ha un indirizzo email.',
    );
    t.funzioni.invia.mockRejectedValueOnce(new Error('boom'));
    (riga(t.radice(), 'd1').querySelector('button') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.toast.messaggi().map((m) => m.testo)).toContain('Invio non riuscito: riprova.');
  });

  it('dopo ogni operazione rilegge il documento del report (esiti e data)', async () => {
    const t = await montaReport(opzioni);
    const prima = t.reportRepo.leggi.mock.calls.length;
    pulsante(t.radice(), 'Scarica Excel').click();
    await t.assesta();
    expect(t.reportRepo.leggi.mock.calls.length).toBe(prima + 1);
  });
});

describe('Report: ADMIN (sola consultazione)', () => {
  const opzioni = {
    ruolo: 'ADMIN' as const,
    mesi: () => mesiDel('convalidato', 'convalidato'),
    riepiloghi: RIEPILOGHI,
  };

  it('vede la tabella e scarica il file, ma non ha «Invia a tutti…», «Reinvia» né la colonna delle azioni', async () => {
    const t = await montaReport(opzioni);
    const radice = t.radice();
    expect(testoDi(cella(radice, 'd1', 'turni'))).toBe('5');
    expect(testoDi(radice)).toContain('Scarica Excel');
    expect(testoDi(radice)).not.toContain('Invia a tutti');
    expect(testoDi(radice)).not.toContain('Reinvia');
    expect(Array.from(radice.querySelectorAll('thead th')).map(testoDi)).not.toContain('Azioni');
    expect(testoDi(radice)).toContain('Sola consultazione');
    pulsante(radice, 'Scarica Excel').click();
    await t.assesta();
    expect(t.funzioni.genera).toHaveBeenCalledTimes(1);
    expect(t.funzioni.invia).not.toHaveBeenCalled();
  });
});

describe('Report: stati della pagina', () => {
  it('reparto non disponibile', async () => {
    const t = await montaReport({ reparto: null });
    expect(testoDi(t.radice())).toContain('Reparto non disponibile.');
  });
});

describe('Report: scheda «Festività dell’anno»', () => {
  const lavorata = (idFestivita: string, giorno: string, codice: string) => ({
    idFestivita,
    giorno: giorno as '01',
    codice: codiceTurno(codice),
  });
  const riepiloghiAnno = [
    {
      dipendenteId: 'd1',
      chiaveMese: chiaveMese('2026-01'),
      anno: 2026,
      statoMese: 'convalidato' as const,
      festivitaLavorate: [lavorata('capodanno', '01', 'M1')],
    },
    {
      dipendenteId: 'd1',
      chiaveMese: chiaveMese('2026-11'),
      anno: 2026,
      statoMese: 'bozza' as const,
      festivitaLavorate: [lavorata('ognissanti', '01', 'N1')],
    },
    {
      dipendenteId: 'd2',
      chiaveMese: chiaveMese('2026-12'),
      anno: 2026,
      statoMese: 'bozza' as const,
      festivitaLavorate: [lavorata('natale', '25', 'P1'), lavorata('santo-stefano', '26', 'M1')],
    },
  ];

  it('righe = dipendenti, colonne = festività dell’anno con il codice del turno, ultima colonna il totale', async () => {
    const t = await montaReport({
      url: '/reparti/r1/report?scheda=festivita&anno=2026',
      riepiloghiAnno,
    });
    const radice = t.radice();
    expect(t.riepiloghiRepo.perAnno).toHaveBeenCalledWith('r1', 2026);
    expect(t.riepiloghiRepo.perReport).not.toHaveBeenCalled();
    expect(testoDi(radice.querySelector('[data-anno]') as Element)).toBe('2026');
    const colonne = Array.from(radice.querySelectorAll('thead th')).map(testoDi);
    expect(colonne[0]).toBe('Dipendente');
    expect(colonne[1]).toBe('Capodanno01/01');
    expect(colonne).toContain('Natale25/12');
    expect(colonne[colonne.length - 1]).toBe('Totale');
    const codiceDi = (id: string, festivita: string): string =>
      testoDi(riga(radice, id).querySelector(`[data-festivita="${festivita}"]`) as Element);
    expect(codiceDi('d1', 'capodanno')).toBe('M1');
    expect(codiceDi('d1', 'ognissanti')).toBe('N1');
    expect(codiceDi('d1', 'natale')).toBe('—non lavorata');
    expect(codiceDi('d2', 'natale')).toBe('P1');
    expect(codiceDi('d2', 'santo-stefano')).toBe('M1');
    expect(testoDi(riga(radice, 'd1').querySelector('[data-totale]') as Element)).toBe('2');
    expect(testoDi(riga(radice, 'd2').querySelector('[data-totale]') as Element)).toBe('2');
    expect(testoDi(riga(radice, 'd3').querySelector('[data-totale]') as Element)).toBe('0');
  });

  it('avverte che comprende anche i mesi in bozza; con tutti convalidati non lo dice', async () => {
    const con = await montaReport({
      url: '/reparti/r1/report?scheda=festivita&anno=2026',
      riepiloghiAnno,
    });
    expect(con.radice().querySelector('[data-con-bozza]')).not.toBeNull();
    const senza = await montaReport({
      url: '/reparti/r1/report?scheda=festivita&anno=2026',
      riepiloghiAnno: riepiloghiAnno.slice(0, 1),
    });
    expect(senza.radice().querySelector('[data-con-bozza]')).toBeNull();
  });

  it('il selettore dell’anno cambia l’URL e rilegge; si passa da una scheda all’altra con i link', async () => {
    const t = await montaReport({
      url: '/reparti/r1/report?scheda=festivita&anno=2026',
      riepiloghiAnno,
    });
    (t.radice().querySelector('[aria-label="Anno precedente"]') as HTMLButtonElement).click();
    await t.assesta();
    expect(t.router.url).toContain('anno=2025');
    expect(t.riepiloghiRepo.perAnno).toHaveBeenLastCalledWith('r1', 2025);
    (t.radice().querySelector('[data-scheda="bimestre"]') as HTMLElement).click();
    await t.assesta();
    expect(t.router.url).toContain('scheda=bimestre');
    expect(t.radice().querySelector('[data-bimestre]')).not.toBeNull();
  });

  it('errore di lettura: messaggio con «riprova»', async () => {
    const t = await montaReport({
      url: '/reparti/r1/report?scheda=festivita&anno=2026',
      letturaRiepiloghiFallisce: true,
    });
    expect(testoDi(t.radice())).toContain('Impossibile caricare le festività dell’anno.');
  });
});
