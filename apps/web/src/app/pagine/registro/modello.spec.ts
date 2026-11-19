import { formattaOraDaMs } from '@turni/domain';
import type { VoceRegistro } from '../../dati/registro.repo';
import { rigaDiVoce, testoDettagli, type ContestoRegistro } from './modello';

/** 17/11/2026 13:32 UTC = 14:32 a Roma. */
const ISTANTE = 1794922320000;

function voce(parziale: Partial<VoceRegistro>): VoceRegistro {
  return {
    id: 'v1',
    ilMs: ISTANTE,
    tipo: 'mese.convalidato',
    autoreUid: 'u1',
    autoreNome: 'Maria Rossi',
    repartoId: 'r1',
    chiaveMese: null,
    dipendenteId: null,
    dettagli: {},
    ...parziale,
  };
}

const contesto: ContestoRegistro = {
  nomeReparto: (id) => (id === 'r1' ? 'Radiologia' : undefined),
  nomeUtente: (uid) => (uid === 'uCoord' ? 'Marta Rossi' : undefined),
  nomeDipendente: (_r, d) => (d === 'd1' ? 'Rossi Mario' : d === 'd2' ? null : undefined),
};

describe('rigaDiVoce', () => {
  it('data e ora a Europe/Rome, utente, reparto e operazione', () => {
    const riga = rigaDiVoce(voce({}), contesto);
    expect(riga.dataOra).toBe(`17/11/2026 ${formattaOraDaMs(ISTANTE)}`);
    expect(riga.dataOra).toBe('17/11/2026 14:32');
    expect(riga).toMatchObject({
      utente: 'Maria Rossi',
      reparto: 'Radiologia',
      operazione: 'Mese convalidato',
    });
  });

  it('voce del sistema senza reparto: «Sistema» e «—»', () => {
    const riga = rigaDiVoce(
      voce({ tipo: 'pulizia.eseguita', autoreUid: null, autoreNome: null, repartoId: null }),
      contesto,
    );
    expect(riga).toMatchObject({ utente: 'Sistema', reparto: '—', operazione: 'Pulizia cessati' });
  });

  describe('autore delle voci di consuntivo (audit 4.4, I2)', () => {
    const consuntivo = {
      tipo: 'consuntivo.modificato' as const,
      autoreUid: 'uCoord',
      autoreNome: null,
      repartoId: 'r1',
      chiaveMese: '2026-11',
      dipendenteId: 'd1',
      dettagli: { giorno: '05', campo: 'orarioReale', prima: '07:00-14:00', dopo: '07:00-14:30' },
    };

    it('senza autoreNome risolve autoreUid con gli utenti noti, non «Sistema»', () => {
      expect(rigaDiVoce(voce(consuntivo), contesto).utente).toBe('Marta Rossi');
    });

    it('con autoreUid non risolvibile mostra «Utente non disponibile», mai «Sistema»', () => {
      const riga = rigaDiVoce(voce({ ...consuntivo, autoreUid: 'uSconosciuto' }), contesto);
      expect(riga.utente).toBe('Utente non disponibile');
    });

    it('«Sistema» solo con autoreUid nullo', () => {
      const riga = rigaDiVoce(voce({ ...consuntivo, autoreUid: null }), contesto);
      expect(riga.utente).toBe('Sistema');
    });

    it('l’autoreNome della voce, se c’è, prevale', () => {
      expect(rigaDiVoce(voce({ ...consuntivo, autoreNome: 'Luca Neri' }), contesto).utente).toBe(
        'Luca Neri',
      );
    });
  });

  describe('collega nelle sostituzioni (audit 4.4, I2)', () => {
    const base = {
      tipo: 'consuntivo.modificato' as const,
      repartoId: 'r1',
      chiaveMese: '2026-11',
      dipendenteId: 'd1',
    };

    it('sostituisce e copertoDa mostrano il nome del collega, non l’ID', () => {
      const sostituisce = rigaDiVoce(
        voce({
          ...base,
          dettagli: { giorno: '14', campo: 'sostituisce', prima: null, dopo: 'd1' },
        }),
        contesto,
      );
      expect(sostituisce.dettagli).toBe('Rossi Mario · 14/11 · sostituisce: — → Rossi Mario');
      const copertoDa = rigaDiVoce(
        voce({ ...base, dettagli: { giorno: '14', campo: 'copertoDa', prima: 'd1', dopo: 'd2' } }),
        contesto,
      );
      expect(copertoDa.dettagli).toBe(
        'Rossi Mario · 14/11 · coperto da: Rossi Mario → Dipendente rimosso',
      );
    });

    it('un collega non ancora noto non mostra l’ID', () => {
      const riga = rigaDiVoce(
        voce({
          ...base,
          dettagli: { giorno: '14', campo: 'copertoDa', prima: null, dopo: 'd3' },
        }),
        contesto,
      );
      expect(riga.dettagli).not.toContain('d3');
      expect(riga.dettagli).toContain('coperto da: — → …');
    });

    it('le fasce di reperibilità risolvono ogni collega e tengono il codice della fascia', () => {
      const riga = rigaDiVoce(
        voce({
          ...base,
          dettagli: {
            giorno: '14',
            campo: 'reperibilitaCopertaDa',
            prima: null,
            dopo: 'R1:d1,R2:d2',
          },
        }),
        contesto,
      );
      expect(riga.dettagli).toContain(
        'reperibilità coperta da: — → R1:Rossi Mario,R2:Dipendente rimosso',
      );
    });

    it('gli altri campi restano com’erano', () => {
      const riga = rigaDiVoce(
        voce({
          ...base,
          dettagli: { giorno: '05', campo: 'chiamate', prima: null, dopo: 'R1:30' },
        }),
        contesto,
      );
      expect(riga.dettagli).toContain('chiamate: — → R1:30');
    });
  });

  it('reparto non più noto', () => {
    expect(rigaDiVoce(voce({ repartoId: 'rX' }), contesto).reparto).toBe('Reparto non disponibile');
  });

  it('il dipendente compare per nome se esiste, altrimenti «Dipendente rimosso»', () => {
    const base = { tipo: 'dipendente.salvato' as const, dettagli: { azione: 'creato' } };
    expect(rigaDiVoce(voce({ ...base, dipendenteId: 'd1' }), contesto).dettagli).toBe(
      'Rossi Mario · azione: creato',
    );
    expect(rigaDiVoce(voce({ ...base, dipendenteId: 'd2' }), contesto).dettagli).toBe(
      'Dipendente rimosso · azione: creato',
    );
  });

  it("finché l'anagrafica non è letta non mostra né nomi né ID", () => {
    const riga = rigaDiVoce(voce({ dipendenteId: 'd3' }), contesto);
    expect(riga.dettagli).not.toContain('d3');
  });
});

