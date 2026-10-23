import { describe, expect, it } from 'vitest';
import { describePrint, problemSummary } from './printStatus';

const TZ = 'America/Argentina/Buenos_Aires';
const ctx = { agentOnline: true, timezone: TZ };

describe('describePrint', () => {
  it('shows a subtle "no comanda" state with an Imprimir action for NONE', () => {
    expect(describePrint({ printStatus: 'NONE', printedAt: null }, ctx)).toMatchObject({
      kind: 'none',
      label: 'Sin comanda impresa',
      actionLabel: 'Imprimir',
      actionDisabled: false,
    });
  });

  it('shows En cola while the agent is online, and blocks the action', () => {
    expect(describePrint({ printStatus: 'QUEUED', printedAt: null }, ctx)).toMatchObject({
      kind: 'queued',
      label: 'En cola',
      detail: 'imprimiendo…',
      actionLabel: 'Reimprimir',
      actionDisabled: true,
    });
  });

  it('says it is waiting for the local PC when the agent is offline', () => {
    expect(
      describePrint({ printStatus: 'QUEUED', printedAt: null }, { ...ctx, agentOnline: false }).detail,
    ).toBe('esperando a la PC del local');
  });

  it('does not claim anything about the agent while its status is unknown', () => {
    expect(
      describePrint({ printStatus: 'QUEUED', printedAt: null }, { ...ctx, agentOnline: undefined }).detail,
    ).toBeUndefined();
  });

  it('shows the printed time in the restaurant timezone', () => {
    expect(
      describePrint({ printStatus: 'PRINTED', printedAt: '2026-10-01T15:16:00Z' }, ctx),
    ).toMatchObject({ kind: 'printed', label: 'Impresa 12:16', actionLabel: 'Reimprimir', actionDisabled: false });
  });

  it('shows plain "Impresa" when the time is missing', () => {
    expect(describePrint({ printStatus: 'PRINTED', printedAt: null }, ctx).label).toBe('Impresa');
  });

  it('flags FAILED and EXPIRED, both reprintable', () => {
    expect(describePrint({ printStatus: 'FAILED', printedAt: null }, ctx)).toMatchObject({
      kind: 'failed',
      label: 'Falló — revisá la ticketera',
      actionLabel: 'Reimprimir',
      actionDisabled: false,
    });
    expect(describePrint({ printStatus: 'EXPIRED', printedAt: null }, ctx)).toMatchObject({
      kind: 'expired',
      label: 'Sin imprimir',
      detail: 'no salió en 30 min',
      actionDisabled: false,
    });
  });
});

describe('problemSummary', () => {
  const s = (...statuses: string[]) => problemSummary(statuses.map((printStatus) => ({ printStatus })) as never);

  it('is null when nothing failed or expired', () => {
    expect(s('NONE', 'QUEUED', 'PRINTED')).toBeNull();
  });

  it('uses the singular and plural wording', () => {
    expect(s('FAILED')).toBe('1 comanda falló.');
    expect(s('FAILED', 'FAILED')).toBe('2 comandas fallaron.');
    expect(s('EXPIRED')).toBe('1 quedó sin imprimir.');
    expect(s('EXPIRED', 'EXPIRED', 'EXPIRED')).toBe('3 quedaron sin imprimir.');
  });

  it('joins both problems', () => {
    expect(s('FAILED', 'EXPIRED', 'EXPIRED')).toBe('1 comanda falló y 2 quedaron sin imprimir.');
  });
});
