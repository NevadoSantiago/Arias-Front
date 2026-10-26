import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  getServerTime,
  markOrdersComandado,
  markOrdersEntregado,
  reprintOrder,
  type PickupOrder,
} from '@/features/admin/services/adminApi';
import type { BoardOrder } from './kitchenBoard';
import { useKitchenBoard } from './useKitchenBoard';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return {
    ...actual,
    getOrdersByPickup: vi.fn(),
    getRestaurantConfigAdmin: vi.fn(),
    getServerTime: vi.fn(),
    markOrdersComandado: vi.fn(),
    markOrdersEntregado: vi.fn(),
    reprintOrder: vi.fn(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const order = (id: number, printStatus: PickupOrder['printStatus']): PickupOrder => ({
  id,
  customerNickname: `c${id}`,
  items: [],
  notas: null,
  estado: 'COMANDADO',
  pickupAt: '2026-10-01T15:10:00Z',
  comandadoAt: null,
  deliveredAt: null,
  printStatus,
  printedAt: null,
});

const flush = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useKitchenBoard — undo timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getOrdersByPickup).mockResolvedValue([]);
    vi.mocked(getRestaurantConfigAdmin).mockReturnValue(new Promise(() => {}));
    vi.mocked(getServerTime).mockReturnValue(new Promise(() => {}));
    vi.mocked(markOrdersComandado).mockResolvedValue(undefined);
    vi.mocked(markOrdersEntregado).mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('commands one order and raises no undo bar: commanding cannot be undone', async () => {
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    act(() => result.current.comandar({ id: 1 } as BoardOrder));
    await flush();
    expect(markOrdersComandado).toHaveBeenCalledWith([1]);
    expect(result.current.undo).toBeNull();
  });

  it('keeps the undo bar 20 s for every other move', async () => {
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    act(() => result.current.entregar([{ id: 1 }] as BoardOrder[]));
    await flush();
    expect(result.current.undo).toMatchObject({ secondsLeft: 20 });

    await flush(19_900);
    expect(result.current.undo).not.toBeNull();
    await flush(200);
    expect(result.current.undo).toBeNull();
  });
});

describe('useKitchenBoard — print polling and reprint', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getRestaurantConfigAdmin).mockReturnValue(new Promise(() => {}));
    vi.mocked(getServerTime).mockReturnValue(new Promise(() => {}));
    vi.mocked(markOrdersComandado).mockResolvedValue(undefined);
    vi.mocked(reprintOrder).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('polls every 5 s while an order is QUEUED', async () => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([order(1, 'QUEUED')]);
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();
    expect(getOrdersByPickup).toHaveBeenCalledTimes(1);
    expect(result.current.queuedCount).toBe(1);

    await flush(5_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);
    await flush(5_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(3);
  });

  it('falls back to 60 s once nothing is QUEUED', async () => {
    vi.mocked(getOrdersByPickup)
      .mockResolvedValueOnce([order(1, 'QUEUED')])
      .mockResolvedValue([order(1, 'PRINTED')]);
    renderHook(() => useKitchenBoard(), { wrapper });
    await flush();
    await flush(5_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);

    await flush(55_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);
    await flush(5_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(3);
  });

  it('keeps the 60 s poll when no order is QUEUED', async () => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([order(1, 'FAILED')]);
    renderHook(() => useKitchenBoard(), { wrapper });
    await flush();
    await flush(30_000);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(1);
  });

  it('refetches right after comandar', async () => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([]);
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    act(() => result.current.comandar({ id: 1 } as BoardOrder));
    await flush();
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);
  });

  it('reprints, refetches and flags the order briefly', async () => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([order(9, 'FAILED')]);
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    act(() => result.current.reprint({ id: 9 } as BoardOrder));
    await flush();
    expect(reprintOrder).toHaveBeenCalledWith(9);
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);
    expect(result.current.reprinted.has(9)).toBe(true);

    await flush(2_600);
    expect(result.current.reprinted.has(9)).toBe(false);
  });

  it('tells the admin when the reprint fails and does not flag the order', async () => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([order(9, 'FAILED')]);
    vi.mocked(reprintOrder).mockRejectedValueOnce(new Error('409'));
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    act(() => result.current.reprint({ id: 9 } as BoardOrder));
    await flush();
    expect(toast.error).toHaveBeenCalledWith('No se pudo reimprimir la comanda. Revisá el tablero e intentá de nuevo.');
    expect(result.current.reprinted.has(9)).toBe(false);
  });
});
