import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { getOrdersByPickup, getRestaurantConfigAdmin } from '@/features/admin/services/adminApi';
import { useKitchenBoard } from './useKitchenBoard';

vi.mock('@/features/admin/services/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  );
  return { ...actual, getOrdersByPickup: vi.fn(), getRestaurantConfigAdmin: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useKitchenBoard polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getOrdersByPickup).mockResolvedValue([]);
    vi.mocked(getRestaurantConfigAdmin).mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('asks the backend for the orders once a minute', async () => {
    renderHook(() => useKitchenBoard(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getOrdersByPickup).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000);
    });
    expect(getOrdersByPickup).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(getOrdersByPickup).toHaveBeenCalledTimes(2);
  });
});
