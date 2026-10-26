import { describe, expect, it } from 'vitest';
import { describePrint, problemSummary } from './printStatus';

const TZ = 'America/Argentina/Buenos_Aires';
const ctx = { agentOnline: true, timezone: TZ };

describe('describePrint', () => {
  it('says "Sin imprimir" with an Imprimir action for NONE', () => {
    expect(describePrint({ printStatus: 'NONE', printedAt: null }, ctx)).toMatchObject({
      kind: 'none',
      label: 'Sin imprimir',
      title: 'Todavía no se mandó ninguna comanda a imprimir',
      actionLabel: 'Imprimir',
      actionDisabled: false,
    });
  });

  it('shows En cola and blocks the action while the agent is online', () => {
    expect(describePrint({ printStatus: 'QUEUED', printedAt: null }, ctx)).toMatchObject({
      kind: 'queued',
      label: 'En cola',
      title: 'Imprimiendo…',
      detail: undefined,
      actionLabel: 'Reimprimir',
      actionDisabled: true,
    });
  });

  it('says it is waiting for the local PC when the agent is offline', () => {
    const view = describePrint({ printStatus: 'QUEUED', printedAt: null }, { ...ctx, agentOnline: false });
    expect(view.detail).toBe('esperando a la PC del local');
    expect(view.title).toBe('Esperando a la PC del local');
  });

  it('does not claim anything about the agent while its status is unknown', () => {
    const view = describePrint({ printStatus: 'QUEUED', printedAt: null }, { ...ctx, agentOnline: undefined });
    expect(view.detail).toBeUndefined();
    expect(view.title).toBe('En cola de impresión');
  });

  it('keeps the printed time out of the label and in the tooltip, in the restaurant timezone', () => {
    expect(
      describePrint({ printStatus: 'PRINTED', printedAt: '2026-10-01T15:16:00Z' }, ctx),
    ).toMatchObject({
      kind: 'printed',
      label: 'Impresa',
      title: 'Impresa a las 12:16',
      actionLabel: 'Reimprimir',
      actionDisabled: false,
    });
  });

  it('shows plain "Impresa" when the time is missing', () => {
    const view = describePrint({ printStatus: 'PRINTED', printedAt: null }, ctx);
    expect(view.label).toBe('Impresa');
    expect(view.title).toBe('Impresa');
  });

  it('flags FAILED and EXPIRED, both reprintable', () => {
    expect(describePrint({ printStatus: 'FAILED', printedAt: null }, ctx)).toMatchObject({
      kind: 'failed',
      label: 'Falló',
      title: 'Falló — revisá la ticketera',
      actionLabel: 'Reimprimir',
      actionDisabled: false,
    });
    expect(describePrint({ printStatus: 'EXPIRED', printedAt: null }, ctx)).toMatchObject({
      kind: 'expired',
      label: 'Sin imprimir',
      title: 'No salió en 30 min',
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
