import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { markOrdersConfirmado } from './adminApi';

vi.mock('@/lib/api', () => ({ api: { put: vi.fn() } }));

describe('markOrdersConfirmado', () => {
  afterEach(() => vi.clearAllMocks());

  it('uses the single endpoint for one id', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });
    await markOrdersConfirmado([7]);
    expect(api.put).toHaveBeenCalledWith('/api/v1/admin/orders/7/confirmar');
  });

  it('uses the all-or-nothing batch endpoint for several ids', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });
    await markOrdersConfirmado([1, 2]);
    expect(api.put).toHaveBeenCalledWith('/api/v1/admin/orders/confirmar', { orderIds: [1, 2] });
  });
});
