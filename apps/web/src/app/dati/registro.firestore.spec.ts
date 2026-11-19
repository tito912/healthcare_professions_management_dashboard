// Revisione 4.2 (rilievo 1): le voci del collection group si distinguono per percorso, non per ID. Le voci
// `rimandato_{idBimestre}` di `reportBimestrale` hanno lo stesso ID in ogni reparto: se `VoceRegistro.id` è il solo ID
// del documento, la tabella (`track riga.id`) e la deduplica della paginazione le confondono.
import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { voceDaDocumento } from './registro.firestore';

function documento(repartoId: string): QueryDocumentSnapshot<DocumentData> {
  const id = 'rimandato_2026-B1';
  const snapshot = {
    id,
    ref: { path: `reparti/${repartoId}/registroAttivita/${id}` },
    data: () => ({
      il: Timestamp.fromMillis(1_794_922_320_000),
      tipo: 'report.invioRimandato',
      autoreUid: null,
      autoreNome: null,
      repartoId,
      chiaveMese: null,
      dipendenteId: null,
      dettagli: { idBimestre: '2026-B1' },
    }),
  };
  return snapshot as unknown as QueryDocumentSnapshot<DocumentData>;
}

describe('voceDaDocumento', () => {
  it('due voci con lo stesso ID in reparti diversi hanno identificativi diversi', () => {
    const a = voceDaDocumento(documento('r1'));
    const b = voceDaDocumento(documento('r2'));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.id).not.toBe(b?.id);
  });
});
