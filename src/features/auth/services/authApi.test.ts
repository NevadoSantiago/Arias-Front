import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { me } from './authApi';
import type { AuthUser } from '../store/authStore';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

describe('me', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // El nombre con el que la cocina llama al cliente (apodo → nombre + apellido
  // → email) lo resuelve el backend; el frontend solo lo transporta.
  it('returns the nickname and the always-present displayName of GET /auth/me', async () => {
    const user: AuthUser = {
      id: 7,
      email: 'sofi@example.com',
      firstName: 'Sofía',
      lastName: 'Pérez',
      nickname: 'Sofi',
      displayName: 'Sofi',
      role: 'EMPLOYEE',
      companyId: null,
      companyName: null,
      categoryId: null,
      emailVerified: true,
      profileComplete: true,
    };
    vi.mocked(api.get).mockResolvedValueOnce({ data: user });

    const result = await me();

    expect(api.get).toHaveBeenCalledWith('/api/v1/auth/me');
    expect(result.nickname).toBe('Sofi');
    expect(result.displayName).toBe('Sofi');
  });

  it('keeps a null nickname next to a displayName that falls back to the full name', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { id: 8, email: 'a@b.c', firstName: 'Ana', lastName: 'Gómez', nickname: null, displayName: 'Ana Gómez' },
    });

    const result = await me();

    expect(result.nickname).toBeNull();
    expect(result.displayName).toBe('Ana Gómez');
  });
});
