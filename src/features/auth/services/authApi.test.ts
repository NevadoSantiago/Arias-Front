import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { checkEmail, me, updateNickname } from './authApi';
import type { AuthUser } from '../store/authStore';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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

describe('updateNickname', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('PATCHes /auth/me with the nickname and returns the updated user', async () => {
    const updated = { id: 7, nickname: 'Sofi', displayName: 'Sofi' } as AuthUser;
    vi.mocked(api.patch).mockResolvedValue({ data: updated });
    await expect(updateNickname('Sofi')).resolves.toBe(updated);
    expect(api.patch).toHaveBeenCalledWith('/api/v1/auth/me', { nickname: 'Sofi' });
  });
});

describe('checkEmail', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('posts the email and returns the account status of check-email', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { requiresFirstLogin: false, status: 'NOT_FOUND' } });

    const result = await checkEmail('nuevo@example.com');

    expect(api.post).toHaveBeenCalledWith('/api/v1/auth/check-email', { email: 'nuevo@example.com' });
    expect(result.status).toBe('NOT_FOUND');
    expect(result.requiresFirstLogin).toBe(false);
  });
});
