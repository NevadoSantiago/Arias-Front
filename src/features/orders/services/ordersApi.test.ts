import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  addOrderItemsV2,
  getPickupSlots,
  getRestaurantConfig,
  InsufficientCreditsError,
  OrderNotModifiableError,
  removeOrderItemV2,
} from './ordersApi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
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
