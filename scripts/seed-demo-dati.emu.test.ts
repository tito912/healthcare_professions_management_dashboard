// Revisione 4.3 (rilievo 2): test automatici del seed dimostrativo sull'emulatore. Lancia lo script vero
// (npm run seed-demo -- --emulatore --svuota) e verifica con l'Admin SDK conteggi e coerenza dei dati demo.
// Il blocco fuori dall'emulatore è in seed-demo.emu.test.ts.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocumentData } from 'firebase-admin/firestore';
import { chiaveMese, meseCorrente, spostaMese } from '@turni/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminDiProva,
  HOST_FIRESTORE,
  PROGETTO,
  svuotaEmulatori,
} from '../functions/test/emulatori';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Mesi del seed: due mesi fa e il mese scorso convalidati, il mese corrente in bozza. */
const chiavi = [-2, -1, 0].map((passo) => spostaMese(chiaveMese(meseCorrente()), passo));
const corrente = chiavi[2] ?? '';
const statoAtteso: Record<string, string> = {
  [chiavi[0] ?? '']: 'convalidato',
  [chiavi[1] ?? '']: 'convalidato',
  [corrente]: 'bozza',
};
const EMAIL_UTENTI = [
  'admin.demo@prova.example',
  'coord.medicina@prova.example',
  'coord.chirurgia@prova.example',
] as const;
const NOMI_REPARTI = ['Chirurgia (dati demo)', 'Medicina (dati demo)'] as const;

interface Esito {
  readonly codice: number | null;
  readonly testo: string;
}

/** Lancia lo script del seed come farebbe chi lo digita, con l'ambiente del processo di test. */
function esegui(argomenti: readonly string[]): Promise<Esito> {
  return new Promise((risolvi, rifiuta) => {
    const processo = spawn('npx', ['tsx', 'scripts/seed-demo.ts', ...argomenti], {
      cwd: radice,
      env: process.env,
    });
    let testo = '';
    processo.stdout.on('data', (parte: Buffer) => {
      testo += parte.toString();
    });
    processo.stderr.on('data', (parte: Buffer) => {
      testo += parte.toString();
    });
    processo.on('error', rifiuta);
    processo.on('close', (codice) => risolvi({ codice, testo }));
  });
}

/** Il primo seed della suite cancella tutto e ricrea i dati: poi i test leggono lo stato così com'è. */
const admin = adminDiProva();
let primo: Esito = { codice: null, testo: '' };

async function reparti(): Promise<{ id: string; dati: DocumentData }[]> {
  const docs = (await admin.db.collection('reparti').get()).docs;
  return docs.map((doc) => ({ id: doc.id, dati: doc.data() }));
}

async function documenti(percorso: string): Promise<{ id: string; dati: DocumentData }[]> {
  const docs = (await admin.db.collection(percorso).get()).docs;
  return docs.map((doc) => ({ id: doc.id, dati: doc.data() }));
}

/** Celle di tutte le righe di un mese, con la chiave del giorno (solo i giorni con contenuto). */
async function celleDelMese(repartoId: string, chiave: string): Promise<DocumentData[]> {
  const righe = await documenti(`reparti/${repartoId}/mesi/${chiave}/righe`);
  return righe.flatMap((riga) => Object.values(riga.dati['giorni'] ?? {}));
}

/** Riepiloghi e banca ore li scrivono i trigger, in modo asincrono: si attende che i conteggi si fermino. */
async function attendiTrigger(): Promise<void> {
  const anni = new Set(chiavi.map((c) => c.slice(0, 4)));
  let precedente = '';
  let stabile = 0;
  for (let giro = 0; giro < 300; giro += 1) {
    const impronta: string[] = [];
    let completo = true;
    for (const reparto of await reparti()) {
      const riepiloghi = await documenti(`reparti/${reparto.id}/riepiloghi`);
      const banche = await documenti(`reparti/${reparto.id}/bancaOre`);
      const avvisi = riepiloghi.reduce<number>((s, r) => s + Number(r.dati['numeroAvvisi']), 0);
      impronta.push(`${riepiloghi.length}/${banche.length}/${avvisi}`);
      completo = completo && riepiloghi.length === 36 && banche.length === 12 * anni.size;
    }
    const fingerprint = impronta.join('|');
    stabile = fingerprint === precedente ? stabile + 1 : 0;
    precedente = fingerprint;
    if (completo && stabile >= 3) {
      return;
    }
    await new Promise<void>((risolvi) => setTimeout(risolvi, 200));
  }
}

