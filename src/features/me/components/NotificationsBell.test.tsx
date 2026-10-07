import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { TourProvider } from '@/features/tour/TourProvider';
import { NotificationsBell } from './NotificationsBell';

vi.mock('@/features/me/services/meApi', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue({ recibeRecordatorioPedido: true }),
  updateNotificationPreferences: vi.fn(),
}));
vi.mock('@/features/tour/services/tourApi', () => ({
  markOnboardingTourSeen: vi.fn().mockResolvedValue(undefined),
}));

const b2cUser: AuthUser = {
  id: 7,
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: null,
  nickname: 'Ana',
  role: 'EMPLOYEE',
  companyId: null,
  companyName: null,
  categoryId: null,
  emailVerified: true,
  profileComplete: true,
  onboardingTourSeenAt: '2026-10-01T10:00:00Z',
};

function setUser(patch: Partial<AuthUser>) {
  useAuthStore.setState({ accessToken: 'token', user: { ...b2cUser, ...patch }, bootstrapping: false });
}

function Location() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderBell(path = '/credits') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <TourProvider>
          <header>
            <NotificationsBell />
            <a href="/credits" data-tour="balance-chip">
              Saldo
            </a>
          </header>
          <Location />
        </TourProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('NotificationsBell tour replay', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const has = this.hasAttribute('data-tour');
      return { x: 20, y: 100, left: 20, top: 100, right: has ? 140 : 20, bottom: has ? 144 : 100, width: has ? 120 : 0, height: has ? 44 : 0, toJSON: () => ({}) } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ accessToken: null, user: null, bootstrapping: false });
  });

  it('offers "Ver el tour de nuevo" to a B2C customer', async () => {
    setUser({});
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByRole('button', { name: /ver el tour de nuevo/i })).toBeInTheDocument();
    expect(screen.getByText('Ayuda')).toBeInTheDocument();
  });

  it('hides it from a company employee', async () => {
    setUser({ companyId: 3 });
    renderBell();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByText('Recordatorio diario')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver el tour de nuevo/i })).not.toBeInTheDocument();
  });

  it('closes the dropdown and starts the tour at the balance chip', async () => {
    setUser({});
    renderBell();
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    fireEvent.click(await screen.findByRole('button', { name: /ver el tour de nuevo/i }));

    expect(await screen.findByText('Este es tu saldo de almuerzos')).toBeInTheDocument();
    expect(screen.queryByText('Recordatorio diario')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/orders/today'));
  });
});
