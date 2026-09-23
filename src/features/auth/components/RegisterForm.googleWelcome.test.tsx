import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>,
  );
}

describe('RegisterForm — Google welcome-lunch congratulations screen', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
    vi.unstubAllEnvs();
    vi.mocked(googleLogin).mockReset();
    vi.mocked(me).mockReset();
  });

  it('shows the welcome-lunch screen when the backend grants it on first-time Google sign-in', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce(baseUser);

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText(/¡listo, bienvenido a arias!/i)).toBeInTheDocument();
    expect(screen.getByText(/iniciaste sesión con google/i)).toBeInTheDocument();
  });

  it('never shows the welcome-lunch screen on a returning Google sign-in', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: false });
    vi.mocked(me).mockResolvedValueOnce(baseUser);

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/¡listo, bienvenido a arias!/i)).not.toBeInTheDocument();
  });

  it('never derives the welcome-lunch flag from /me — only the exact googleLogin response controls it', async () => {
    // /me never reports welcomeLunchGranted (it doesn't have that field) — this
    // asserts the screen is driven strictly by the googleLogin response.
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce({ ...baseUser, profileComplete: false });

    await renderWithGoogleConfigured();
    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText(/¡listo, bienvenido a arias!/i)).toBeInTheDocument();
  });
});
