import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/features/auth/store/authStore';
import { checkEmail, googleLogin, me } from '@/features/auth/services/authApi';

const googleLoginProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  GoogleLogin: (props: {
    onSuccess: (r: { credential?: string }) => void;
    onError: () => void;
  }) => {
    googleLoginProps.current = props as unknown as Record<string, unknown>;
    return (
      <>
        <button type="button" onClick={() => props.onSuccess({ credential: fakeCredential('ana@empresa.com') })}>
          Continuar con Google
        </button>
        <button type="button" onClick={() => props.onError()}>
          Fallar Google
        </button>
      </>
    );
  },
}));

vi.mock('@/features/auth/services/authApi', () => ({
  login: vi.fn(),
  firstLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  googleLogin: vi.fn(),
  completeProfile: vi.fn(),
  checkEmail: vi.fn(),
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

function fakeCredential(email: string): string {
  const b64url = (v: string) => btoa(v).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify({ email }))}.sig`;
}

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

async function renderLogin(initialEntry = '/login') {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id');
  const { LoginPage } = await import('./LoginPage');
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/complete-profile" element={<p>Completar perfil</p>} />
        <Route path="/orders/today" element={<p>Home empleado</p>} />
        <Route path="*" element={<p>Otra ruta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage — Google sign-in', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
    vi.unstubAllEnvs();
    vi.mocked(googleLogin).mockReset();
    vi.mocked(me).mockReset();
    vi.mocked(checkEmail).mockReset();
  });

  it('shows the Google button above the email flow with the new copy', async () => {
    await renderLogin();

    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeInTheDocument();
    expect(screen.getByText('Ingresá con Google o con tu email.')).toBeInTheDocument();
    expect(screen.getByText(/o ingresá con tu email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
  });

  it('configures the GSI button with only Google options', async () => {
    await renderLogin();

    expect(googleLoginProps.current).toMatchObject({
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
    });
    expect(typeof googleLoginProps.current.width).toBe('number');
    expect(googleLoginProps.current.width as number).toBeLessThanOrEqual(400);
  });

  it('signs in and goes to the home of the role on success', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: false });
    vi.mocked(me).mockResolvedValueOnce(baseUser);
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Home empleado')).toBeInTheDocument();
  });

  it('sends the user to complete the profile when it is incomplete', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: false });
    vi.mocked(me).mockResolvedValueOnce({ ...baseUser, profileComplete: false });
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Completar perfil')).toBeInTheDocument();
  });

  it('shows the welcome-lunch screen first when the backend granted it', async () => {
    vi.mocked(googleLogin).mockResolvedValueOnce({ accessToken: 'tok', welcomeLunchGranted: true });
    vi.mocked(me).mockResolvedValueOnce(baseUser);
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText(/¡listo, bienvenido a arias!/i)).toBeInTheDocument();
  });

  it('shows the company-account notice and pre-fills the email on the excluded 403', async () => {
    vi.mocked(googleLogin).mockRejectedValueOnce({
      response: { status: 403, data: { errorCode: 'GOOGLE_ACCOUNT_NOT_ALLOWED' } },
    });
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('Tu cuenta es de empresa.')).toBeInTheDocument();
    expect(screen.getByText(/Ingresá con tu email\./)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@empresa.com');
    expect(screen.queryByText(/no pudimos iniciar sesión con google/i)).not.toBeInTheDocument();
  });

  it('shows the generic error for any other backend failure', async () => {
    vi.mocked(googleLogin).mockRejectedValueOnce({ response: { status: 401, data: {} } });
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /continuar con google/i }));

    expect(await screen.findByText('No pudimos iniciar sesión con Google. Probá de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText('Tu cuenta es de empresa.')).not.toBeInTheDocument();
  });

  it('shows the generic error when the Google widget itself fails', async () => {
    await renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /fallar google/i }));

    expect(await screen.findByText('No pudimos iniciar sesión con Google. Probá de nuevo.')).toBeInTheDocument();
  });

  it('pre-fills the email from ?email= when it cannot be resolved', async () => {
    vi.mocked(checkEmail).mockRejectedValueOnce(new Error('network'));
    await renderLogin('/login?email=Ana%40Empresa.com');

    await waitFor(() => expect(screen.getByLabelText(/^email$/i)).toHaveValue('ana@empresa.com'));
  });
});
