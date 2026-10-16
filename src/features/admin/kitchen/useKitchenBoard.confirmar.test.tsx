import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  getOrdersByPickup,
  getRestaurantConfigAdmin,
  markOrdersConfirmado,
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
    markOrdersConfirmado: vi.fn(),
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useKitchenBoard confirmar', () => {
  beforeEach(() => {
    vi.mocked(getOrdersByPickup).mockResolvedValue([]);
    vi.mocked(getRestaurantConfigAdmin).mockReturnValue(new Promise(() => {}));
    vi.mocked(markOrdersConfirmado).mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it('confirms the orders, refetches the list and offers no undo', async () => {
    const { result } = renderHook(() => useKitchenBoard(), { wrapper });
    await waitFor(() => expect(getOrdersByPickup).toHaveBeenCalledTimes(1));

    act(() => result.current.confirmar([{ id: 5 }, { id: 6 }] as BoardOrder[]));

    await waitFor(() => expect(markOrdersConfirmado).toHaveBeenCalledWith([5, 6]));
    await waitFor(() => expect(getOrdersByPickup).toHaveBeenCalledTimes(2));
    expect(result.current.undo).toBeNull();
  });
});
