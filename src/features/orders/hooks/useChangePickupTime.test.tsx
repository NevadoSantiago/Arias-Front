import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { changeOrderPickupTimeV2, type OrderV2 } from '../services/ordersApi';
import { useChangePickupTime } from './useChangePickupTime';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../services/ordersApi', async () => {
  const actual = await vi.importActual<typeof import('../services/ordersApi')>('../services/ordersApi');
  return { ...actual, changeOrderPickupTimeV2: vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const order: OrderV2 = {
  id: 9,
  fecha: '2099-09-25',
  pickupAt: '2099-09-25T16:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};
const updated: OrderV2 = { ...order, pickupAt: '2099-09-25T16:10:00Z' };

describe('useChangePickupTime — inline notice (F29)', () => {
  afterEach(() => vi.clearAllMocks());

  it('hands the message and the updated order to the page instead of showing a toast', async () => {
    const onNotice = vi.fn();
    vi.mocked(changeOrderPickupTimeV2).mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useChangePickupTime({ onNotice }), { wrapper });

    act(() => result.current.requestChange(order));
    act(() => result.current.confirmChange(updated.pickupAt));

    await waitFor(() => expect(onNotice).toHaveBeenCalled());
    expect(onNotice.mock.calls[0][0]).toMatchObject({
      title: 'Horario cambiado',
      text: expect.stringMatching(/^Retirás tu pedido el .* a las 13:10 hs\.$/),
    });
    expect(onNotice.mock.calls[0][1]).toEqual(updated);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps the toast when the page gives no listener', async () => {
    vi.mocked(changeOrderPickupTimeV2).mockResolvedValueOnce(updated);
    const { result } = renderHook(() => useChangePickupTime(), { wrapper });

    act(() => result.current.requestChange(order));
    act(() => result.current.confirmChange(updated.pickupAt));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Horario cambiado', expect.anything()));
  });
});
