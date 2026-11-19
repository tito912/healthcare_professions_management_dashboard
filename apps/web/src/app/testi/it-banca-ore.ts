// Testi della pagina Banca ore (UX §7.8). File della pagina pigra (CLAUDE.md, «Testi dell'interfaccia»); i mesi brevi,
// condivisi con il dettaglio del dipendente, stanno in `it.ts` (`mesiBrevi`).
export const testiBancaOre = {
  titolo: 'Banca ore',
  titoloReparto: (reparto: string): string => `${reparto} › Banca ore`,
  errore: 'Impossibile caricare la banca ore.',
  nonDisponibile: 'Reparto non disponibile.',
  anno: 'Anno',
  annoPrecedente: 'Anno precedente',
  annoSuccessivo: 'Anno successivo',
  ricerca: 'Cerca per nome',
  tabella: (anno: number): string => `Banca ore ${anno}: saldi in ore per dipendente e mese`,
  dipendente: 'Dipendente',
  riporto: 'Riporto',
  totale: (anno: number): string => `Totale ${anno}`,
  legenda:
    'Legenda: + credito  − debito  ≈ provvisorio (mese in bozza)  — mese non creato. Valori in ore. Il totale comprende il riporto.',
  provvisorio: 'Provvisorio: il mese non è ancora convalidato',
  totaleProvvisorio:
    'Provvisorio: un mese non è convalidato o ha dati non validi, oppure il riporto è provvisorio',
  nessunDipendente: 'Nessun dipendente da mostrare per questo anno',
  nessunRisultato: 'Nessun dipendente corrisponde alla ricerca',
  apriDettaglio: (nome: string): string => `Apri il dettaglio di ${nome}`,
  saldoMese: (mese: string, saldo: string, provvisorio: boolean): string =>
    `${mese}: ${provvisorio ? 'provvisorio ' : ''}${saldo} ore`,
  meseNonCreato: 'mese non creato',
} as const;
