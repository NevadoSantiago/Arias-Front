import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '../store/authStore';
import { googleLogin } from '../services/authApi';

function fakeCredential(email: string): string {
  const b64url = (v: string) => btoa(v).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify({ email }))}.sig`;
}

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential?: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: fakeCredential('ana@empresa.com') })}>
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

async function renderRegister() {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
  const { RegisterForm } = await import('./RegisterForm');
  return render(
    <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <RegisterForm />
    </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RegisterForm — Google excluded account', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
    vi.unstubAllEnvs();
    vi.mocked(googleLogin).mockReset();
  });

  it('explains that registering is not needed and links to the login with the email', async () => {
    vi.mocked(googleLogin).mockRejectedValueOnce({
      response: { status: 403, data: { title: 'GOOGLE_ACCOUNT_NOT_ALLOWED' } },
    });
    await renderRegister();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Tu cuenta es de empresa.')).toBeInTheDocument();
    expect(screen.getByText(/No hace falta registrarte/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toHaveAttribute(
      'href',
      '/login?email=ana%40empresa.com',
    );
  });

  it('shows the generic error for other failures and no login link', async () => {
    vi.mocked(googleLogin).mockRejectedValueOnce(new Error('boom'));
    await renderRegister();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('No pudimos iniciar sesión con Google. Probá de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ir a iniciar sesión' })).not.toBeInTheDocument();
  });
});
