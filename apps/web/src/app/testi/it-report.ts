// Testi della pagina Report (UX §7.10), di Report di tutti i reparti e dell'avviso «report non inviato» della Home. File
// di pagina pigra: lo importano solo le pagine Report e Home (CLAUDE.md, «Testi dell'interfaccia»). Le voci di menu e
// i titoli di rotta restano in `it.ts`.
function elencoMesi(mesi: readonly string[]): string {
  return mesi.length <= 1
    ? (mesi[0] ?? '')
    : `${mesi.slice(0, -1).join(', ')} e ${mesi[mesi.length - 1] ?? ''}`;
}

export const testiReport = {
  titolo: 'Report',
  titoloReparto: (reparto: string): string => `${reparto} › Report`,
  titoloTutti: 'Report di tutti i reparti',
  nonDisponibile: 'Reparto non disponibile.',
  schede: {
    etichetta: 'Tipo di report',
    bimestre: 'Bimestre',
    festivita: 'Festività dell’anno',
  },
  bimestre: {
    etichetta: 'Bimestre',
    precedente: 'Bimestre precedente',
    successivo: 'Bimestre successivo',
  },
  anno: { etichetta: 'Anno', precedente: 'Anno precedente', successivo: 'Anno successivo' },
  colonne: {
    dipendente: 'Dipendente',
    turni: 'Turni svolti',
    notti: 'di cui notti',
    sabati: 'di cui sabati',
    domeniche: 'di cui domeniche e festivi',
    reperibilita: 'Reperibilità svolte',
    chiamate: 'Chiamate',
    durata: 'Durata chiamate',
    oreDovute: 'Ore dovute',
    oreLavorate: 'Ore lavorate',
    saldoBimestre: 'Saldo bimestre',
    saldoAnno: 'Saldo da inizio anno',
    ultimoInvio: 'Ultimo invio',
    azioni: 'Azioni',
    totale: 'Totale',
  },
  tabella: (periodo: string): string =>
    `Report ${periodo}: turni, reperibilità, chiamate e ore per dipendente`,
  provvisorio: (mesi: readonly string[]): string =>
    `Provvisorio: ${elencoMesi(mesi)} non ${mesi.length === 1 ? 'ancora convalidato' : 'ancora convalidati'}`,
  provvisorioSuggerimento:
    'Provvisorio: calcolato con i mesi in bozza, può cambiare finché non sono convalidati',
  fileEInvio: (mesi: readonly string[]): string => `File e invio: solo ${elencoMesi(mesi)}`,
  scaricaExcel: 'Scarica Excel',
  inviaATutti: 'Invia a tutti…',
  reinvia: 'Reinvia',
  reinviaA: (nome: string): string => `Reinvia il report a ${nome}`,
  nessunMeseConvalidato:
    'Nessun mese convalidato: file e invio comprendono solo i mesi convalidati',
  soloConsultazione: 'Sola consultazione: il file si scarica, l’invio è del coordinatore',
  nessunMese: 'Nessun mese pianificato in questo bimestre',
  nessunDipendente: 'Nessun dipendente da mostrare',
  errore: 'Impossibile caricare il report.',
  erroreFile: 'Impossibile generare il file.',
  fileScaricato: (nomeFile: string): string => `File scaricato: ${nomeFile}`,
  generazione: 'Generazione del file…',
  controlloIndirizzi: 'Controllo degli indirizzi…',
  invio: {
    nessunIndirizzo:
      'Nessun dipendente ha un indirizzo email: non c’è nessuno a cui inviare il report.',
    erroreAnteprima: 'Impossibile controllare gli indirizzi: riprova.',
    titolo: 'Invia il report',
    conferma: (conEmail: number, senzaEmail: number): string => {
      const primo =
        conEmail === 1
          ? 'Invierai il report a 1 dipendente con email.'
          : `Invierai il report a ${conEmail} dipendenti con email.`;
      const secondo =
        senzaEmail === 0
          ? ''
          : senzaEmail === 1
            ? ' 1 non ha email e non lo riceverà.'
            : ` ${senzaEmail} non hanno email e non lo riceveranno.`;
      return `${primo}${secondo}`;
    },
    solo: (mesi: readonly string[]): string =>
      ` Il report comprende solo ${elencoMesi(mesi)}, gli altri mesi non sono ancora convalidati.`,
    giaInviato: (data: string): string =>
      ` Il report è già stato inviato il ${data}: chi lo ha ricevuto ne riceverà un altro.`,
    azione: 'Invia',
    titoloSingolo: 'Reinvia il report',
    confermaSingolo: (nome: string): string => `Reinviare il report a ${nome}?`,
    azioneSingolo: 'Reinvia',
    esitoTutti: (accodati: number, senzaEmail: number, errori: number): string => {
      const parti = [
        accodati === 1
          ? 'Report accodato per 1 dipendente'
          : `Report accodato per ${accodati} dipendenti`,
      ];
      if (senzaEmail > 0) {
        parti.push(senzaEmail === 1 ? '1 senza email' : `${senzaEmail} senza email`);
      }
      if (errori > 0) {
        parti.push(errori === 1 ? '1 invio non riuscito' : `${errori} invii non riusciti`);
      }
      return `${parti.join(' · ')}.`;
    },
    esitoSingolo: {
      accodato: (nome: string): string => `Report accodato per ${nome}.`,
      senzaEmail: (nome: string): string => `${nome} non ha un indirizzo email.`,
      errore: (nome: string): string => `Invio non riuscito per ${nome}: riprova.`,
    },
    erroreInvio: 'Invio non riuscito: riprova.',
  },
  ultimoInvio: {
    nessuno: '—',
    accodato: (data: string): string => `accodato ${data}`,
    senzaEmail: 'senza email',
    errore: 'errore: riprova',
  },
  festivita: {
    titolo: 'Festività dell’anno',
    tabella: (anno: number): string => `Festività lavorate nel ${anno} per dipendente`,
    colonnaTotale: 'Festività lavorate',
    nessuna: 'Nessuna festività lavorata in questo anno',
    nonLavorata: 'non lavorata',
    nonPiuInElenco: 'non più in elenco',
    festivitaRimossa: 'Festività non più in elenco',
    conBozza:
      'Comprende anche i mesi ancora in bozza: i valori possono cambiare fino alla convalida.',
    errore: 'Impossibile caricare le festività dell’anno.',
    legenda:
      'Ogni cella riporta i codici dei turni lavorati nella festività; — se non l’ha lavorata. L’ultima colonna conta le festività distinte lavorate, non i turni.',
  },
  tutti: {
    descrizione:
      'Reparti raggruppati per coordinatore: stato del report del bimestre, file Excel e apertura del reparto.',
    bimestre: 'Bimestre',
    reparto: 'Reparto',
    stato: 'Stato del report',
    nessunReparto: 'Nessun reparto ancora creato dai coordinatori',
    gruppo: (coordinatore: string, reparti: number): string =>
      `${coordinatore} · ${reparti === 1 ? '1 reparto' : `${reparti} reparti`}`,
    disattivato: 'Disattivato',
    inviato: (data: string): string => `inviato il ${data}`,
    generato: (data: string): string => `generato il ${data}, non inviato`,
    nonGenerato: 'non generato',
    nonLeggibile: 'stato non leggibile',
    apri: 'Apri',
    apriReparto: (reparto: string): string => `Apri il report di ${reparto}`,
    scarica: 'Scarica Excel',
    scaricaReparto: (reparto: string): string => `Scarica il file Excel di ${reparto}`,
    nessunMeseConvalidato: 'Nessun mese convalidato in questo bimestre.',
    errore: 'Impossibile caricare i report dei reparti.',
    coordinatoreSconosciuto: 'Coordinatore sconosciuto',
    elenco: 'Elenco dei reparti',
  },
  home: {
    nonInviato: (reparto: string, bimestre: string): string =>
      `${reparto} · Report ${bimestre} non inviato`,
    meseNonConvalidato: (reparto: string, bimestre: string, mesi: readonly string[]): string =>
      `${reparto} · Report ${bimestre} non inviato: ${elencoMesi(mesi)} ${mesi.length === 1 ? 'non convalidato' : 'non convalidati'}`,
    apri: (reparto: string, bimestre: string): string => `Apri il report ${bimestre} di ${reparto}`,
  },
} as const;
