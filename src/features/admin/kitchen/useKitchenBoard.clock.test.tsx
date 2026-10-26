import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  getServerTime,
  type PickupOrder,
  type RestaurantConfig,
} from '@/features/admin/services/adminApi';
import { useKitchenBoard } from './useKitchenBoard';

vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return { ...actual, getOrdersByPickup: vi.fn(), getRestaurantConfigAdmin: vi.fn(), getServerTime: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const LOCAL_NOW = Date.UTC(2026, 9, 1, 15, 0, 0); // 12:00:00 in Buenos Aires
const flush = (ms = 0) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

const commanded = (id: number, hhmm: string): PickupOrder => ({
  id,
  customerNickname: `c${id}`,
  items: [],
  notas: null,
  estado: 'COMANDADO',
  pickupAt: new Date(Date.UTC(2026, 9, 1, Number(hhmm.slice(0, 2)) + 3, Number(hhmm.slice(3)))).toISOString(),
  comandadoAt: null,
  deliveredAt: null,
  printStatus: 'PRINTED',
  printedAt: null,
});

describe('useKitchenBoard — server clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(LOCAL_NOW);
    vi.mocked(getOrdersByPickup).mockResolvedValue([commanded(1, '12:30')]);
    vi.mocked(getRestaurantConfigAdmin).mockResolvedValue({
      timezone: 'America/Argentina/Buenos_Aires',
      pickupLeadMinutes: 60,
    } as RestaurantConfig);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('drives the board with the server time, not the PC clock', async () => {
    // The PC is 5 minutes behind the server.
    vi.mocked(getServerTime).mockResolvedValue({ now: new Date(LOCAL_NOW + 5 * 60_000).toISOString() });
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    expect(result.current.nowMs - Date.now()).toBe(5 * 60_000);
    expect(result.current.board?.groups[0].msUntil).toBe(25 * 60_000);
  });

  it('falls back to the local clock when the server time cannot be read', async () => {
    vi.mocked(getServerTime).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();

    expect(result.current.nowMs).toBe(Date.now());
    expect(result.current.board?.groups[0].msUntil).toBe(30 * 60_000);
  });

  it('ticks every second so the countdowns move', async () => {
    vi.mocked(getServerTime).mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await flush();
    const before = result.current.board?.groups[0].msUntil ?? 0;

    await flush(3_000);
    expect(result.current.board?.groups[0].msUntil).toBe(before - 3_000);
  });
});
