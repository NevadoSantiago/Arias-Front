import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { checkEmail } from '@/features/auth/services/authApi';

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: () => <button type="button">Continuar con Google</button>,
}));

vi.mock('@/features/auth/services/authApi', () => ({
  login: vi.fn(),
  firstLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  googleLogin: vi.fn(),
  checkEmail: vi.fn(),
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

async function renderLogin(entry: string) {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
  const { LoginPage } = await import('./LoginPage');
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage — ?email= deep link resolves account status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mocked(checkEmail).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('NOT_FOUND lands on the email step with the email filled in and the notice shown', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'NOT_FOUND' });
    await renderLogin('/login?email=nuevo@example.com');

    expect(await screen.findByText('No encontramos una cuenta con ese email')).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('nuevo@example.com');
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/register?email=nuevo%40example.com',
    );
  });

  it('GOOGLE lands on the email step with the notice and the Google button highlighted', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'GOOGLE' });
    await renderLogin('/login?email=ana@gmail.com');

    expect(await screen.findByText('Tu cuenta entra con Google')).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@gmail.com');
    const highlighted = screen.getByRole('button', { name: /continuar con google/i }).closest('[data-highlighted]');
    expect(highlighted).toHaveAttribute('data-highlighted', 'true');
  });

  it('PASSWORD keeps going straight to the password step', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: false, status: 'PASSWORD' });
    await renderLogin('/login?email=ana@example.com');

    expect(await screen.findByText('Bienvenido de vuelta')).toBeInTheDocument();
  });

  it('FIRST_LOGIN keeps going straight to the first-login step', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: true, status: 'FIRST_LOGIN' });
    await renderLogin('/login?email=ana@empresa.com');

    expect(await screen.findByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it('without status falls back to requiresFirstLogin', async () => {
    vi.mocked(checkEmail).mockResolvedValueOnce({ requiresFirstLogin: true });
    await renderLogin('/login?email=ana@empresa.com');

    expect(await screen.findByLabelText(/nombre/i)).toBeInTheDocument();
  });
});
