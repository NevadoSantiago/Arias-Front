import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  addOrderItemsV2,
  changeOrderPickupTimeV2,
  DirectCheckoutNotResumableError,
  DirectCheckoutUnavailableError,
  getPickupSlots,
  getRestaurantConfig,
  InsufficientCreditsError,
  OrderNotModifiableError,
  PickupTimeChangeError,
  placeOrderV2,
  removeOrderItemV2,
  resumeDirectCheckoutV2,
  startDirectCheckoutV2,
} from './ordersApi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() },
}));

describe('getPickupSlots', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Bug real: el backend expone GET /api/v1/orders/pickup-slots
  // (`OrderController`, bajo @RequestMapping("/api/v1/orders")), nunca
  // /api/v1/pickup-slots. La URL vieja devolvía 404 y la pantalla mostraba
  // "No pudimos cargar los horarios de retiro" — pasó desapercibido porque
  // los tests de los componentes mockean el módulo del servicio entero.
  it('requests /api/v1/orders/pickup-slots with the date as a query param', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: ['2026-05-21T14:00:00Z'] });

    await getPickupSlots('2026-05-21');

    expect(api.get).toHaveBeenCalledWith('/api/v1/orders/pickup-slots', {
      params: { fecha: '2026-05-21' },
    });
  });
});

describe('getRestaurantConfig', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('trims horaCorte and the pickup window to "HH:MM" when the backend sends them', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        horaCorte: '10:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        pickupWindowStart: '11:00:00',
        pickupWindowEnd: '23:00:00',
      },
    });

    const config = await getRestaurantConfig();

    expect(config).toEqual({
      horaCorte: '10:00',
      pickupWindowStart: '11:00',
      pickupWindowEnd: '23:00',
    });
  });

  it('does not throw and returns null window fields when pickupWindowStart/End are missing', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        horaCorte: '10:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        pickupWindowStart: null,
        pickupWindowEnd: null,
      },
    });

    const config = await getRestaurantConfig();

    expect(config).toEqual({
      horaCorte: '10:00',
      pickupWindowStart: null,
      pickupWindowEnd: null,
    });
  });

  it('does not throw and returns null window fields when they are absent from the response entirely', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { horaCorte: '10:00:00', timezone: 'America/Argentina/Buenos_Aires' },
    });

    const config = await getRestaurantConfig();

    expect(config.pickupWindowStart).toBeNull();
    expect(config.pickupWindowEnd).toBeNull();
    expect(config.pickupSchedule).toBeUndefined();
  });

  // B5/F14: la franja por día de la semana reemplaza a pickupWindowStart/End
  // como fuente de verdad — normaliza "HH:MM:SS" a "HH:MM" igual que los
  // demás campos de horario, y tolera null en los horarios de un día cerrado.
  it('normalizes pickupSchedule window times to "HH:MM" and keeps null times for closed days', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        horaCorte: '10:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        pickupWindowStart: '11:00:00',
        pickupWindowEnd: '23:00:00',
        pickupSchedule: [
          { dayOfWeek: 1, open: true, windowStart: '08:00:00', windowEnd: '20:00:00' },
          { dayOfWeek: 7, open: false, windowStart: null, windowEnd: null },
        ],
      },
    });

    const config = await getRestaurantConfig();

    expect(config.pickupSchedule).toEqual([
      { dayOfWeek: 1, open: true, windowStart: '08:00', windowEnd: '20:00' },
      { dayOfWeek: 7, open: false, windowStart: null, windowEnd: null },
    ]);
  });

  it('tolerates a backend without pickupSchedule (older backend)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        horaCorte: '10:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        pickupWindowStart: '11:00:00',
        pickupWindowEnd: '23:00:00',
      },
    });

    const config = await getRestaurantConfig();

    expect(config.pickupSchedule).toBeUndefined();
  });

  // F18: `pickupLeadMinutes` ya viaja en la respuesta pública (el backend lo
  // expone desde antes, unidad 8) pero el frontend no lo mapeaba — hace
  // falta para el aviso de corte de "Pago pendiente".
  it('passes pickupLeadMinutes through when the backend sends it', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        horaCorte: '10:00:00',
        timezone: 'America/Argentina/Buenos_Aires',
        pickupWindowStart: '11:00:00',
        pickupWindowEnd: '23:00:00',
        pickupLeadMinutes: 20,
      },
    });

    const config = await getRestaurantConfig();

    expect(config.pickupLeadMinutes).toBe(20);
  });

  it('leaves pickupLeadMinutes undefined when the backend omits it', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { horaCorte: '10:00:00', timezone: 'America/Argentina/Buenos_Aires' },
    });

    const config = await getRestaurantConfig();

    expect(config.pickupLeadMinutes).toBeUndefined();
  });
});

