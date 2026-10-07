import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/features/auth/store/authStore';
import { TourProvider } from './TourProvider';
import { useTourPageControls, useTourReplay } from './TourContext';
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

/** Una pantalla mínima con los mismos `data-tour` que la app real. */
function OrderPage({ hasDish = true, resetSpy }: { hasDish?: boolean; resetSpy?: (o: { clearCart: boolean }) => void }) {
  const [sheet, setSheet] = useState(false);
  const [side, setSide] = useState(false);
  const [cart, setCart] = useState(false);
  const [review, setReview] = useState(false);
  useTourPageControls({
    resetOrderUi: (o) => {
      resetSpy?.(o);
      setSheet(false);
      setReview(false);
      if (o.clearCart) setCart(false);
    },
  });
  return (
    <div>
      {hasDish && (
        <button type="button" data-tour="dish" data-tour-has-side="true" onClick={() => setSheet(true)}>
          Milanesa
        </button>
      )}
      {sheet && (
        <div>
          <div data-tour="sides">
            <button type="button" role="radio" aria-checked={side} onClick={() => setSide(true)}>
              Papas
            </button>
          </div>
          <button
            type="button"
            data-tour="add"
            onClick={() => {
              setSheet(false);
              setCart(true);
            }}
          >
            Agregar al pedido
          </button>
        </div>
      )}
      {cart && !review && (
        <button type="button" data-tour="cart" onClick={() => setReview(true)}>
          Ver pedido
        </button>
      )}
      {review && (
        <div>
          <div data-tour="picker">horario</div>
          <div data-tour="balance-box">saldo</div>
          <button type="button" data-tour="confirm" onClick={() => document.body.setAttribute('data-ordered', '1')}>
            Confirmar pedido
          </button>
        </div>
      )}
    </div>
  );
}

function ReplayButton() {
  const { canReplay, replay } = useTourReplay();
  return canReplay ? (
    <button type="button" onClick={replay}>
      Repetir tour
    </button>
  ) : null;
}