beforeAll(async () => {
  primo = await esegui(['--emulatore', '--svuota']);
  if (primo.codice === 0) {
    await attendiTrigger();
  }
}, 240_000);

afterAll(async () => {
  await admin.chiudi();
  await svuotaEmulatori();
}, 60_000);

describe('seed-demo: conteggi e coerenza dei dati demo', () => {
  it('il seed termina con codice 0', () => {
    expect(primo.codice, primo.testo).toBe(0);
  });

  it('utenti: un ADMIN e due coordinatori attivi, con l’account Auth', async () => {
    const utenti = await documenti('utenti');
    expect(utenti).toHaveLength(3);
    expect(utenti.filter((u) => u.dati['ruolo'] === 'ADMIN')).toHaveLength(1);
    expect(utenti.filter((u) => u.dati['ruolo'] === 'COORDINATORE')).toHaveLength(2);
    expect(utenti.every((u) => u.dati['attivo'] === true)).toBe(true);
    for (const email of EMAIL_UTENTI) {
      await expect(admin.auth.getUserByEmail(email)).resolves.toMatchObject({ email });
    }
  });

  it('due reparti con il nome previsto, configurazione completata e un coordinatore esistente', async () => {
    const elenco = await reparti();
    expect(elenco.map((r) => r.dati['nome']).sort()).toEqual([...NOMI_REPARTI]);
    const coordinatori = new Set(
      (await documenti('utenti'))
        .filter((u) => u.dati['ruolo'] === 'COORDINATORE')
        .map((u) => u.id),
    );
    for (const reparto of elenco) {
      expect(reparto.dati['configurazione']).toMatchObject({ passo: 'completata' });
      expect(coordinatori.has(String(reparto.dati['coordinatoreUid']))).toBe(true);
    }
  });

  it('per reparto: 12 dipendenti, 6 turni (4 turni e 2 reperibilità), 3 assenze, 3 mesi', async () => {
    for (const reparto of await reparti()) {
      const base = `reparti/${reparto.id}`;
      expect(await documenti(`${base}/dipendenti`)).toHaveLength(12);
      expect(await documenti(`${base}/turni`)).toHaveLength(6);
      expect(await documenti(`${base}/assenze`)).toHaveLength(3);
      expect((await documenti(`${base}/mesi`)).map((m) => m.id).sort()).toEqual([...chiavi].sort());
    }
  });

  it('mesi: due convalidati, il corrente in bozza, 12 righe ciascuno', async () => {
    for (const reparto of await reparti()) {
      for (const chiave of chiavi) {
        const mese = (await admin.db.doc(`reparti/${reparto.id}/mesi/${chiave}`).get()).data();
        expect(mese?.['stato'], `${reparto.id} ${chiave}`).toBe(statoAtteso[chiave]);
        expect(await documenti(`reparti/${reparto.id}/mesi/${chiave}/righe`)).toHaveLength(12);
      }
    }
  });

  it('riepiloghi: uno per dipendente e per mese (36 per reparto), coerenti con mese e riga', async () => {
    for (const reparto of await reparti()) {
      const dipendenti = new Set(
        (await documenti(`reparti/${reparto.id}/dipendenti`)).map((d) => d.id),
      );
      const riepiloghi = await documenti(`reparti/${reparto.id}/riepiloghi`);
      expect(riepiloghi).toHaveLength(36);
      for (const riepilogo of riepiloghi) {
        const { dipendenteId, chiaveMese, statoMese, valida } = riepilogo.dati;
        expect(riepilogo.id).toBe(`${String(chiaveMese)}_${String(dipendenteId)}`);
        expect(dipendenti.has(String(dipendenteId))).toBe(true);
        expect(statoMese).toBe(statoAtteso[String(chiaveMese)]);
        expect(valida).toBe(true);
      }
    }
  });

  it('banca ore: una per dipendente e anno, con il saldo annuale che torna sui mesi', async () => {
    const anni = new Set(chiavi.map((c) => c.slice(0, 4)));
    for (const reparto of await reparti()) {
      const banche = await documenti(`reparti/${reparto.id}/bancaOre`);
      expect(banche).toHaveLength(12 * anni.size);
      for (const banca of banche) {
        const mesi: DocumentData[] = Object.values(banca.dati['mesi'] ?? {});
        const sommaMesi = mesi.reduce<number>((somma, m) => somma + Number(m['saldoMinuti']), 0);
        expect(banca.dati['saldoAnnoMinuti']).toBe(Number(banca.dati['riportoMinuti']) + sommaMesi);
      }
    }
  });

  it('dati di prova: sostituzioni, variazioni, un solo turno scoperto a Medicina, avvisi nel mese corrente', async () => {
    const elenco = await reparti();
    for (const reparto of elenco) {
      const celle = (await Promise.all(chiavi.map((c) => celleDelMese(reparto.id, c)))).flat();
      expect(
        celle.filter((c) => c['copertoDa'] !== null && c['copertoDa'] !== undefined).length,
      ).toBeGreaterThan(0);
      expect(
        celle.filter((c) => c['orarioReale'] !== null && c['orarioReale'] !== undefined).length,
      ).toBeGreaterThan(0);

      const scoperti = (await celleDelMese(reparto.id, corrente)).filter(
        (c) =>
          c['turno'] !== null &&
          c['assenza'] !== null &&
          (c['copertoDa'] === null || c['copertoDa'] === undefined),
      );
      const attesi = reparto.dati['nome'] === 'Medicina (dati demo)' ? 1 : 0;
      expect(scoperti, `${String(reparto.dati['nome'])}`).toHaveLength(attesi);
    }
    const medicina = elenco.find((r) => r.dati['nome'] === 'Medicina (dati demo)');
    const riepiloghiMedicina = medicina ? await documenti(`reparti/${medicina.id}/riepiloghi`) : [];
    const avvisi = riepiloghiMedicina
      .filter((r) => r.dati['chiaveMese'] === corrente)
      .reduce<number>((somma, r) => somma + Number(r.dati['numeroAvvisi']), 0);
    expect(avvisi).toBeGreaterThan(0);
  });
});