// F18 (backend B7): pagar un pedido nuevo directo con Mercado Pago, y
// retomar un pago abandonado.
describe('startDirectCheckoutV2', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /api/v2/orders/direct-checkout with the same body as placeOrderV2', async () => {
    const checkout = { orderId: 7, purchaseId: 'p-1', initPoint: 'https://mp.example/checkout/p-1' };
    vi.mocked(api.post).mockResolvedValueOnce({ data: checkout });

    const result = await startDirectCheckoutV2({
      items: [{ dishId: 10, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
    });

    expect(api.post).toHaveBeenCalledWith('/api/v2/orders/direct-checkout', {
      items: [{ dishId: 10, sideId: null, notas: null }],
      pickupAt: '2026-05-21T15:00:00Z',
      notas: null,
    });
    expect(result).toEqual(checkout);
  });

  it('maps a 503 direct-purchase-unavailable response to DirectCheckoutUnavailableError', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { title: 'direct-purchase-unavailable' } } });

    await expect(
      startDirectCheckoutV2({ items: [], pickupAt: '2026-05-21T15:00:00Z', notas: null }),
    ).rejects.toBeInstanceOf(DirectCheckoutUnavailableError);
  });
});

describe('resumeDirectCheckoutV2', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GETs /api/v2/orders/{id}/direct-checkout', async () => {
    const checkout = { orderId: 7, purchaseId: 'p-1', initPoint: 'https://mp.example/checkout/p-1' };
    vi.mocked(api.get).mockResolvedValueOnce({ data: checkout });

    const result = await resumeDirectCheckoutV2(7);

    expect(api.get).toHaveBeenCalledWith('/api/v2/orders/7/direct-checkout');
    expect(result).toEqual(checkout);
  });

  it('maps a 409 order-not-awaiting-payment response to DirectCheckoutNotResumableError', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { data: { title: 'order-not-awaiting-payment' } } });

    await expect(resumeDirectCheckoutV2(7)).rejects.toBeInstanceOf(DirectCheckoutNotResumableError);
  });

  it('maps a 409 direct-checkout-not-resumable response to DirectCheckoutNotResumableError', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ response: { data: { title: 'direct-checkout-not-resumable' } } });

    await expect(resumeDirectCheckoutV2(7)).rejects.toBeInstanceOf(DirectCheckoutNotResumableError);
  });
});

// F16: agregar/quitar ítems de un pedido v2 existente (backend B6).
describe('addOrderItemsV2', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('POSTs to /api/v2/orders/{id}/items with the items in the body', async () => {
    const order = {
      id: 5,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'PENDIENTE',
      creditTotal: 4,
      notas: null,
      items: [],
      cancellable: true,
      modifiable: true,
      pickupTimeChangeable: true,
    };
    vi.mocked(api.post).mockResolvedValueOnce({ data: order });

    const result = await addOrderItemsV2(5, [{ dishId: 10, sideId: null, notas: null }]);

    expect(api.post).toHaveBeenCalledWith('/api/v2/orders/5/items', {
      items: [{ dishId: 10, sideId: null, notas: null }],
    });
    expect(result).toEqual(order);
  });

  it('maps a 409 insufficient-credits response to InsufficientCreditsError', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { title: 'insufficient-credits' } } });

    await expect(addOrderItemsV2(5, [{ dishId: 10, sideId: null, notas: null }])).rejects.toBeInstanceOf(
      InsufficientCreditsError,
    );
  });

  it('maps a 409 order-not-modifiable response to OrderNotModifiableError', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { title: 'order-not-modifiable' } } });

    await expect(addOrderItemsV2(5, [{ dishId: 10, sideId: null, notas: null }])).rejects.toBeInstanceOf(
      OrderNotModifiableError,
    );
  });
});