describe('testoDettagli', () => {
  it('variazione di consuntivo: giorno/mese, campo, prima e dopo', () => {
    expect(
      testoDettagli(
        voce({
          tipo: 'consuntivo.modificato',
          chiaveMese: '2026-11',
          dettagli: {
            giorno: '05',
            campo: 'orarioReale',
            prima: '07:00-14:00',
            dopo: '07:00-14:30',
          },
        }),
      ),
    ).toBe('05/11 · orario: 07:00-14:00 → 07:00-14:30');
  });

  it('pulizia: conteggi, errori e modalità di prova', () => {
    const base = { tipo: 'pulizia.eseguita' as const, repartoId: null };
    expect(
      testoDettagli(
        voce({
          ...base,
          dettagli: { modalitaProva: false, dipendentiEliminati: 1, fileEliminati: 4 },
        }),
      ),
    ).toBe('1 dipendente eliminato · 4 file eliminati');
    expect(
      testoDettagli(
        voce({
          ...base,
          dettagli: { modalitaProva: false, dipendentiEliminati: 0, fileEliminati: 0, errori: 2 },
        }),
      ),
    ).toBe('0 dipendenti eliminati · 0 file eliminati · 2 errori');
    expect(
      testoDettagli(
        voce({ ...base, dettagli: { modalitaProva: true, dipendentiTrovati: 3, fileScaduti: 1 } }),
      ),
    ).toBe('Prova, nulla cancellato: 3 dipendenti e 1 file da eliminare');
  });

  it('le altre voci elencano mese e dettagli con etichette in italiano', () => {
    expect(
      testoDettagli(
        voce({
          tipo: 'report.inviato',
          chiaveMese: '2026-11',
          dettagli: { idBimestre: '2026-B6', dipendenti: 5 },
        }),
      ),
    ).toBe('2026-11 · bimestre: 2026-B6 · dipendenti: 5');
  });
});
