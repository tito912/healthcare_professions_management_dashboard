import { describe, expect, it } from 'vitest';
import { eRuolo } from './index';

describe('eRuolo', () => {
  it.each(['ADMIN', 'COORDINATORE'])('%s è un ruolo', (valore) => {
    expect(eRuolo(valore)).toBe(true);
  });

  it.each([undefined, null, '', 'admin', 'SUPERADMIN', 1, ['ADMIN'], { ruolo: 'ADMIN' }])(
    '%j non è un ruolo',
    (valore) => {
      expect(eRuolo(valore)).toBe(false);
    },
  );
});
