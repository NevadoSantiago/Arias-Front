import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { googleLogin, me } from '../services/authApi';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential?: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'fake-id-token' })}>
      Continuar con Google
    </button>
  ),
}));

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
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

const baseUser = {
  id: 1,
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: null,
  nickname: null,
  displayName: 'Test',
  role: 'EMPLOYEE' as const,
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

async function renderWithGoogleConfigured() {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
  const { RegisterForm } = await import('./RegisterForm');
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterForm />} />
          <Route path="/complete-profile" element={<p>Completar perfil</p>} />
          <Route path="/orders/today" element={<p>Home empleado</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterForm — Google welcome lunch is deferred until the profile is complete', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false, pendingWelcomeLunch: false });
    vi.unstubAllEnvs();
    vi.mocked(googleLogin).mockReset();
    vi.mocked(me).mockReset();
  });

  it('does not show the welcome screen after a granted Google sign-in; it goes to complete-profile and arms the flag', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce({ ...baseUser, profileComplete: false });

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Completar perfil')).toBeInTheDocument();
    expect(screen.queryByText(/¡listo, bienvenido a arias!/i)).not.toBeInTheDocument();
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(true);
  });

  it('goes straight to the home and leaves the flag off when the profile was already complete', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce(baseUser);

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Home empleado')).toBeInTheDocument();
    expect(screen.queryByText(/¡listo, bienvenido a arias!/i)).not.toBeInTheDocument();
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(false);
  });

  it('never arms the flag on a returning Google sign-in', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: false });
    vi.mocked(me).mockResolvedValueOnce({ ...baseUser, profileComplete: false });

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Completar perfil')).toBeInTheDocument();
    expect(useAuthStore.getState().pendingWelcomeLunch).toBe(false);
  });
});
