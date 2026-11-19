// Testi della pagina Dettaglio del dipendente (UX §7.9). File della pagina pigra (CLAUDE.md, «Testi dell'interfaccia»).
export const testiDettaglioDipendente = {
  titolo: 'Dettaglio del dipendente',
  tornaAllaBancaOre: 'Banca ore',
  errore: 'Impossibile caricare il dettaglio.',
  nonTrovato: 'Dipendente non trovato.',
  sottotitolo: (ore: string, assunzione: string | null): string =>
    assunzione === null
      ? `${ore} h settimanali`
      : `${ore} h settimanali · in servizio dal ${assunzione}`,
  anagrafica: 'Anagrafica',
  riporto: (annoPrecedente: number, saldo: string): string =>
    `Riporto dal ${annoPrecedente}: ${saldo} h`,
  saldoAnno: (anno: number, saldo: string, provvisorio: boolean): string =>
    `Saldo ${anno}: ${provvisorio ? '≈ ' : ''}${saldo} h${provvisorio ? ' (provvisorio)' : ''}`,
  diCuiDefinitivo: (saldo: string): string => `di cui definitivo: ${saldo} h`,
  oreMese: 'Ore per mese',
  colonne: {
    mese: 'Mese',
    dovute: 'Dovute',
    lavorate: 'Lavorate',
    saldo: 'Saldo',
    stato: 'Stato',
    data: 'Data',
    turno: 'Turno',
    previsto: 'Previsto',
    reale: 'Reale',
    differenza: 'Differenza',
    codice: 'Codice',
    descrizione: 'Descrizione',
    totaleGiorni: 'Totale giorni',
  },
  statoConvalidato: 'convalidato',
  statoBozza: 'bozza',
  statoEscluso: 'escluso: dati non validi',
  statoNonCreato: 'non creato',
  variazioni: 'Variazioni di orario',
  nessunaVariazione: 'Nessuna variazione di orario nell’anno',
  assenze: 'Assenze per tipologia',
  nessunaAssenza: 'Nessuna assenza nell’anno',
  anno: 'Anno',
  annoPrecedente: 'Anno precedente',
  annoSuccessivo: 'Anno successivo',
} as const;
