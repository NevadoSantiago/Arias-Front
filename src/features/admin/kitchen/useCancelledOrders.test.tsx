import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getCancelledOrders, type CancelledOrder } from '@/features/admin/services/adminApi';
import { useCancelledOrders } from './useCancelledOrders';
import { ORDERS_POLL_MS } from './useKitchenBoard';

vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return { ...actual, getCancelledOrders: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const cancelled = (id: number, extra: Partial<CancelledOrder> = {}): CancelledOrder => ({
  id,
  customerNickname: `alias${id}`,
  items: [],
  notas: null,
  pickupAt: '2026-10-28T16:00:00Z',
  comandadoAt: null,
  cancelledAt: '2026-10-28T15:00:00Z',
  cancelRefunded: true,
  cancelReason: 'CUSTOMER',
  ...extra,
});
const commanded = (id: number) => cancelled(id, { comandadoAt: '2026-10-28T15:30:00Z' });

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
const poll = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ORDERS_POLL_MS);
    // react-query notifies observers on a 0 ms timeout after the fetch resolves.
    await vi.advanceTimersByTimeAsync(10);
  });

describe('useCancelledOrders', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getCancelledOrders).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('reads the cancelled orders of the day and polls them at the board rate', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValue([cancelled(1)]);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();

    expect(getCancelledOrders).toHaveBeenCalledWith('2026-10-28');
    expect(result.current.orders.map((o) => o.id)).toEqual([1]);

    await poll();
    expect(getCancelledOrders).toHaveBeenCalledTimes(2);
  });

  it('reports loading, then an error (not an empty list) when the fetch is rejected', async () => {
    vi.mocked(getCancelledOrders).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    expect(result.current.isLoading).toBe(true);
    await flush();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(true);
  });

  it('does not ask for anything while disabled (another day is shown)', async () => {
    renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: false }), { wrapper });
    await flush();

    expect(getCancelledOrders).not.toHaveBeenCalled();
  });

  it('starts collapsed and raises no notice for orders already cancelled when the page loaded', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValue([commanded(1)]);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();

    expect(result.current.open).toBe(false);
    expect(result.current.notices).toEqual([]);
  });

  it('raises a notice when a refresh reveals a newly cancelled order that was already commanded', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValueOnce([]).mockResolvedValue([commanded(5)]);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();
    await poll();

    expect(result.current.notices.map((o) => o.id)).toEqual([5]);
  });

  it('raises no notice for a new cancellation that was not commanded yet, nor twice for the same order', async () => {
    vi.mocked(getCancelledOrders)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([cancelled(4)])
      .mockResolvedValue([cancelled(4), commanded(5)]);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();
    await poll();
    expect(result.current.notices).toEqual([]);

    await poll();
    await poll();
    expect(result.current.notices.map((o) => o.id)).toEqual([5]);
  });

  it('dismisses one notice, and "Ver cancelados" opens the box and clears the notices', async () => {
    vi.mocked(getCancelledOrders).mockResolvedValueOnce([]).mockResolvedValue([commanded(5), commanded(6)]);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();
    await poll();
    expect(result.current.notices).toHaveLength(2);

    act(() => result.current.dismissNotice(5));
    expect(result.current.notices.map((o) => o.id)).toEqual([6]);

    act(() => result.current.showCancelled());
    expect(result.current.open).toBe(true);
    expect(result.current.notices).toEqual([]);
  });

  it('scrolls the box into view on "Ver cancelados"', async () => {
    const scrollIntoView = vi.fn();
    const box = document.createElement('section');
    box.id = 'kb-cancelled';
    box.scrollIntoView = scrollIntoView;
    document.body.appendChild(box);
    const { result } = renderHook(() => useCancelledOrders({ fecha: '2026-10-28', enabled: true }), { wrapper });
    await flush();

    act(() => result.current.showCancelled());

    expect(scrollIntoView).toHaveBeenCalled();
    box.remove();
  });
});
