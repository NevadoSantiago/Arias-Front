import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { getPendingPurchases } from './creditsApi';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

describe('getPendingPurchases (D6)', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks the pending endpoint and returns the list as the backend sends it', async () => {
    const list = [
      {
        id: 'p1',
        type: 'DIRECT',
        creditAmount: 2,
        amountCents: 300000,
        currency: 'ARS',
        status: 'PENDING',
        createdAt: '2026-09-29T15:05:00Z',
        creditedAt: null,
        reversedAt: null,
        packNombre: null,
        orderId: 42,
        orderEstado: 'PENDIENTE_PAGO',
      },
    ];
    vi.mocked(api.get).mockResolvedValueOnce({ data: list });

    await expect(getPendingPurchases()).resolves.toEqual(list);
    expect(api.get).toHaveBeenCalledWith('/api/v1/credits/purchases/pending');
  });
});