describe('seed-demo: rilanci', () => {
  it('senza --svuota rifiuta di scrivere in un database che ha già dati', async () => {
    const prima = (await reparti()).length;
    const esito = await esegui(['--emulatore']);
    expect(esito.codice).toBe(1);
    expect(esito.testo).toContain('Negli emulatori ci sono già dati');
    expect(await reparti()).toHaveLength(prima);
  }, 120_000);

  it('--svuota cancella anche gli utenti di Auth quando Firestore è già vuoto', async () => {
    // Firestore svuotato da solo, con un utente rimasto in Auth: il seed deve ripartire comunque.
    await svuotaSoloFirestore();
    expect(await reparti()).toHaveLength(0);
    await admin.auth.createUser({
      email: 'rimasto@prova.example',
      password: 'Password-di-prova-1',
    });

    const esito = await esegui(['--emulatore', '--svuota']);
    expect(esito.codice, esito.testo).toBe(0);
    await expect(admin.auth.getUserByEmail('rimasto@prova.example')).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
    await expect(admin.auth.getUserByEmail('admin.demo@prova.example')).resolves.toBeDefined();
  }, 180_000);
});

/** Svuota solo Firestore dell'emulatore, con qualche ritentativo sul 409 dei trigger in corso. */
async function svuotaSoloFirestore(): Promise<void> {
  const url = `http://${HOST_FIRESTORE}/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`;
  for (let tentativo = 1; ; tentativo += 1) {
    const risposta = await fetch(url, { method: 'DELETE' });
    if (risposta.ok) {
      return;
    }
    if (tentativo >= 8) {
      throw new Error(`Svuotamento di Firestore non riuscito (HTTP ${risposta.status}).`);
    }
    await new Promise<void>((risolvi) => setTimeout(risolvi, 200 * tentativo));
  }
}