function renderTour(path = '/orders/today', opts: { hasDish?: boolean; resetSpy?: (o: { clearCart: boolean }) => void; missingAfterMs?: number } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <TourProvider targetTimeoutMs={opts.missingAfterMs ?? 10000}>
        <header>
          <ReplayButton />
          <Link to="/credits" data-tour="balance-chip">
            Saldo
          </Link>
          <Link to="/orders/today" data-tour="logo">
            ARIAS
          </Link>
        </header>
        <Routes>
          <Route path="/orders/today" element={<OrderPage hasDish={opts.hasDish} resetSpy={opts.resetSpy} />} />
          <Route path="/credits" element={<a href="#buy" data-tour="buy">Comprar más almuerzos</a>} />
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
      return { x: 20, y: 100, left: 20, top: 100, right: has ? 140 : 20, bottom: has ? 144 : 100, width: has ? 120 : 0, height: has ? 44 : 0, toJSON: () => ({}) } as DOMRect;
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

  describe('walking the steps', () => {
    it('shows the balance chip with a counter and moves on with "Siguiente"', async () => {
      setUser({});
      renderTour();

      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));

      expect(await screen.findByText('Este es tu saldo de almuerzos')).toBeInTheDocument();
      expect(screen.getByText('1 de 11')).toBeInTheDocument();

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

    it('walks the whole ordering flow without ever confirming an order', async () => {
      const resetSpy = vi.fn();
      setUser({});
      renderTour('/orders/today', { resetSpy });
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i })); // chip info
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' })); // chip tap
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i })); // buy
      await screen.findByText('Volvé al menú');
      fireEvent.click(screen.getByRole('link', { name: 'ARIAS' })); // logo tap

      await screen.findByText('Elegí un plato');
      fireEvent.click(screen.getByRole('button', { name: 'Milanesa' }));
      await screen.findByText('¿Con qué lo acompañás?');
      fireEvent.click(screen.getByRole('radio', { name: 'Papas' }));
      await screen.findByText('Sumalo a tu pedido');
      fireEvent.click(screen.getByRole('button', { name: 'Agregar al pedido' }));
      await screen.findByText('Tu pedido te espera acá abajo');
      fireEvent.click(screen.getByRole('button', { name: 'Ver pedido' }));
      await screen.findByText('Elegí cuándo lo retirás');
      expect(screen.getByText('Probalo, o seguí con Siguiente.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
      await screen.findByText('Tu saldo, antes de confirmar');
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
      await screen.findByText('Confirmá cuando estés listo');
      expect(screen.getByText('11 de 11')).toBeInTheDocument();

      // El botón de confirmar solo se mira: tocarlo no avanza ni confirma desde el tour.
      fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

      expect(await screen.findByText('¡Listo! Ya podés pedir tu primer plato')).toBeInTheDocument();
      expect(document.body).not.toHaveAttribute('data-ordered');

      fireEvent.click(screen.getByRole('button', { name: /ir a confirmar mi pedido/i }));
      await waitFor(() => expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1));
      expect(resetSpy).not.toHaveBeenCalled();
    });

    it('"Seguir mirando el menú" ends the tour and asks the page to close its sheets', async () => {
      const resetSpy = vi.fn();
      setUser({});
      renderTour('/orders/today', { resetSpy });
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'ARIAS' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Milanesa' }));
      fireEvent.click(await screen.findByRole('radio', { name: 'Papas' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Agregar al pedido' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Ver pedido' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      await screen.findByText('¡Listo! Ya podés pedir tu primer plato');

      fireEvent.click(screen.getByRole('button', { name: /seguir mirando el menú/i }));

      await waitFor(() => expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1));
      expect(resetSpy).toHaveBeenCalledWith({ clearCart: false });
    });

    it('going back from "Ver pedido" to the dish step clears what the tour added', async () => {
      const resetSpy = vi.fn();
      setUser({});
      renderTour('/orders/today', { resetSpy });
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'ARIAS' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Milanesa' }));
      fireEvent.click(await screen.findByRole('radio', { name: 'Papas' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Agregar al pedido' }));
      await screen.findByText('Tu pedido te espera acá abajo');

      fireEvent.click(screen.getByRole('button', { name: /anterior/i }));

      expect(await screen.findByText('Elegí un plato')).toBeInTheDocument();
      expect(resetSpy).toHaveBeenCalledWith({ clearCart: true });
    });
  });

  describe('replay', () => {
    const seen = { onboardingTourSeenAt: '2026-10-01T10:00:00Z' };

    it('is offered to a B2C customer even after seeing the tour, and not to a company employee', async () => {
      setUser(seen);
      const { unmount } = renderTour();
      expect(await screen.findByRole('button', { name: 'Repetir tour' })).toBeInTheDocument();
      unmount();

      setUser({ ...seen, companyId: 3 });
      renderTour();
      await act(async () => {});
      expect(screen.queryByRole('button', { name: 'Repetir tour' })).not.toBeInTheDocument();
    });

    it('starts at the balance chip step, skipping the gift welcome card, from any screen', async () => {
      setUser(seen);
      renderTour('/credits');

      fireEvent.click(await screen.findByRole('button', { name: 'Repetir tour' }));

      expect(await screen.findByText('Este es tu saldo de almuerzos')).toBeInTheDocument();
      expect(screen.getByText('1 de 11')).toBeInTheDocument();
      expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument();
      expect(screen.getByTestId('path')).toHaveTextContent('/orders/today');
    });

    it('does not tell the backend again nor touch the seen date when it finishes', async () => {
      setUser(seen);
      renderTour();
      fireEvent.click(await screen.findByRole('button', { name: 'Repetir tour' }));
      await screen.findByText('Este es tu saldo de almuerzos');

      fireEvent.click(screen.getByRole('button', { name: /saltar tour/i }));

      await waitFor(() => expect(screen.queryByText('Este es tu saldo de almuerzos')).not.toBeInTheDocument());
      expect(markOnboardingTourSeen).not.toHaveBeenCalled();
      expect(useAuthStore.getState().user?.onboardingTourSeenAt).toBe(seen.onboardingTourSeenAt);
    });

    it('does not re-enable the auto-start for a customer who had not seen it when the replay ends', async () => {
      setUser({});
      renderTour('/credits');
      fireEvent.click(await screen.findByRole('button', { name: 'Repetir tour' }));
      await screen.findByText('Este es tu saldo de almuerzos');

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByText('Este es tu saldo de almuerzos')).not.toBeInTheDocument());
      expect(screen.queryByText('¡Te regalamos un almuerzo!')).not.toBeInTheDocument();
      expect(markOnboardingTourSeen).not.toHaveBeenCalled();
    });

    it('going back to the dish step keeps the customer cart', async () => {
      const resetSpy = vi.fn();
      setUser(seen);
      renderTour('/orders/today', { resetSpy });
      fireEvent.click(await screen.findByRole('button', { name: 'Repetir tour' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'ARIAS' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Milanesa' }));
      fireEvent.click(await screen.findByRole('radio', { name: 'Papas' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Agregar al pedido' }));
      await screen.findByText('Tu pedido te espera acá abajo');

      fireEvent.click(screen.getByRole('button', { name: /anterior/i }));

      expect(await screen.findByText('Elegí un plato')).toBeInTheDocument();
      expect(resetSpy).toHaveBeenCalledWith({ clearCart: false });
      expect(resetSpy).not.toHaveBeenCalledWith({ clearCart: true });
    });
  });

  describe('edge cases', () => {
    it('ends with an adapted closing card when there is no dish to order', async () => {
      setUser({});
      renderTour('/orders/today', { hasDish: false, missingAfterMs: 150 });
      fireEvent.click(await screen.findByRole('button', { name: /empezar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'Saldo' }));
      fireEvent.click(await screen.findByRole('button', { name: /siguiente/i }));
      fireEvent.click(await screen.findByRole('link', { name: 'ARIAS' }));

      expect(await screen.findByText(/hoy no hay platos para pedir/i)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ir a confirmar/i })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /entendido/i }));
      await waitFor(() => expect(markOnboardingTourSeen).toHaveBeenCalledTimes(1));
    });
  });
});
