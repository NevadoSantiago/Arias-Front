import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCancelledOrders, type CancelledOrder } from '@/features/admin/services/adminApi';
import { newCommandedCancellations } from './cancelledOrders';
import { ORDERS_POLL_MS } from './useKitchenBoard';

export const CANCELLED_BOX_ID = 'kb-cancelled';

/**
 * Container logic of the "Pedidos cancelados" box of today's board: the list (polled at the board's
 * rate), whether the box is open and the kitchen notices. A notice is raised only for an order a
 * refresh reveals as newly cancelled AND already commanded; what was cancelled when the page loaded
 * (or when `fecha` changed) is not news.
 */
export function useCancelledOrders({ fecha, enabled }: { fecha: string; enabled: boolean }) {
  const query = useQuery({
    queryKey: ['adminCancelledOrders', fecha],
    queryFn: () => getCancelledOrders(fecha),
    refetchInterval: ORDERS_POLL_MS,
    enabled,
  });
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<CancelledOrder[]>([]);
  const seen = useRef<{ fecha: string; ids: Set<number> } | null>(null);

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    const known = seen.current?.fecha === fecha ? seen.current.ids : null;
    const ids = new Set(known ?? []);
    data.forEach((o) => ids.add(o.id));
    seen.current = { fecha, ids };
    if (known === null) {
      setNotices([]);
      return;
    }
    const fresh = newCommandedCancellations(known, data);
    if (fresh.length > 0) setNotices((prev) => [...fresh, ...prev]);
  }, [query.data, fecha]);

  return {
    orders: query.data ?? [],
    /** First load in flight: there is no list yet, so the box must not show a count. */
    isLoading: query.isLoading,
    /** The list could not be read and there is nothing earlier to show; never the same as "no cancellations". */
    isError: query.isError && !query.data,
    isFetching: query.isFetching,
    open,
    setOpen,
    notices,
    dismissNotice: (id: number) => setNotices((prev) => prev.filter((o) => o.id !== id)),
    /** "Ver cancelados": open the box, bring it into view and clear the notices. */
    showCancelled: () => {
      setOpen(true);
      setNotices([]);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(CANCELLED_BOX_ID)?.scrollIntoView?.({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
