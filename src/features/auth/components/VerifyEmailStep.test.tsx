import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VerifyEmailStep } from './VerifyEmailStep';
import { useAuthStore } from '../store/authStore';
import { verifyEmail } from '../services/authApi';

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
      <MemoryRouter>
        <VerifyEmailStep token={null} email="ana@example.com" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/revisá tu correo/i)).toBeInTheDocument();
    expect(screen.getByText(/ana@example.com/)).toBeInTheDocument();
    expect(verifyEmail).not.toHaveBeenCalled();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
