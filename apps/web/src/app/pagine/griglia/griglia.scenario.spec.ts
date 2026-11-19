// Percorso completo dello step 3.2 (PIANO 3.2 criterio 8, nella forma dei test di componente): lo scenario di
// ottobre 2026 dello step 3.1a fatto dalla pagina vera — malattia su tre giorni, uscita alle 14:30, sostituto,
// notte attraverso il cambio d'ora — poi le righe che «Salva bozza» scrive vanno a `calcolaRiepilogo()` e a
// `bancaOreAnno()` del dominio. I saldi sono quelli dello scenario di `packages/domain` (−768 e +516, banca ore
// di Rossi con riporto +600: −168 provvisorio, 600 definitivo).
import {
  bancaOreAnno,
  calcolaRiepilogo,
  cellaVuota,
  chiaveMese,
  codiceAssenza,
  oraLocale,
  type CellaDoc,
  type ChiaveGiorno,
} from '@turni/domain';
import {
  apriMenu,
  clic,
  scegliVoce,
  scrivi,
  selezionaGiorni,
  type Montata,
} from '../../test/azioni-griglia';
import {
  DIPENDENTI,
  cellaConTurno,
  mese,
  montaGriglia,
  pulsante,
  rigaSalvata,
} from '../../test/monta-griglia';

const ROSSI = 'd1';
const BIANCHI = 'd2';
const OTTOBRE = chiaveMese('2026-10');

const FERIALI: readonly ChiaveGiorno[] = [
  '01',
  '02',
  '05',
  '06',
  '07',
  '08',
  '09',
  '12',
  '13',
  '14',
  '15',
  '16',
  '19',
  '20',
  '21',
  '22',
  '23',
  '26',
  '27',
  '28',
  '29',
  '30',
];

const RIPOSO: CellaDoc = {
  ...cellaVuota(),
  assenza: { codice: codiceAssenza('R'), effetto: 'comeRiposo', malattia: false },
};

/** La pianificazione di partenza: Rossi M1 in tutti i feriali; Bianchi P1 salvo riposo il 13 e il 14, N1 il 24. */
function pianificazione() {
  const rossi: Partial<Record<ChiaveGiorno, CellaDoc>> = {};
  const bianchi: Partial<Record<ChiaveGiorno, CellaDoc>> = {};
  for (const giorno of FERIALI) {
    rossi[giorno] = cellaConTurno('M1');
    bianchi[giorno] = giorno === '13' || giorno === '14' ? RIPOSO : cellaConTurno('P1');
  }
  bianchi['24'] = cellaConTurno('N1');
  return DIPENDENTI.map((d) =>
    rigaSalvata(d.id, d.id === ROSSI ? rossi : d.id === BIANCHI ? bianchi : {}),
  );
}

const campoOra = (t: Montata, quale: 0 | 1): HTMLInputElement =>
  t
    .radice()
    .querySelectorAll<HTMLInputElement>('app-pannello-turno input[type="time"]')
    .item(quale);

async function uscitaReale(t: Montata, id: string, giorno: string, uscita: string): Promise<void> {
  await clic(t, id, giorno);
  await apriMenu(t, id, giorno);
  await scegliVoce(t, 'Dettaglio turno');
  await scrivi(t, campoOra(t, 1), uscita);
  pulsante(t.radice().querySelector('app-pannello-turno') as HTMLElement, 'Applica').click();
  await t.assesta();
}

