// Registrazione delle callable utenti, senza emulatori: regione unica del dominio (D11).
import { REGIONE_FUNZIONI } from '@turni/domain';
import { describe, expect, it } from 'vitest';
import { assegnaReparto, creaCoordinatore, impostaStatoUtente } from '../src/index';

describe.each([
  ['creaCoordinatore', creaCoordinatore],
  ['impostaStatoUtente', impostaStatoUtente],
  ['assegnaReparto', assegnaReparto],
])('%s', (_nome, funzione) => {
  it('è una callable nella regione del dominio', () => {
    expect(funzione.__endpoint.callableTrigger).toBeDefined();
    expect(funzione.__endpoint.region).toEqual([REGIONE_FUNZIONI]);
  });
});
