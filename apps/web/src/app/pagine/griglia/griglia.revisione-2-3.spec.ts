// Test della review dello step 2.3 (docs/review/2.3.md): ciascuno dimostra un difetto e oggi fallisce.
import { montaGriglia, pulsante } from '../../test/monta-griglia';

const BIANCHI = 'd2';

type Montata = Awaited<ReturnType<typeof montaGriglia>>;

async function clic(t: Montata, id: string, giorno: string): Promise<void> {
  t.cella(id, giorno).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
  await t.assesta();
}

describe('Review 2.3 — rilievo 2: i blocchi del server restano dopo la correzione', () => {
  it('dopo aver corretto e salvato la riga rifiutata, il dialogo di convalida non mostra più il blocco del server', async () => {
    const t = await montaGriglia({
      oggi: '2026-12-02',
      esitoDialogo: { tipo: 'convalida' },
      convalida: () =>
        Promise.reject({
          code: 'functions/failed-precondition',
          details: { codice: 'RIGHE_NON_VALIDE', righe: [BIANCHI] },
        }),
    });
    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    expect(t.dialoghi.apri).toHaveBeenCalledTimes(1);

    // Il coordinatore corregge la riga di Bianchi e salva.
    await clic(t, BIANCHI, '05');
    await t.tasto(t.cella(BIANCHI, '05'), 'm');
    const campo = t
      .radice()
      .querySelector<HTMLInputElement>('input[maxlength="2"]') as HTMLInputElement;
    campo.value = 'M1';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.tasto(campo, 'Enter');
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(1);

    pulsante(t.radice(), 'Convalida mese').click();
    await t.assesta();
    const dati = t.dialoghi.apri.mock.calls[1]?.[1] as unknown as {
      voci: { codice: string; livello: string }[];
    };
    // Il blocco «rigaServer» riguardava la riga com'era prima del salvataggio: tenerlo disabilita «Continua».
    expect(dati.voci.filter((v) => v.codice === 'rigaServer')).toEqual([]);
  });
});
