import {
  rottaDelReparto,
  rottaDiAtterraggio,
  rottaRichiestaValida,
  type InputAtterraggio,
} from './atterraggio';

const MESE = '2026-11';

function input(parziale: Partial<InputAtterraggio>): InputAtterraggio {
  return {
    ruolo: 'COORDINATORE',
    rottaRichiesta: null,
    reparti: [],
    ultimoRepartoId: null,
    meseCorrente: MESE,
    ...parziale,
  };
}

describe('rottaDiAtterraggio (U1, UX §2)', () => {
  const completato = { id: 'r1', passo: 'completata' } as const;
  const altro = { id: 'r2', passo: 'completata' } as const;

  it.each([
    {
      caso: '1. accesso partito da una rotta protetta: si torna lì',
      i: input({ rottaRichiesta: '/reparti/r9/banca-ore', reparti: [completato] }),
      atteso: '/reparti/r9/banca-ore',
    },
    {
      caso: '1. vale anche per l’ADMIN',
      i: input({ ruolo: 'ADMIN', rottaRichiesta: '/utenti' }),
      atteso: '/utenti',
    },
    { caso: '2. ADMIN → Home', i: input({ ruolo: 'ADMIN' }), atteso: '/home' },
    { caso: '3. COORD senza reparti → Home', i: input({ reparti: [] }), atteso: '/home' },
    {
      caso: '4. unico reparto con configurazione ai turni → passo 2',
      i: input({ reparti: [{ id: 'r1', passo: 'turni' }] }),
      atteso: '/reparti/r1/configurazione',
    },
    {
      caso: '4. ultimo reparto usato con configurazione ai dipendenti → passo 3',
      i: input({
        reparti: [completato, { id: 'r2', passo: 'dipendenti' }],
        ultimoRepartoId: 'r2',
      }),
      atteso: '/reparti/r2/dipendenti',
    },
    {
      caso: '5. un solo reparto → mese corrente',
      i: input({ reparti: [completato] }),
      atteso: '/reparti/r1/mesi/2026-11',
    },
    {
      caso: '5. più reparti e ultimo reparto memorizzato → mese corrente di quello',
      i: input({ reparti: [completato, altro], ultimoRepartoId: 'r2' }),
      atteso: '/reparti/r2/mesi/2026-11',
    },
    {
      caso: '6. più reparti e nessun ultimo reparto → Home',
      i: input({ reparti: [completato, altro] }),
      atteso: '/home',
    },
    {
      caso: '6. l’ultimo reparto memorizzato non esiste più → Home',
      i: input({ reparti: [completato, altro], ultimoRepartoId: 'rimosso' }),
      atteso: '/home',
    },
    {
      caso: 'ultimo reparto non più visibile ma un solo reparto → quello',
      i: input({ reparti: [altro], ultimoRepartoId: 'rimosso' }),
      atteso: '/reparti/r2/mesi/2026-11',
    },
  ])('$caso', ({ i, atteso }) => {
    expect(rottaDiAtterraggio(i)).toBe(atteso);
  });

  it('rottaDelReparto segue il passo della creazione guidata', () => {
    expect(rottaDelReparto({ id: 'x', passo: 'turni' }, MESE)).toBe('/reparti/x/configurazione');
    expect(rottaDelReparto({ id: 'x', passo: 'dipendenti' }, MESE)).toBe('/reparti/x/dipendenti');
    expect(rottaDelReparto({ id: 'x', passo: 'completata' }, MESE)).toBe('/reparti/x/mesi/2026-11');
  });
});

describe('rottaRichiestaValida', () => {
  it.each(['/utenti', '/reparti/r1/mesi/2026-11', '/home?x=1', '/report?bimestre=2026-B6'])(
    'accetta %s',
    (rotta) => {
      expect(rottaRichiestaValida(rotta)).toBe(rotta);
    },
  );

  it.each([
    null,
    undefined,
    '',
    '/',
    '/accesso',
    '/accesso?ritorno=/utenti',
    '//esempio.it',
    'https://esempio.it/x',
    'javascript:alert(1)',
    '/\\esempio.it',
    '/utenti\nX',
    'utenti',
  ])('rifiuta %j (reindirizzamento aperto o ciclo)', (rotta) => {
    expect(rottaRichiestaValida(rotta)).toBeNull();
  });
});
