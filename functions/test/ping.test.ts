import { REGIONE_FUNZIONI } from '@turni/domain';
import { describe, expect, it } from 'vitest';
import { ping } from '../src/index';

describe('ping', () => {
  it('è una callable esportata', () => {
    expect(ping).toBeDefined();
  });

  it('è registrata nella regione del dominio', () => {
    expect(ping.__endpoint.region).toEqual([REGIONE_FUNZIONI]);
  });
});
