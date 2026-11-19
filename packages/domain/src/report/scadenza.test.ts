import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { scadenzaMail } from './scadenza';

describe('scadenzaMail', () => {
  it('sono 30 giorni di calendario a Europe/Rome, anche attraverso il cambio d’ora', () => {
    // 20/10/2026 10:00 Roma (ora legale) + 30 giorni = 19/11/2026 10:00 Roma (ora solare).
    const inizio = DateTime.fromISO('2026-10-20T10:00:00', { zone: 'Europe/Rome' }).toMillis();
    const fine = scadenzaMail(inizio);
    expect(DateTime.fromMillis(fine, { zone: 'Europe/Rome' }).toFormat('yyyy-LL-dd HH:mm')).toBe(
      '2026-11-19 10:00',
    );
    expect(fine - inizio).toBe(30 * 24 * 3600_000 + 3600_000);
  });

  it('accetta un numero di giorni diverso', () => {
    const inizio = DateTime.fromISO('2026-01-01T00:00:00', { zone: 'Europe/Rome' }).toMillis();
    expect(scadenzaMail(inizio, 1) - inizio).toBe(24 * 3600_000);
  });
});
