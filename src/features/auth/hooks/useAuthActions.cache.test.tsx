import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { completeProfile, googleLogin, logout, me, verifyEmail } from '../services/authApi';
import { useAuthActions } from './useAuthActions';

vi.mock('../services/authApi', () => ({
  login: vi.fn(),
  firstLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  googleLogin: vi.fn(),
  completeProfile: vi.fn(),
}));

const user = {
  id: 1,
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: null,
  nickname: null,
  displayName: 'Ana',
  role: 'EMPLOYEE' as const,
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const clear = vi.spyOn(queryClient, 'clear');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => useAuthActions(), { wrapper });
  return { result, invalidate, clear };
}

describe('useAuthActions — cache freshness', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
    vi.clearAllMocks();
  });

  it('refreshes the wallet after a Google sign-in', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 't', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce(user);
    const { result, invalidate } = setup();
    await result.current.performGoogleLogin('id');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditMovements'] });
  });

  it('refreshes the wallet after verifying the email', async () => {
    vi.mocked(verifyEmail).mockResolvedValueOnce({ accessToken: 't', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce(user);
    const { result, invalidate } = setup();
    await result.current.performVerifyEmail('tok');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
  });

  it('refreshes the wallet after completing the profile', async () => {
    vi.mocked(completeProfile).mockResolvedValueOnce(user);
    const { result, invalidate } = setup();
    await result.current.performCompleteProfile({ phone: '1159876547', nickname: 'Ana' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsWallet'] });
  });

  it('clears the whole query cache on logout', async () => {
    vi.mocked(logout).mockResolvedValueOnce(undefined);
    const { result, clear } = setup();
    await result.current.performLogout();
    expect(clear).toHaveBeenCalled();
  });
});
