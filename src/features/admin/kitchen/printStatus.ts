import type { PickupOrder } from '@/features/admin/services/adminApi';
import { formatMinute, minuteOfDay } from './kitchenBoard';

export type PrintKind = 'none' | 'queued' | 'printed' | 'failed' | 'expired';

export interface PrintView {
  kind: PrintKind;
  /** Short text of the badge: "Impresa", "En cola", "Falló", "Sin imprimir". */
  label: string;
  /** Hover / focus text with the detail (e.g. "Impresa a las 12:03"). */
  title: string;
  /** Shown inline only when the cook has to act on it (the local PC is offline). */
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

/** Presents the print state of a commanded order. The time of the print lives in the tooltip only. */
export function describePrint(
  order: Pick<PickupOrder, 'printStatus' | 'printedAt'>,
  ctx: PrintContext,
): PrintView {
  switch (order.printStatus) {
    case 'QUEUED': {
      const waiting = ctx.agentOnline === false;
      return {
        kind: 'queued',
        label: 'En cola',
        title: ctx.agentOnline === undefined ? 'En cola de impresión' : waiting ? 'Esperando a la PC del local' : 'Imprimiendo…',
        detail: waiting ? 'esperando a la PC del local' : undefined,
        actionLabel: 'Reimprimir',
        actionDisabled: true,
      };
    }
    case 'PRINTED':
      return {
        kind: 'printed',
        label: 'Impresa',
        title: order.printedAt
          ? `Impresa a las ${formatMinute(minuteOfDay(order.printedAt, ctx.timezone))}`
          : 'Impresa',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    case 'FAILED':
      return {
        kind: 'failed',
        label: 'Falló',
        title: 'Falló — revisá la ticketera',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    case 'EXPIRED':
      return {
        kind: 'expired',
        label: 'Sin imprimir',
        title: 'No salió en 30 min',
        actionLabel: 'Reimprimir',
        actionDisabled: false,
      };
    default:
      return {
        kind: 'none',
        label: 'Sin imprimir',
        title: 'Todavía no se mandó ninguna comanda a imprimir',
        actionLabel: 'Imprimir',
        actionDisabled: false,
      };
  }
}

const STATUS_LABEL: Record<PickupOrder['printStatus'], string> = {
  PRINTED: 'Impresa',
  QUEUED: 'En cola',
  FAILED: 'Falló',
  EXPIRED: 'Sin imprimir',
  NONE: 'Sin imprimir',
};

/** Short text of a print status, for places that only have the status (timeline markers). */
export const printStatusLabel = (status: PickupOrder['printStatus']) => STATUS_LABEL[status];

/** "1 comanda falló y 2 quedaron sin imprimir." or null when nothing needs attention. */
export function problemSummary(orders: Pick<PickupOrder, 'printStatus'>[]): string | null {
  const failed = orders.filter((o) => o.printStatus === 'FAILED').length;
  const expired = orders.filter((o) => o.printStatus === 'EXPIRED').length;
  const parts: string[] = [];
  if (failed) parts.push(failed === 1 ? '1 comanda falló' : `${failed} comandas fallaron`);
  if (expired) parts.push(expired === 1 ? '1 quedó sin imprimir' : `${expired} quedaron sin imprimir`);
  return parts.length ? `${parts.join(' y ')}.` : null;
}
