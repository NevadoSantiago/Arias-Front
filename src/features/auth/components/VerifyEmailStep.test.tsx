import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VerifyEmailStep } from './VerifyEmailStep';
import { useAuthStore } from '../store/authStore';
import { me, verifyEmail } from '../services/authApi';

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

describe('VerifyEmailStep', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
  });

  it('shows the neutral "check your email" message without establishing a session when there is no token', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <VerifyEmailStep token={null} email="ana@example.com" />
      </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/revisá tu correo/i)).toBeInTheDocument();
    expect(screen.getByText(/ana@example.com/)).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  describe('verified screen', () => {
    const user = {
      id: 1,
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: null,
      nickname: 'Ana',
      role: 'EMPLOYEE' as const,
      companyId: null,
      companyName: null,
      categoryId: null,
      emailVerified: true,
      profileComplete: false,
    };

    function renderVerified() {
      render(
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <VerifyEmailStep token="tok" email={null} />
          </MemoryRouter>
        </QueryClientProvider>,
      );
    }

    it('promises the welcome lunch only when the backend granted it', async () => {
      vi.mocked(verifyEmail).mockResolvedValueOnce({ accessToken: 't', welcomeLunchGranted: true });
      vi.mocked(me).mockResolvedValueOnce(user);
      renderVerified();

      expect(
        await screen.findByText('Tu correo quedó verificado y te regalamos 1 almuerzo de bienvenida 🎉'),
      ).toBeInTheDocument();
    });

    it('does not promise a lunch when none was granted', async () => {
      vi.mocked(verifyEmail).mockResolvedValueOnce({ accessToken: 't', welcomeLunchGranted: false });
      vi.mocked(me).mockResolvedValueOnce(user);
      renderVerified();

      expect(await screen.findByText('Tu correo quedó verificado. Ya podés hacer tu primer pedido.')).toBeInTheDocument();
      expect(screen.queryByText(/te regalamos/i)).not.toBeInTheDocument();
    });
  });
});
