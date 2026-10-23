import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import {
  getPrintAgentStatus, listPrinters, reprintOrder, updatePrinter,
} from './adminApi';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe('printing api', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists the printers', async () => {
    const rows = [{ station: 'COCINA', host: '192.168.0.121', port: 9100, updatedAt: '2026-10-23T12:00:00Z' }];
    vi.mocked(api.get).mockResolvedValueOnce({ data: rows });
    await expect(listPrinters()).resolves.toEqual(rows);
    expect(api.get).toHaveBeenCalledWith('/api/v1/admin/print/printers');
  });

  it('updates one printer by station', async () => {
    const row = { station: 'PARRILLA', host: '192.168.0.120', port: 9100, updatedAt: 'x' };
    vi.mocked(api.put).mockResolvedValueOnce({ data: row });
    await expect(updatePrinter('PARRILLA', { host: '192.168.0.120', port: 9100 })).resolves.toEqual(row);
    expect(api.put).toHaveBeenCalledWith('/api/v1/admin/print/printers/PARRILLA', {
      host: '192.168.0.120',
      port: 9100,
    });
  });

  it('reads the agent status', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { lastSeenAt: null, online: false } });
    await expect(getPrintAgentStatus()).resolves.toEqual({ lastSeenAt: null, online: false });
    expect(api.get).toHaveBeenCalledWith('/api/v1/admin/print/agent');
  });

  it('reprints an order', async () => {
    const jobs = [{ id: 1, station: 'COCINA', status: 'QUEUED', availableAt: 'x' }];
    vi.mocked(api.post).mockResolvedValueOnce({ data: jobs });
    await expect(reprintOrder(42)).resolves.toEqual(jobs);
    expect(api.post).toHaveBeenCalledWith('/api/v1/admin/orders/42/print');
  });
});
