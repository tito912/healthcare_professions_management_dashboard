import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { dataISO } from '../codici';
import { limitiPeriodo } from './periodo';

const roma = (iso: string): number => DateTime.fromISO(iso, { zone: 'Europe/Rome' }).toMillis();

describe('limitiPeriodo', () => {
  it('senza filtri non limita', () => {
    expect(limitiPeriodo(null, null)).toEqual({ daMs: null, aMs: null });
  });

  it('il giorno finale è compreso per intero', () => {
    const l = limitiPeriodo(dataISO('2026-11-01'), dataISO('2026-11-17'));
    expect(l.daMs).toBe(roma('2026-11-01T00:00:00'));
    expect(l.aMs).toBe(roma('2026-11-18T00:00:00'));
  });

  it("regge il cambio dall'ora legale all'ora solare (giorno di 25 ore)", () => {
    const l = limitiPeriodo(dataISO('2026-10-25'), dataISO('2026-10-25'));
    expect((l.aMs ?? 0) - (l.daMs ?? 0)).toBe(25 * 3600_000);
  });
});
