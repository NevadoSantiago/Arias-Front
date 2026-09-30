import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreditsCheckoutStatus } from './CreditsCheckoutStatus';
import { confirmPurchase, getPurchase } from '../services/creditsApi';
import type { CreditPurchase } from '../types';

vi.mock('../services/creditsApi', () => ({
  getPurchase: vi.fn(),
  confirmPurchase: vi.fn(),
}));

// F7: los estados ahora incluyen enlaces de navegación (`Link`), por eso el
// render necesita un `MemoryRouter` — el polling/estado en sí no cambió.
function renderWithClient(purchaseId: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreditsCheckoutStatus purchaseId={purchaseId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pendingPurchase: CreditPurchase = {
  id: 'p1',
  type: 'PACK',
  creditAmount: 10,
  amountCents: 500000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: '2026-01-01T00:00:00Z',
  creditedAt: null,
  reversedAt: null,
};

describe('CreditsCheckoutStatus', () => {
  beforeEach(() => {
    vi.mocked(getPurchase).mockReset();
    // Default: the confirm endpoint is unavailable, so polling falls back to the plain GET.
    vi.mocked(confirmPurchase).mockReset().mockRejectedValue(new Error('confirm unavailable'));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('never claims success while the purchase status is PENDING', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();
    expect(screen.queryByText(/se acreditaron/i)).not.toBeInTheDocument();
  });

  it('shows the credited confirmation once the backend reports APPROVED via polling', async () => {
    vi.mocked(getPurchase)
      .mockResolvedValueOnce(pendingPurchase)
      .mockResolvedValueOnce({ ...pendingPurchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();

    // Advance past the poll interval so the bounded polling loop refetches.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/se acreditaron 10 almuerzos/i)).toBeInTheDocument();
    expect(getPurchase).toHaveBeenCalledTimes(2);
  });

  it('stops polling after the bounded attempt limit and asks the user to wait for an email', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // 10 poll attempts at 3s each — bounded, must not spin forever.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }

    expect(screen.getByText(/te avisamos por correo/i)).toBeInTheDocument();
    expect(getPurchase).toHaveBeenCalledTimes(11);
  });

  describe('confirming the pending purchase with the server', () => {
    const approved = { ...pendingPurchase, status: 'APPROVED' as const, creditedAt: '2026-01-01T00:05:00Z' };

    it('calls confirmPurchase on each polling attempt and renders APPROVED from its response', async () => {
      vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);
      vi.mocked(confirmPurchase).mockResolvedValue(approved);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getPurchase).toHaveBeenCalledTimes(1);
      expect(confirmPurchase).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(confirmPurchase).toHaveBeenCalledTimes(1);
      expect(confirmPurchase).toHaveBeenCalledWith('p1');
      expect(getPurchase).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/se acreditaron 10 almuerzos/i)).toBeInTheDocument();
    });

    it('falls back to getPurchase when confirmPurchase fails and keeps polling', async () => {
      vi.mocked(getPurchase)
        .mockResolvedValueOnce(pendingPurchase)
        .mockResolvedValueOnce(pendingPurchase)
        .mockResolvedValueOnce(approved);
      vi.mocked(confirmPurchase).mockRejectedValue(new Error('500'));

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(confirmPurchase).toHaveBeenCalledTimes(1);
      expect(getPurchase).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/estamos procesando tu pago/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(confirmPurchase).toHaveBeenCalledTimes(2);
      expect(getPurchase).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/se acreditaron 10 almuerzos/i)).toBeInTheDocument();
    });

    it('never calls confirmPurchase when the initial state is not PENDING', async () => {
      vi.mocked(getPurchase).mockResolvedValue(approved);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(confirmPurchase).not.toHaveBeenCalled();
      expect(getPurchase).toHaveBeenCalledTimes(1);
    });

    it('keeps the 10-attempt bound while confirmPurchase keeps returning PENDING', async () => {
      vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);
      vi.mocked(confirmPurchase).mockResolvedValue(pendingPurchase);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      for (let i = 0; i < 12; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(3000);
        });
      }

      expect(confirmPurchase).toHaveBeenCalledTimes(10);
      expect(getPurchase).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/te avisamos por correo/i)).toBeInTheDocument();
    });
  });

  it('shows an error without polling when no purchase id can be resolved from the URL', () => {
    renderWithClient(null);

    expect(screen.getByText(/no pudimos identificar tu compra/i)).toBeInTheDocument();
    expect(getPurchase).not.toHaveBeenCalled();
  });

  // F7: cobertura del restyle — no cambian la lógica de polling/estado de
  // arriba, solo prueban la presentación nueva.
  it('shows the 3-step status list while PENDING', async () => {
    vi.mocked(getPurchase).mockResolvedValue(pendingPurchase);

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Pago enviado')).toBeInTheDocument();
    expect(screen.getByText('Confirmación de Mercado Pago')).toBeInTheDocument();
    expect(screen.getByText('Almuerzos en tu saldo')).toBeInTheDocument();
  });

  it('offers a retry link to /credits/packs when the payment was rejected', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...pendingPurchase, status: 'REJECTED' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(/el pago no se pudo completar/i)).toBeInTheDocument();
    const retryLink = screen.getByRole('link', { name: /intentar de nuevo/i });
    expect(retryLink).toHaveAttribute('href', '/credits/packs');
  });

  it('offers links to order and to the wallet once the purchase is approved', async () => {
    vi.mocked(getPurchase).mockResolvedValue({ ...pendingPurchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole('link', { name: /pedir mi almuerzo/i })).toHaveAttribute('href', '/orders/today');
    expect(screen.getByRole('link', { name: /ver mis almuerzos/i })).toHaveAttribute('href', '/credits');
  });

  // F9: `GET /api/v1/credits/purchases/{id}` ahora incluye `packNombre`
  // (backend task B3) — se muestra en vez del texto genérico "Paquete de
  // almuerzos" / "Compra directa" cuando está presente.
  it('shows the pack name instead of the generic label when packNombre is present (APPROVED)', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'APPROVED',
      creditedAt: '2026-01-01T00:05:00Z',
      packNombre: 'Paquete Semana',
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete Semana')).toBeInTheDocument();
    expect(screen.queryByText('Paquete de almuerzos')).not.toBeInTheDocument();
  });

  it('shows the pack name instead of the generic label when packNombre is present (REJECTED)', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'REJECTED',
      packNombre: 'Paquete Mes',
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete Mes')).toBeInTheDocument();
    expect(screen.queryByText('Paquete de almuerzos')).not.toBeInTheDocument();
  });

  it('falls back to the generic pack label when packNombre is null', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      status: 'APPROVED',
      creditedAt: '2026-01-01T00:05:00Z',
      packNombre: null,
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Paquete de almuerzos')).toBeInTheDocument();
  });

  it('falls back to the generic direct-purchase label when packNombre is null', async () => {
    vi.mocked(getPurchase).mockResolvedValue({
      ...pendingPurchase,
      type: 'DIRECT',
      status: 'REJECTED',
      packNombre: null,
    });

    renderWithClient('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText('Compra directa')).toBeInTheDocument();
  });

  // F18: `purchase.type === 'DIRECT'` (pago directo de un pedido, unidad
  // B7) tiene su propia copia orientada a pedidos en vez de a almuerzos —
  // la lógica de polling/estado de arriba no cambia (mismos tests PENDING/
  // APPROVED/FAILED de arriba, con `type: 'PACK'` por defecto, siguen verdes).
  describe('purchase.type === DIRECT', () => {
    const directPurchase: CreditPurchase = {
      ...pendingPurchase,
      type: 'DIRECT',
      packNombre: null,
    };

    it('shows "¡Listo! Tu pedido quedó programado" with a link to Mis pedidos when approved', async () => {
      vi.mocked(getPurchase).mockResolvedValue({
        ...directPurchase,
        status: 'APPROVED',
        creditedAt: '2026-01-01T00:05:00Z',
      });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('¡Listo! Tu pedido quedó programado')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver mi pedido/i })).toHaveAttribute('href', '/orders/mine');
    });

    it('never claims lunches were credited to the wallet for a DIRECT approved purchase', async () => {
      vi.mocked(getPurchase).mockResolvedValue({
        ...directPurchase,
        status: 'APPROVED',
        creditedAt: '2026-01-01T00:05:00Z',
      });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.queryByText(/se acreditaron/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ya podés usarlos/i)).not.toBeInTheDocument();
      expect(
        screen.getByText(/mercado pago confirmó el pago\. tu pedido quedó programado/i),
      ).toBeInTheDocument();
    });

    // F23: con pago parcial, la compra DIRECT es solo por lo que cobra Mercado
    // Pago (`creditAmount` y `amountCents` ya son el resto): el comprobante
    // describe esa parte, no el pedido entero.
    it('describes only the Mercado Pago part of a partly paid order (lunches and amount)', async () => {
      vi.mocked(getPurchase).mockResolvedValue({
        ...directPurchase,
        status: 'APPROVED',
        creditAmount: 1,
        amountCents: 150000,
        creditedAt: '2026-01-01T00:05:00Z',
      });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Almuerzos con Mercado Pago')).toBeInTheDocument();
      expect(screen.queryByText('Almuerzos')).not.toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/\$\s?1\.500,00/)).toBeInTheDocument();
    });

    it('keeps the plain "Almuerzos" row for a pack purchase', async () => {
      vi.mocked(getPurchase).mockResolvedValue({
        ...pendingPurchase,
        status: 'APPROVED',
        creditedAt: '2026-01-01T00:05:00Z',
      });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Almuerzos')).toBeInTheDocument();
      expect(screen.queryByText('Almuerzos con Mercado Pago')).not.toBeInTheDocument();
    });

    it('shows "Tu pedido queda programado" as the last step while PENDING', async () => {
      vi.mocked(getPurchase).mockResolvedValue(directPurchase);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Pago enviado')).toBeInTheDocument();
      expect(screen.getByText('Confirmación de Mercado Pago')).toBeInTheDocument();
      expect(screen.getByText('Tu pedido queda programado')).toBeInTheDocument();
      expect(screen.queryByText('Almuerzos en tu saldo')).not.toBeInTheDocument();
    });

    it('shows "No se aprobó el pago. Tu pedido se canceló" with a link to order again when rejected', async () => {
      vi.mocked(getPurchase).mockResolvedValue({ ...directPurchase, status: 'REJECTED' });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(
        screen.getByRole('heading', { name: /no se aprobó el pago\. tu pedido se canceló/i }),
      ).toBeInTheDocument();
      const retryLink = screen.getByRole('link', { name: /volver a pedir/i });
      expect(retryLink).toHaveAttribute('href', '/orders/today');
    });
  });

  // F11 (prototipo `PurchaseMediation.dc.html`): estado IN_MEDIATION —
  // decisión del usuario (2026-09-26): sin promesa de aviso por correo.
  describe('IN_MEDIATION', () => {
    const mediationPurchase: CreditPurchase = {
      ...pendingPurchase,
      status: 'IN_MEDIATION',
      packNombre: 'Paquete Semana',
      creditAmount: 5,
    };

    it('shows the payment-under-review copy without promising an email', async () => {
      vi.mocked(getPurchase).mockResolvedValue(mediationPurchase);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Tu pago está en revisión')).toBeInTheDocument();
      expect(
        screen.getByText(/se abrió un reclamo sobre este pago y mercado pago lo está revisando/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/te avisamos por correo/i)).not.toBeInTheDocument();
    });

    it('shows the pack name and the lunch count', async () => {
      vi.mocked(getPurchase).mockResolvedValue(mediationPurchase);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Paquete Semana')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('says the lunches stay on hold when the purchase was never credited (creditedAt null)', async () => {
      vi.mocked(getPurchase).mockResolvedValue({ ...mediationPurchase, creditedAt: null });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(
        screen.getByText(/los 5 almuerzos de esta compra quedan en espera hasta que se resuelva/i),
      ).toBeInTheDocument();
    });

    it('says the lunches stay on the balance when the purchase was already credited before the dispute', async () => {
      vi.mocked(getPurchase).mockResolvedValue({ ...mediationPurchase, creditedAt: '2026-01-01T00:05:00Z' });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(
        screen.getByText(/los 5 almuerzos de esta compra siguen en tu saldo mientras mercado pago lo revisa/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/quedan en espera/i)).not.toBeInTheDocument();
    });

    it('offers links back to the wallet and to the menu', async () => {
      vi.mocked(getPurchase).mockResolvedValue(mediationPurchase);

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByRole('link', { name: /volver a mis almuerzos/i })).toHaveAttribute('href', '/credits');
      expect(screen.getByRole('link', { name: /ir al menú/i })).toHaveAttribute('href', '/orders/today');
    });

    it('falls back to the generic pack label when packNombre is null', async () => {
      vi.mocked(getPurchase).mockResolvedValue({ ...mediationPurchase, packNombre: null });

      renderWithClient('p1');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByText('Paquete de almuerzos')).toBeInTheDocument();
    });
  });
});

describe('CreditsCheckoutStatus — pending purchases (D6)', () => {
  beforeEach(() => {
    vi.mocked(getPurchase).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSpying(purchaseId: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CreditsCheckoutStatus purchaseId={purchaseId} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    return invalidate;
  }

  it('refreshes the pending payments once the purchase leaves PENDING', async () => {
    vi.mocked(getPurchase)
      .mockResolvedValueOnce(pendingPurchase)
      .mockResolvedValueOnce({ ...pendingPurchase, status: 'APPROVED', creditedAt: '2026-01-01T00:05:00Z' });

    const invalidate = renderSpying('p1');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['creditsPendingPurchases'] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['creditsPendingPurchases'] });
  });
});
