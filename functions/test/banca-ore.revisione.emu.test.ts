// Review dello step 3.1b, rilievo 1 (docs/review/3.1b.md): la propagazione del riporto agli anni successivi si
// ferma quando l'anno di partenza non cambia, quindi un evento ritentato dopo un guasto a metà propagazione non
// ripara l'anno dopo. Sequenza reale: `ricalcolaAnno(2026)` scrive il nuovo saldo, la transazione di 2027 fallisce
// (errore transitorio, contesa), il trigger lancia e l'evento è riconsegnato (`retry: true`); alla riconsegna 2026
// è già aggiornato (`scritto: false`) e il ciclo si ferma: 2027 resta con il riporto vecchio finché qualcosa non
// cambia di nuovo il saldo del 2026. Qui lo stato dopo il guasto si prepara con l'Admin SDK (nessun trigger su
// `riepiloghi` né su `bancaOre`), poi si chiama `ricalcolaBancaOre` come farebbe la riconsegna.
// Il secondo caso è il controllo: con l'anno di partenza che cambia, il riporto si propaga (passa già oggi).
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ricalcolaBancaOre } from '../src/mesi/banca-ore';
import { adminDiProva, svuotaEmulatori } from './emulatori';

const admin = adminDiProva();
const ORA = Timestamp.fromMillis(0);
const rif = (percorso: string) => admin.db.doc(`reparti/repRev/${percorso}`);

const riepilogoNovembre = (saldoMinuti: number) => ({
  dipendenteId: 'dipA',
  chiaveMese: '2026-11',
  minutiLavorati: 432 + saldoMinuti,
  minutiDovuti: 432,
  saldoMinuti,
  statoMese: 'convalidato',
  valida: true,
});

/** La banca ore 2027 come l'aveva scritta un ricalcolo precedente, con il riporto di allora. */
const bancaGennaio = (riportoMinuti: number) => ({
  dipendenteId: 'dipA',
  anno: 2027,
  riportoMinuti,
  mesi: {},
  saldoAnnoMinuti: riportoMinuti,
  saldoDefinitivoMinuti: riportoMinuti,
  provvisorio: false,
  calcolatoIl: ORA,
});

beforeEach(async () => {
  await svuotaEmulatori();
  // Come in consuntivo.emu.test.ts: i trigger delle cancellazioni del file precedente arrivano in ritardo.
  await new Promise((risolvi) => setTimeout(risolvi, 1500));
});

afterAll(async () => {
  await admin.chiudi();
});

describe('review 3.1b: propagazione del riporto dopo una riconsegna', () => {
  it('l’anno dopo rimasto indietro si allinea alla riconsegna dell’evento, anche se l’anno di partenza non cambia', async () => {
    // Il 2026 è già stato ricalcolato con il nuovo saldo (+600) prima del guasto.
    await rif('riepiloghi/2026-11_dipA').set(riepilogoNovembre(600));
    await ricalcolaBancaOre('repRev', 'dipA', 2026);
    expect((await rif('bancaOre/2026_dipA').get()).get('saldoAnnoMinuti')).toBe(600);
    // Il 2027 è ancora quello scritto quando il 2026 valeva 0: la sua transazione è fallita.
    await rif('bancaOre/2027_dipA').set(bancaGennaio(0));

    // Riconsegna dell'evento.
    await ricalcolaBancaOre('repRev', 'dipA', 2026);

    const gennaio = (await rif('bancaOre/2027_dipA').get()).data();
    expect(gennaio).toMatchObject({ riportoMinuti: 600, saldoAnnoMinuti: 600 });
  });

  it('controllo: se il saldo dell’anno di partenza cambia, l’anno dopo segue', async () => {
    await rif('riepiloghi/2026-11_dipA').set(riepilogoNovembre(0));
    await ricalcolaBancaOre('repRev', 'dipA', 2026);
    await rif('bancaOre/2027_dipA').set(bancaGennaio(0));
    await rif('riepiloghi/2026-11_dipA').set(riepilogoNovembre(600));

    await ricalcolaBancaOre('repRev', 'dipA', 2026);

    expect((await rif('bancaOre/2027_dipA').get()).data()).toMatchObject({
      riportoMinuti: 600,
      saldoAnnoMinuti: 600,
    });
  });
});
