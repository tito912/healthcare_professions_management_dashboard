// Test aggiunto dalla review dello step 1.4 (docs/review/1.4.md, rilievo 2). Dimostra un difetto: oggi fallisce.
// «Disattiva…» imposta `attivo: false` con la data di cessazione scelta, anche futura. L35 dice «In servizio =
// tra data di assunzione e data di cessazione» e UX §7.5 mostra «cessa il 31/12/2026» nell'elenco; il testo
// del dialogo dice «non comparirà nei mesi successivi a questa data». Oggi invece un dipendente disattivato con
// una cessazione futura risulta subito «cessato» e sparisce dal filtro «In servizio».
import { describe, expect, it } from 'vitest';
import { dataISO } from '../codici';
import { eInServizioOCessaDopo, statoDipendente } from './validazione';

const OGGI = '2026-11-18';

describe('review 1.4, rilievo 2: disattivato con cessazione futura', () => {
  const disattivatoAFineAnno = {
    attivo: false,
    dataAssunzione: null,
    dataCessazione: dataISO('2026-12-31'),
  };

  it('fino alla data di cessazione è «cessa il …», non «cessato»', () => {
    expect(statoDipendente(disattivatoAFineAnno, OGGI)).toBe('cessaIl');
  });

  it('fino alla data di cessazione resta tra gli «In servizio» dell’elenco', () => {
    expect(eInServizioOCessaDopo(disattivatoAFineAnno, OGGI)).toBe(true);
  });

  it('controllo: dal giorno dopo la cessazione è «cessato»', () => {
    expect(statoDipendente(disattivatoAFineAnno, '2027-01-01')).toBe('cessato');
  });
});
