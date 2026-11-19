// Stato «non connesso» (PIANO 4.2 criterio 4, UX §3): senza connessione «Salva bozza» è sospeso, le modifiche non
// salvate restano nella griglia e, al ritorno della connessione, si salvano senza perdere nulla.
import { assestatiGriglia, montaGriglia, pulsante, testoDi } from '../../test/monta-griglia';
import { clic } from '../../test/azioni-griglia';

const ROSSI = 'd1';

afterEach(() => {
  window.dispatchEvent(new Event('online'));
});

describe('Griglia senza connessione', () => {
  it('sospende «Salva bozza», conserva le modifiche e salva al ritorno della connessione', async () => {
    const t = await montaGriglia();
    await clic(t, ROSSI, '03');
    await t.tasto(t.cella(ROSSI, '03'), 'm');
    const campo = t.radice().querySelector('input[maxlength="2"]') as HTMLInputElement;
    campo.value = 'M1';
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    await t.tasto(campo, 'Enter');
    expect(testoDi(t.cella(ROSSI, '03'))).toContain('M1');

    window.dispatchEvent(new Event('offline'));
    await assestatiGriglia(t.harness);
    const salva = pulsante(t.radice(), 'Salva bozza') as HTMLButtonElement;
    expect(salva.disabled || salva.getAttribute('aria-disabled') === 'true').toBe(true);
    salva.click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(0);
    // Le modifiche non salvate sono ancora lì, in cella e nel conteggio.
    expect(testoDi(t.cella(ROSSI, '03'))).toContain('M1');
    expect(testoDi(t.radice())).toContain('1 modifica non salvata');

    window.dispatchEvent(new Event('online'));
    await assestatiGriglia(t.harness);
    pulsante(t.radice(), 'Salva bozza').click();
    await t.assesta();
    expect(t.salvataggi).toHaveLength(1);
    expect(
      t.salvataggi[0]?.righe.find((r) => r.dipendenteId === ROSSI)?.giorni['03']?.turno?.codice,
    ).toBe('M1');
  });
});
