import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  nickname: null,
  displayName: 'Test',
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

function renderLayout(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
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

describe('AppLayout — desktop navigation (B2C only)', () => {
  beforeEach(() => {
    vi.mocked(getNotificationPreferences).mockResolvedValue({ recibeRecordatorioPedido: false });
    vi.mocked(getWallet).mockResolvedValue({ available: 3, committed: 0, expiresAt: null });
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('B2B header unchanged: no navigation links, only the brand, the name, the company and log out', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2bUser, bootstrapping: false });

    renderLayout('/orders/today');

    await screen.findByText('ACME');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Pedir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mis pedidos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('B2C: offers "Pedir" and "Mis pedidos" and marks the current one', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2cUser, bootstrapping: false });

    renderLayout('/orders/mine');

    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Pedir' })).toHaveAttribute('href', '/orders/today');
    expect(within(nav).getByRole('link', { name: 'Pedir' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Mis pedidos' })).toHaveAttribute('aria-current', 'page');
  });

  it('B2C: "Pedir" is the current one on the ordering page', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2cUser, bootstrapping: false });

    renderLayout('/orders/today');

    const nav = await screen.findByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Pedir' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Mis pedidos' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppLayout — onboarding tour targets', () => {
  beforeEach(() => {
    vi.mocked(getNotificationPreferences).mockResolvedValue({ recibeRecordatorioPedido: false });
    vi.mocked(getWallet).mockResolvedValue({ available: 1, committed: 0, expiresAt: null });
  });

  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: true });
    vi.clearAllMocks();
  });

  it('marks the ARIAS logo and the balance chip as tour targets', async () => {
    useAuthStore.setState({ accessToken: 't', user: b2cUser, bootstrapping: false });

    renderLayout('/orders/today');

    const chip = await screen.findByRole('link', { name: /tenés 1 almuerzo disponible/i });
    expect(chip).toHaveAttribute('data-tour', 'balance-chip');
    expect(screen.getByRole('link', { name: /arias/i })).toHaveAttribute('data-tour', 'logo');
  });
});
