import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRestaurantConfig } from '@/features/orders/services/ordersApi';
import { DEFAULT_EXPIRY_DAYS } from '../purchaseModel';
import { useCreditExpiryDays } from './useCreditExpiryDays';

vi.mock('@/features/orders/services/ordersApi', () => ({ getRestaurantConfig: vi.fn() }));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function config(creditExpiryDays: unknown) {
  return { horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null, creditExpiryDays } as never;
}

describe('useCreditExpiryDays', () => {
  beforeEach(() => vi.mocked(getRestaurantConfig).mockReset());

  it('uses the configured days when it is a positive integer', async () => {
    vi.mocked(getRestaurantConfig).mockResolvedValue(config(30));
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreditExpiryDays(), { wrapper });
    await waitFor(() => expect(result.current).toBe(30));
  });

  it.each([0, -5, 2.5, '30', Number.NaN, null])('falls back to the default for %s', async (value) => {
    vi.mocked(getRestaurantConfig).mockResolvedValue(config(value));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useCreditExpiryDays(), { wrapper });
    // Se espera a que la query resuelva con el valor recibido: recién ahí el
    // default demuestra que el valor inválido se descartó, no que aún no llegó.
    await waitFor(() => expect(queryClient.getQueryState(['restaurantConfig'])?.status).toBe('success'));
    expect(queryClient.getQueryData(['restaurantConfig'])).toMatchObject({ creditExpiryDays: value });
    expect(result.current).toBe(DEFAULT_EXPIRY_DAYS);
  });
});
