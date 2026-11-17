// I contratti delle callable (packages/domain/src/contratti) sono condivisi con il browser. Nel runner dei
// test di Angular le dipendenze si risolvono da apps/web: senza zod 4 tra le dipendenze del web veniva
// caricato lo zod 3 della radice (portato da firebase-tools) e `z.email` non esisteva.
import { analizzaInput, schemaCreaCoordinatoreInput } from '@turni/domain';

describe('dominio nel browser', () => {
  it('i contratti delle callable si caricano e validano', () => {
    expect(
      analizzaInput(schemaCreaCoordinatoreInput, {
        email: 'A@B.it',
        nome: 'Maria',
        cognome: 'Rossi',
      }),
    ).toEqual({ valido: true, valore: { email: 'a@b.it', nome: 'Maria', cognome: 'Rossi' } });
    expect(analizzaInput(schemaCreaCoordinatoreInput, { email: 'x' }).valido).toBe(false);
  });
});
