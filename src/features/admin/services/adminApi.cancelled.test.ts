import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { getCancelledOrders, type CancelledOrder } from './adminApi';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

describe('getCancelledOrders', () => {
  afterEach(() => vi.clearAllMocks());

  it('reads the orders cancelled on a pickup day, as the flat list the backend sends', async () => {
    const list: CancelledOrder[] = [
      {
        id: 7,
        customerNickname: 'Sofi',
        items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
        notas: null,
        pickupAt: '2026-10-28T16:00:00Z',
        comandadoAt: null,
        cancelledAt: '2026-10-28T13:15:00Z',
        cancelRefunded: true,
        cancelReason: 'CUSTOMER',
      },
    ];
    vi.mocked(api.get).mockResolvedValueOnce({ data: list });

    await expect(getCancelledOrders('2026-10-28')).resolves.toEqual(list);
    expect(api.get).toHaveBeenCalledWith('/api/v1/admin/orders/by-pickup/cancelled', {
      params: { fecha: '2026-10-28' },
    });
  });
});
