import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPendingPurchases } from '../services/creditsApi';
import { PENDING_PURCHASES_KEY, usePendingPurchases } from './usePendingPurchases';

vi.mock('../services/creditsApi', () => ({ getPendingPurchases: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('usePendingPurchases (D6)', () => {
  afterEach(() => vi.clearAllMocks());

  it('exposes the pending purchases from the API', async () => {
    vi.mocked(getPendingPurchases).mockResolvedValueOnce([]);
    const { result } = renderHook(() => usePendingPurchases(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('uses a stable query key so other flows can invalidate it', () => {
    expect(PENDING_PURCHASES_KEY).toEqual(['creditsPendingPurchases']);
  });
});
