import type { PickupOrder } from '@/features/admin/services/adminApi';
import { formatMinute, minuteOfDay } from './kitchenBoard';

export type PrintKind = 'none' | 'queued' | 'printed' | 'failed' | 'expired';

export interface PrintView {
  kind: PrintKind;
  label: string;
  /** Secondary text next to the label. */
  detail?: string;
  /** "Imprimir" when nothing was ever queued, "Reimprimir" otherwise. */
  actionLabel: 'Imprimir' | 'Reimprimir';
  /** Reprinting is idempotent while jobs are unfinished, so the button waits for them. */
  actionDisabled: boolean;
}

interface PrintContext {
  /** Undefined until the first agent status arrives. */
  agentOnline: boolean | undefined;
  timezone: string;
}

/** Presents the print state of a commanded order with the wording of the approved design. */
export function describePrint(
  order: Pick<PickupOrder, 'printStatus' | 'printedAt'>,
  ctx: PrintContext,
): PrintView {
  switch (order.printStatus) {
    case 'QUEUED':
      return {
        kind: 'queued',
        label: 'En cola',
        detail: ctx.agentOnline === undefined
          ? undefined
          : ctx.agentOnline ? 'imprimiendo…' : 'esperando a la PC del local',
        actionLabel: 'Reimprimir',
        actionDisabled: true,
      };
    case 'PRINTED':
      return {
        kind: 'printed',
        label: order.printedAt
          ? `Impresa ${formatMinute(minuteOfDay(order.printedAt, ctx.timezone))}`
          : 'Impresa',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    case 'FAILED':
      return {
        kind: 'failed',
        label: 'Falló — revisá la ticketera',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    case 'EXPIRED':
      return {
        kind: 'expired',
        label: 'Sin imprimir',
        detail: 'no salió en 30 min',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    default:
      return { kind: 'none', label: 'Sin comanda impresa', actionLabel: 'Imprimir', actionDisabled: false };
  }
}

/** "1 comanda falló y 2 quedaron sin imprimir." or null when nothing needs attention. */
export function problemSummary(orders: Pick<PickupOrder, 'printStatus'>[]): string | null {
  const failed = orders.filter((o) => o.printStatus === 'FAILED').length;
  const expired = orders.filter((o) => o.printStatus === 'EXPIRED').length;
  const parts: string[] = [];
  if (failed) parts.push(failed === 1 ? '1 comanda falló' : `${failed} comandas fallaron`);
  if (expired) parts.push(expired === 1 ? '1 quedó sin imprimir' : `${expired} quedaron sin imprimir`);
  return parts.length ? `${parts.join(' y ')}.` : null;
}
