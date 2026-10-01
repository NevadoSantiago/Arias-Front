import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/features/auth/store/authStore';
import { CompleteProfilePage } from './CompleteProfilePage';

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
}));

describe('CompleteProfilePage layout', () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
  });

  it('aligns the form card to the top instead of centering it vertically', () => {
    useAuthStore.setState({
      user: {
        id: 1,
        email: 'a@b.com',
        firstName: 'Ana',
        lastName: null,
        nickname: null,
        displayName: 'Ana',
        role: 'EMPLOYEE',
        companyId: null,
        companyName: null,
        categoryId: null,
        emailVerified: true,
        profileComplete: false,
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <CompleteProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const wrapper = screen.getByRole('heading', { name: /completá tu perfil/i }).closest('.flex-1');
    expect(wrapper).toHaveClass('items-start', 'pt-4', 'lg:pt-12');
    expect(wrapper).not.toHaveClass('items-center');
  });
});