describe('removeOrderItemV2', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('DELETEs /api/v2/orders/{id}/items/{itemId}', async () => {
    const order = {
      id: 5,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:00:00Z',
      estado: 'CANCELADO',
      creditTotal: 0,
      notas: null,
      items: [],
      cancellable: false,
      modifiable: false,
      pickupTimeChangeable: false,
    };
    vi.mocked(api.delete).mockResolvedValueOnce({ data: order });

    const result = await removeOrderItemV2(5, 42);

    expect(api.delete).toHaveBeenCalledWith('/api/v2/orders/5/items/42');
    expect(result).toEqual(order);
  });

  it('maps a 409 order-not-modifiable response to OrderNotModifiableError', async () => {
    vi.mocked(api.delete).mockRejectedValueOnce({ response: { data: { title: 'order-not-modifiable' } } });

    await expect(removeOrderItemV2(5, 42)).rejects.toBeInstanceOf(OrderNotModifiableError);
  });
});

describe('changeOrderPickupTimeV2', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes /api/v2/orders/{id}/pickup-time with { pickupAt } and returns the updated order', async () => {
    const order = {
      id: 5,
      fecha: '2026-05-21',
      pickupAt: '2026-05-21T15:30:00Z',
      estado: 'PENDIENTE',
      creditTotal: 2,
      notas: null,
      items: [],
      cancellable: true,
      modifiable: true,
      pickupTimeChangeable: true,
    };
    vi.mocked(api.patch).mockResolvedValueOnce({ data: order });

    const result = await changeOrderPickupTimeV2(5, '2026-05-21T15:30:00Z');

    expect(api.patch).toHaveBeenCalledWith('/api/v2/orders/5/pickup-time', { pickupAt: '2026-05-21T15:30:00Z' });
    expect(result).toEqual(order);
  });

  it('surfaces the backend message of a 409 pickup-time-locked as PickupTimeChangeError', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce({
      response: { data: { title: 'pickup-time-locked', detail: 'El horario de retiro ya no se puede cambiar.' } },
    });

    const error = await changeOrderPickupTimeV2(5, '2026-05-21T15:30:00Z').catch((e) => e);

    expect(error).toBeInstanceOf(PickupTimeChangeError);
    expect(error.message).toBe('El horario de retiro ya no se puede cambiar.');
  });

  it.each(['pickup-day-change-not-allowed', 'pickup-out-of-range', 'pickup-too-soon', 'pickup-time-not-aligned'])(
    'maps %s to PickupTimeChangeError with a Spanish fallback when the backend sends no detail',
    async (title) => {
      vi.mocked(api.patch).mockRejectedValueOnce({ response: { data: { title } } });

      const error = await changeOrderPickupTimeV2(5, '2026-05-21T15:30:00Z').catch((e) => e);

      expect(error).toBeInstanceOf(PickupTimeChangeError);
      expect(error.message).toBe('No pudimos cambiar el horario de retiro.');
    },
  );

  // F19.1: el mapeo `pickup-*` → PickupTimeChangeError es solo del cambio de horario.
  it('keeps the previous behaviour when placing or adding items with a pickup-* error (no pickup-change mapping)', async () => {
    vi.mocked(api.post).mockRejectedValue({ response: { data: { title: 'pickup-too-soon' } } });

    const placed = await placeOrderV2({ items: [], pickupAt: '2026-05-21T15:00:00Z', notas: null }).catch((e) => e);
    const added = await addOrderItemsV2(5, []).catch((e) => e);

    for (const error of [placed, added]) {
      expect(error).not.toBeInstanceOf(PickupTimeChangeError);
      expect(error.message).toBe('Error de red');
    }
    vi.mocked(api.post).mockReset();
  });
});
