import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { getWallet } from '@/features/credits/services/creditsApi';
import { getNotificationPreferences } from '@/features/me/services/meApi';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

vi.mock('@/features/me/services/meApi', () => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}));

const b2cUser: AuthUser = {
  id: 1,
  email: 'cliente@example.com',
  firstName: 'Lucía',
  lastName: null,
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
};

const b2bUser: AuthUser = {
  ...b2cUser,
  id: 2,
  companyId: 5,
  companyName: 'ACME',
};

function renderLayout() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppLayout — balance chip (B2C only)', () => {
  beforeEach(() => {
    vi.mocked(getNotificationPreferences).mockResolvedValue({ recibeRecordatorioPedido: false });
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('shows the balance chip with the available count for a B2C customer', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2cUser, bootstrapping: false });
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 1, expiresAt: null });

    renderLayout();

    expect(
      await screen.findByRole('link', { name: /tenés 12 almuerzos disponibles/i }),
    ).toBeInTheDocument();
  });

  it('does not show the balance chip for a company employee (B2B header unchanged)', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2bUser, bootstrapping: false });
    vi.mocked(getWallet).mockResolvedValue({ available: 12, committed: 1, expiresAt: null });

    renderLayout();

    await screen.findByText('ACME');
    expect(screen.queryByRole('link', { name: /almuerzos/i })).not.toBeInTheDocument();
    expect(getWallet).not.toHaveBeenCalled();
  });

  it('shows "Cargar" when the B2C customer has zero available lunches', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2cUser, bootstrapping: false });
    vi.mocked(getWallet).mockResolvedValue({ available: 0, committed: 0, expiresAt: null });

    renderLayout();

    expect(await screen.findByText('Cargar')).toBeInTheDocument();
  });
});
