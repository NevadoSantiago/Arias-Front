import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { TourProvider } from './TourProvider';
import { markOnboardingTourSeen } from './services/tourApi';

vi.mock('./services/tourApi', () => ({
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
  onboardingTourSeenAt: null,
};

function setUser(patch: Partial<AuthUser> | null) {
  useAuthStore.setState({
    accessToken: patch ? 'token' : null,
    user: patch ? { ...b2cUser, ...patch } : null,
    bootstrapping: false,
  });
}

function Location() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function renderTour(path = '/orders/today') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TourProvider>
        {/* Los mismos `data-tour` que el encabezado y la billetera reales. */}
        <header>
          <Link to="/credits" data-tour="balance-chip">
            Saldo
          </Link>
          <Link to="/orders/today" data-tour="logo">
            ARIAS
          </Link>
        </header>
        <Routes>
          <Route path="/orders/today" element={<p>Pedido</p>} />
          <Route path="/credits" element={<p data-tour="buy">Comprar más almuerzos</p>} />
        </Routes>
        <Location />
      </TourProvider>
    </MemoryRouter>,
  );
}

describe('TourProvider', () => {
  beforeEach(() => {
    vi.mocked(markOnboardingTourSeen).mockReset().mockResolvedValue(undefined);
    // jsdom no hace layout: todo elemento marcado ocupa un rectángulo.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const has = this.hasAttribute('data-tour');
      return {
        x: 20,
        y: 100,
        left: 20,
        top: 100,
        right: has ? 140 : 20,
        bottom: has ? 144 : 100,
        width: has ? 120 : 0,
        height: has ? 44 : 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setUser(null);
  });

  describe('who sees it', () => {
    it('welcomes a new B2C customer on the order page with the gift card', async () => {
      setUser({});
      renderTour();

      expect(await screen.findByText('¡Te regalamos un almuerzo!')).toBeInTheDocument();
      expect(screen.getByText(/tu primer almuerzo va por nuestra cuenta/i)).toBeInTheDocument();
    });

    it.each([
      ['a company employee', { companyId: 3 }],
      ['a customer who already saw it', { onboardingTourSeenAt: '2026-10-01T10:00:00Z' }],
      ['an account whose backend does not report the field', { onboardingTourSeenAt: undefined }],
    ])('does not start for %s', async (_label, patch) => {
      setUser(patch);
      renderTour();

      await act(async () => {});
      expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument();
    });

    it('does not start outside the order page', async () => {
      setUser({});
      renderTour('/credits');

      await act(async () => {});
      expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument();
    });
  });

  describe('finishing', () => {
    it('"Saltar tour" closes it, remembers it locally and tells the backend once', async () => {
      setUser({});
      renderTour();

      fireEvent.click(await screen.findByRole('button', { name: /saltar tour/i }));

      await waitFor(() => expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument());
      expect(useAuthStore.getState().user?.onboardingTourSeenAt).toEqual(expect.any(String));
      expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1);
    });

    it('still closes when the backend call fails', async () => {
      vi.mocked(markOnboardingTourSeen).mockRejectedValue(new Error('network'));
      setUser({});
      renderTour();

      fireEvent.click(await screen.findByRole('button', { name: /saltar tour/i }));

      await waitFor(() => expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument());
      expect(useAuthStore.getState().user?.onboardingTourSeenAt).toEqual(expect.any(String));
    });

    it('Escape skips the tour from any step', async () => {
      setUser({});
      renderTour();
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      await screen.findByText('Este es tu saldo de almuerzos');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByText('Este es tu saldo de almuerzos')).not.toBeInTheDocument());
      expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1);
    });
  });

  describe('walking the first steps', () => {
    it('shows the balance chip with a counter and moves on with "Siguiente"', async () => {
      setUser({});
      renderTour();

      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));

      expect(await screen.findByText('Este es tu saldo de almuerzos')).toBeInTheDocument();
      expect(screen.getByText('1 de 4')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      expect(await screen.findByText('Tocá tu saldo')).toBeInTheDocument();
      expect(screen.getByText('Tocá acá para seguir')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    });

    it('tapping the highlighted balance chip follows the real link and moves to "buy more lunches"', async () => {
      setUser({});
      renderTour();
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      await screen.findByText('Tocá tu saldo');

      fireEvent.click(screen.getByRole('link', { name: 'Saldo' }));

      expect(await screen.findByText('Acá comprás más almuerzos')).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/credits');
    });

    it('"Anterior" returns to the previous step and its screen', async () => {
      setUser({});
      renderTour();
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      await screen.findByText('Acá comprás más almuerzos');

      fireEvent.click(screen.getByRole('button', { name: /anterior/i }));

      expect(await screen.findByText('Tocá tu saldo')).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/orders/today');
    });

    it('tapping the ARIAS logo goes back to the order page and reaches the closing card', async () => {
      setUser({});
      renderTour();
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      await screen.findByText('Volvé al menú');

      fireEvent.click(screen.getByRole('link', { name: 'ARIAS' }));

      expect(await screen.findByText(/ya podés pedir tu primer plato/i)).toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/orders/today');

      fireEvent.click(screen.getByRole('button', { name: /ir a confirmar mi pedido/i }));
      await waitFor(() => expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1));
    });
  });
});
