import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { getRestaurantConfig } from './ordersApi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));

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
  });
});
