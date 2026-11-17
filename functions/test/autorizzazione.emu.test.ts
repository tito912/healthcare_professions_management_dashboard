// Controlli comuni delle callable (functions/src/comune/autorizzazione.ts) sull'emulatore Firestore:
// gli stessi casi della colonna «Senza ruolo» delle regole, più proprietà del reparto.
import { Timestamp } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  richiediAdmin,
  richiediCoordinatoreDi,
  richiediLettoreDi,
  richiediUtente,
  type RichiestaAutenticata,
} from '../src/comune/autorizzazione';
import { adminDiProva, svuotaEmulatori } from './emulatori';

const admin = adminDiProva();

function richiesta(uid: string, ruolo?: string): RichiestaAutenticata {
  return { auth: { uid, token: ruolo === undefined ? {} : { ruolo } } };
}

const ANONIMA: RichiestaAutenticata = {};

beforeAll(async () => {
  await svuotaEmulatori();
  const utenti: [string, string, boolean][] = [
    ['admin', 'ADMIN', true],
    ['adminSpento', 'ADMIN', false],
    ['coordA', 'COORDINATORE', true],
    ['coordB', 'COORDINATORE', true],
    ['coordSpento', 'COORDINATORE', false],
  ];
  const batch = admin.db.batch();
  for (const [uid, ruolo, attivo] of utenti) {
    batch.set(admin.db.doc(`utenti/${uid}`), {
      nome: 'Nome',
      cognome: uid,
      email: `${uid}@prova.example`,
      ruolo,
      attivo,
      creatoIl: Timestamp.fromMillis(0),
      creatoDa: null,
      aggiornatoIl: Timestamp.fromMillis(0),
    });
  }
  batch.set(admin.db.doc('reparti/repA'), { coordinatoreUid: 'coordA', nome: 'A' });
  batch.set(admin.db.doc('reparti/repSpento'), { coordinatoreUid: 'coordSpento', nome: 'S' });
  await batch.commit();
});

afterAll(async () => {
  await admin.chiudi();
});

async function attendiCodice(promessa: Promise<unknown>, https: string, codice: string) {
  await expect(promessa).rejects.toMatchObject({ code: https, details: { codice } });
}

describe('richiediUtente', () => {
  it('restituisce uid, ruolo e nome per l’autore del registro', async () => {
    await expect(richiediUtente(richiesta('coordA', 'COORDINATORE'))).resolves.toEqual({
      uid: 'coordA',
      ruolo: 'COORDINATORE',
      nomeCompleto: 'Nome coordA',
    });
  });

  it('senza autenticazione: NON_AUTENTICATO', async () => {
    await attendiCodice(richiediUtente(ANONIMA), 'unauthenticated', 'NON_AUTENTICATO');
  });

  it.each([
    ['senza claim', richiesta('coordA')],
    ['claim non valido', richiesta('coordA', 'SUPERADMIN')],
    ['claim diverso dal documento', richiesta('coordA', 'ADMIN')],
    ['senza documento utente', richiesta('sconosciuto', 'ADMIN')],
    ['utente disattivato', richiesta('coordSpento', 'COORDINATORE')],
    ['ADMIN disattivato', richiesta('adminSpento', 'ADMIN')],
  ])('%s: UTENTE_NON_ABILITATO', async (_caso, r) => {
    await attendiCodice(richiediUtente(r), 'permission-denied', 'UTENTE_NON_ABILITATO');
  });
});

describe('richiediAdmin', () => {
  it('consentito all’ADMIN attivo', async () => {
    await expect(richiediAdmin(richiesta('admin', 'ADMIN'))).resolves.toMatchObject({
      ruolo: 'ADMIN',
    });
  });

  it('coordinatore: RUOLO_NON_AUTORIZZATO', async () => {
    await attendiCodice(
      richiediAdmin(richiesta('coordA', 'COORDINATORE')),
      'permission-denied',
      'RUOLO_NON_AUTORIZZATO',
    );
  });
});

describe('richiediCoordinatoreDi', () => {
  it('consentito al proprietario', async () => {
    await expect(
      richiediCoordinatoreDi(richiesta('coordA', 'COORDINATORE'), 'repA'),
    ).resolves.toMatchObject({ uid: 'coordA' });
  });

  it('reparto altrui e reparto inesistente danno lo stesso NON_PROPRIETARIO', async () => {
    await attendiCodice(
      richiediCoordinatoreDi(richiesta('coordB', 'COORDINATORE'), 'repA'),
      'permission-denied',
      'NON_PROPRIETARIO',
    );
    await attendiCodice(
      richiediCoordinatoreDi(richiesta('coordB', 'COORDINATORE'), 'repInesistente'),
      'permission-denied',
      'NON_PROPRIETARIO',
    );
  });

  it('ADMIN: RUOLO_NON_AUTORIZZATO (non scrive nei reparti)', async () => {
    await attendiCodice(
      richiediCoordinatoreDi(richiesta('admin', 'ADMIN'), 'repA'),
      'permission-denied',
      'RUOLO_NON_AUTORIZZATO',
    );
  });

  it('proprietario disattivato: UTENTE_NON_ABILITATO', async () => {
    await attendiCodice(
      richiediCoordinatoreDi(richiesta('coordSpento', 'COORDINATORE'), 'repSpento'),
      'permission-denied',
      'UTENTE_NON_ABILITATO',
    );
  });
});

describe('richiediLettoreDi', () => {
  it.each([
    ['ADMIN', richiesta('admin', 'ADMIN')],
    ['coordinatore proprietario', richiesta('coordA', 'COORDINATORE')],
  ])('consentito: %s', async (_caso, r) => {
    await expect(richiediLettoreDi(r, 'repA')).resolves.toBeDefined();
  });

  it('coordinatore di un altro reparto: NON_PROPRIETARIO', async () => {
    await attendiCodice(
      richiediLettoreDi(richiesta('coordB', 'COORDINATORE'), 'repA'),
      'permission-denied',
      'NON_PROPRIETARIO',
    );
  });

  it('ADMIN disattivato: UTENTE_NON_ABILITATO', async () => {
    await attendiCodice(
      richiediLettoreDi(richiesta('adminSpento', 'ADMIN'), 'repA'),
      'permission-denied',
      'UTENTE_NON_ABILITATO',
    );
  });
});