describe('Scenario di ottobre 2026 dalla pagina (3.1a, 3.1b, 3.2)', () => {
  it('malattia 13-15, uscita 14:30 il 5, sostituto il 14, notte del cambio d’ora: saldi −768 e +516', async () => {
    const t = await montaGriglia({
      url: '/reparti/r1/mesi/2026-10',
      righe: { '2026-10': pianificazione() },
    });

    // 1. Malattia di tre giorni: i turni restano come scoperti.
    await selezionaGiorni(t, ROSSI, 13, 15);
    await apriMenu(t, ROSSI, '15');
    await scegliVoce(t, 'MA');
    // 2. Lunedì 5 esce alle 14:30.
    await uscitaReale(t, ROSSI, '05', '14:30');
    // 3. Mercoledì 14 il turno scoperto lo prende Bianchi, che aveva il riposo.
    await clic(t, ROSSI, '14');
    await apriMenu(t, ROSSI, '14');
    await scegliVoce(t, 'Trova sostituto');
    const riga = t.radice().querySelector(`[data-candidato="${BIANCHI}"]`) as HTMLElement;
    pulsante(riga, 'Assegna').click();
    await t.assesta();
    // 4. La notte del 24 esce alle 07:30 del 25 (22:00 CEST → 07:30 CET: 10 h 30).
    await uscitaReale(t, BIANCHI, '24', '07:30');

    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi.length).toBe(1);
    const salvate = new Map((t.salvataggi[0]?.righe ?? []).map((r) => [r.dipendenteId, r]));
    expect([...salvate.keys()].sort()).toEqual([ROSSI, BIANCHI]);

    const calendario = mese('2026-10').calendario;
    const riepilogo = (id: string) => {
      const r = salvate.get(id);
      if (r === undefined) {
        throw new Error(`Riga ${id} non salvata`);
      }
      return calcolaRiepilogo({
        riga: { dipendenteId: id, contratto: r.contratto, giorni: r.giorni },
        chiaveMese: OTTOBRE,
        statoMese: 'bozza',
        calendario,
        righeAdiacenti: { precedente: null, successiva: null },
      });
    };
    const rossi = riepilogo(ROSSI);
    const bianchi = riepilogo(BIANCHI);
    expect(rossi.valida).toBe(true);
    expect(bianchi.valida).toBe(true);

    // Rossi: 19 × 390 + 30 = 7440 lavorate; (22 − 3) × 432 = 8208 dovute; saldo −768.
    expect(rossi.minutiLavorati).toBe(7440);
    expect(rossi.minutiDovuti).toBe(8208);
    expect(rossi.saldoMinuti).toBe(-768);
    expect(rossi.variazioni).toBe(1);
    expect(rossi.minutiVariazioni).toBe(30);
    // Bianchi: 20 × 450 + 390 + 630 = 10020 lavorate; 22 × 432 = 9504 dovute; saldo +516.
    expect(bianchi.minutiLavorati).toBe(10020);
    expect(bianchi.minutiDovuti).toBe(9504);
    expect(bianchi.saldoMinuti).toBe(516);
    expect(bianchi.variazioni).toBe(1);
    expect(bianchi.minutiVariazioni).toBe(30);

    // La banca ore di Rossi con un riporto di +600: in bozza −168 (definitivo 600), poi −168 convalidata.
    const banca = bancaOreAnno({
      dipendenteId: ROSSI,
      anno: 2026,
      riporto: { minuti: 600, provvisorio: false },
      riepiloghi: [{ ...rossi, statoMese: 'bozza' }],
    });
    expect(banca).toMatchObject({
      saldoAnnoMinuti: -168,
      saldoDefinitivoMinuti: 600,
      provvisorio: true,
    });
    const definitiva = bancaOreAnno({
      dipendenteId: ROSSI,
      anno: 2026,
      riporto: { minuti: 600, provvisorio: false },
      riepiloghi: [{ ...rossi, statoMese: 'convalidato' }],
    });
    expect(definitiva).toMatchObject({ saldoAnnoMinuti: -168, saldoDefinitivoMinuti: -168 });

    // Le righe scritte hanno i riferimenti reciproci della sostituzione e gli orari reali.
    expect(salvate.get(ROSSI)?.giorni['14']?.copertoDa).toBe(BIANCHI);
    expect(salvate.get(BIANCHI)?.giorni['14']?.sostituisce).toBe(ROSSI);
    expect(salvate.get(ROSSI)?.giorni['05']?.orarioReale).toEqual({
      inizio: oraLocale('07:00'),
      fine: oraLocale('14:30'),
    });
    expect(salvate.get(BIANCHI)?.giorni['24']?.orarioReale).toEqual({
      inizio: oraLocale('22:00'),
      fine: oraLocale('07:30'),
    });
  });
});
