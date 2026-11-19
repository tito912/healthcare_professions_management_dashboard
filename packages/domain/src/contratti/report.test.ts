import { describe, expect, it } from 'vitest';
import {
  schemaGeneraReportInput,
  schemaGeneraReportOutput,
  schemaInviaReportInput,
  schemaInviaReportOutput,
} from './report';

describe('contratti del report', () => {
  it('generaReport: reparto e bimestre validi, nessun campo in più', () => {
    expect(
      schemaGeneraReportInput.safeParse({ repartoId: 'r1', idBimestre: '2026-B6' }).success,
    ).toBe(true);
    expect(
      schemaGeneraReportInput.safeParse({ repartoId: 'r1', idBimestre: '2026-B7' }).success,
    ).toBe(false);
    expect(
      schemaGeneraReportInput.safeParse({ repartoId: 'a/b', idBimestre: '2026-B6' }).success,
    ).toBe(false);
    expect(
      schemaGeneraReportInput.safeParse({ repartoId: 'r1', idBimestre: '2026-B6', altro: 1 })
        .success,
    ).toBe(false);
  });

  it('inviaReport: null = tutti, un elenco non vuoto di ID, anteprima facoltativa', () => {
    const base = { repartoId: 'r1', idBimestre: '2026-B6' };
    expect(schemaInviaReportInput.safeParse({ ...base, dipendenteIds: null }).success).toBe(true);
    expect(schemaInviaReportInput.safeParse({ ...base, dipendenteIds: ['d1', 'd2'] }).success).toBe(
      true,
    );
    expect(
      schemaInviaReportInput.safeParse({ ...base, dipendenteIds: ['d1'], anteprima: true }).success,
    ).toBe(true);
    expect(schemaInviaReportInput.safeParse({ ...base, dipendenteIds: [] }).success).toBe(false);
    expect(schemaInviaReportInput.safeParse({ ...base }).success).toBe(false);
    expect(schemaInviaReportInput.safeParse({ ...base, dipendenteIds: ['x/y'] }).success).toBe(
      false,
    );
    expect(
      schemaInviaReportInput.safeParse({ ...base, dipendenteIds: null, anteprima: 'si' }).success,
    ).toBe(false);
  });

  it('le risposte hanno la forma documentata', () => {
    expect(
      schemaGeneraReportOutput.safeParse({
        nomeFile: 'a.xlsx',
        contenutoBase64: 'AA==',
        mesiInclusi: ['2026-11'],
      }).success,
    ).toBe(true);
    expect(
      schemaInviaReportOutput.safeParse({ esiti: [{ dipendenteId: 'd1', esito: 'accodato' }] })
        .success,
    ).toBe(true);
    expect(
      schemaInviaReportOutput.safeParse({ esiti: [{ dipendenteId: 'd1', esito: 'boh' }] }).success,
    ).toBe(false);
  });
});
