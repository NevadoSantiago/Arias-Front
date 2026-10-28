import type { CancelledOrder } from '@/features/admin/services/adminApi';

/**
 * Orders of `list` the kitchen has not been told about yet and that were already commanded when the
 * customer cancelled: their ticket is out, so someone has to stop the preparation. Orders cancelled
 * before the page loaded (`seen`) are not news.
 */
export function newCommandedCancellations(seen: ReadonlySet<number>, list: CancelledOrder[]): CancelledOrder[] {
  return list.filter((o) => o.comandadoAt !== null && !seen.has(o.id));
}

export interface CancelledSummary {
  total: number;
  /** Cancelled orders that had already been commanded. */
  commanded: number;
  /** "1 ya comandado" / "3 ya comandados"; null when none. */
  commandedLabel: string | null;
}

export function cancelledSummary(list: CancelledOrder[]): CancelledSummary {
  const commanded = list.filter((o) => o.comandadoAt !== null).length;
  return {
    total: list.length,
    commanded,
    commandedLabel: commanded === 0 ? null : `${commanded} ya ${commanded === 1 ? 'comandado' : 'comandados'}`,
  };
}
