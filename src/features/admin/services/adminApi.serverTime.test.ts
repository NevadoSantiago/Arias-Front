import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { getServerTime } from './adminApi';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

describe('getServerTime', () => {
  afterEach(() => vi.clearAllMocks());

  it('reads the server clock', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { now: '2026-03-10T12:00:30-03:00' } });
    await expect(getServerTime()).resolves.toEqual({ now: '2026-03-10T12:00:30-03:00' });
    expect(api.get).toHaveBeenCalledWith('/api/v1/admin/server-time');
  });
});
