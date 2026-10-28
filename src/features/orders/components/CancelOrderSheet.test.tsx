import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CancelOrderSheet } from './CancelOrderSheet';
import { getWallet } from '@/features/credits/services/creditsApi';
import type { OrderV2 } from '../services/ordersApi';

vi.mock('@/features/credits/services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

vi.mocked(getWallet).mockResolvedValue({ available: 8, committed: 4, expiresAt: null });

const order: OrderV2 = {
  id: 123,
  fecha: '2026-09-24',
  pickupAt: '2026-09-24T15:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 4,
  notas: null,
  items: [
    {
      id: 1,
      dishId: 10,
      dishNombre: 'Milanesa',
      dishCategoria: 'Premium',
      sideId: 5,
      sideNombre: 'Puré',
      creditCost: 2,
      notas: null,
    },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

function renderSheet(props: Partial<React.ComponentProps<typeof CancelOrderSheet>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <CancelOrderSheet
        order={order}
        now={new Date('2026-09-24T10:00:00Z')}
        cancelling={false}
        errorMessage={null}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...view, onClose, onConfirm };
}

describe('CancelOrderSheet', () => {
  it.each(['CONFIRMADO', 'COMANDADO'] as const)('a %s order gives its consumed lunches back to the balance', async (estado) => {
    renderSheet({ order: { ...order, estado } });

    expect(await screen.findByText('Tus 4 almuerzos vuelven a tu saldo')).toBeInTheDocument();
    expect(await screen.findByText('Pasás de 8 a 12 almuerzos disponibles.')).toBeInTheDocument();
  });

  describe('late cancellation (past refundableUntil)', () => {
    // 12:40 BA is 15:40Z; now is 15:45Z.
    const late = { ...order, pickupAt: '2026-09-24T16:00:00Z', refundableUntil: '2026-09-24T15:40:00Z' };
    const now = new Date('2026-09-24T15:45:00Z');

    it('asks "¿Cancelar igual?" and warns the lunches are not returned, with the deadline', async () => {
      renderSheet({ order: late, now });

      expect(await screen.findByText('¿Cancelar igual?')).toBeInTheDocument();
      expect(screen.getByText('Tus 4 almuerzos no se devuelven')).toBeInTheDocument();
      expect(screen.getByText(/con devolución hasta las 12:40/)).toBeInTheDocument();
      expect(screen.queryByText(/vuelven a tu saldo/)).not.toBeInTheDocument();
    });

    it('uses the singular for a single lunch', async () => {
      renderSheet({ order: { ...late, creditTotal: 1 }, now });

      expect(await screen.findByText('Este almuerzo no se devuelve')).toBeInTheDocument();
    });

    it('offers "Cancelar igual" and "No, lo voy a retirar"', async () => {
      const { onConfirm, onClose } = renderSheet({ order: late, now });

      fireEvent.click(await screen.findByRole('button', { name: 'Cancelar igual' }));
      fireEvent.click(screen.getByRole('button', { name: 'No, lo voy a retirar' }));

      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Sí, cancelar pedido' })).not.toBeInTheDocument();
    });

    it('tells a COMANDADO order that the kitchen is already preparing it', async () => {
      renderSheet({ order: { ...late, estado: 'COMANDADO' }, now });

      expect(await screen.findByText('La cocina ya está preparando tu pedido.')).toBeInTheDocument();
    });

    it('keeps the on-time copy while the refund window is open', async () => {
      renderSheet({ order: late, now: new Date('2026-09-24T15:30:00Z') });

      expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sí, cancelar pedido' })).toBeInTheDocument();
    });
  });

  it('closes on Escape when not cancelling', async () => {
    const { onClose } = renderSheet({ cancelling: false });

    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  // Regresión: la hoja anterior era un AlertDialog que ignoraba Escape y el
  // click en el overlay mientras la cancelación estaba en curso. La nueva
  // `Sheet` (Radix Dialog) no debe cerrarse sola mientras `cancelling` es
  // `true`, para no perder el estado de "Cancelando…" a mitad de camino.
  it('keeps the sheet open on Escape while a cancellation is pending', async () => {
    const { onClose } = renderSheet({ cancelling: true });

    expect(await screen.findByText('¿Cancelar este pedido?')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('¿Cancelar este pedido?')).toBeInTheDocument();
  });

  // Caracterización (antes del cambio): un pedido programado devuelve sus
  // almuerzos al saldo y la hoja lo dice con el saldo resultante.
  it('for a scheduled order says the lunches go back to the balance and shows the new balance', async () => {
    renderSheet();

    expect(await screen.findByText('Tus 4 almuerzos vuelven a tu saldo')).toBeInTheDocument();
    expect(await screen.findByText('Pasás de 8 a 12 almuerzos disponibles.')).toBeInTheDocument();
  });

  // Bug de copy verificado: un pedido sin pagar (PENDIENTE_PAGO) no usó almuerzos
  // del saldo, así que la hoja no puede decir que "vuelven".
  it('for an order awaiting payment says the balance does not change and never that lunches go back', async () => {
    renderSheet({ order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true } });

    expect(await screen.findByText('Tu saldo no cambia')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Este pedido se iba a pagar con Mercado Pago y no usó almuerzos de tu saldo. Se libera la reserva del plato.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/vuelve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pasás de/i)).not.toBeInTheDocument();
  });

  // F26: si el cliente ya pagó y Mercado Pago no lo confirmó, el pago se acredita al saldo.
  it('for an order awaiting payment with nothing reserved says a payment already made is credited (F26)', async () => {
    renderSheet({ order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true, creditTotal: 1 } });

    expect(
      await screen.findByText(
        'Si ya pagaste con Mercado Pago, cuando se confirme el pago te acreditamos ese almuerzo en tu saldo.',
      ),
    ).toBeInTheDocument();
  });

  it('pluralizes the lunches credited when nothing was reserved (F26)', async () => {
    renderSheet({ order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true, creditTotal: 2 } });

    expect(
      await screen.findByText(
        'Si ya pagaste con Mercado Pago, cuando se confirme el pago te acreditamos esos 2 almuerzos en tu saldo.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no "0 almuerzos" notice when Mercado Pago covers nothing (F27.1)', async () => {
    renderSheet({
      order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true, creditTotal: 2, creditsFromBalance: 2 },
    });

    await screen.findByText('Tus 2 almuerzos reservados vuelven a tu saldo');
    expect(screen.queryByText(/te acreditamos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/esos 0/i)).not.toBeInTheDocument();
  });

  it('never claims Mercado Pago charges nothing (F26)', async () => {
    renderSheet({ order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true } });

    await screen.findByText('Tu saldo no cambia');
    expect(screen.queryByText(/no se cobra/i)).not.toBeInTheDocument();
  });
});

describe('CancelOrderSheet — partly reserved order awaiting payment (F23)', () => {
  const partial: OrderV2 = {
    ...order,
    estado: 'PENDIENTE_PAGO',
    paidWithMercadoPago: true,
    creditTotal: 4,
    creditsFromBalance: 1,
  };

  it('says the reserved lunch goes back and that a payment already made is credited (F26)', async () => {
    renderSheet({ order: partial });

    expect(await screen.findByText('Tu almuerzo reservado vuelve a tu saldo')).toBeInTheDocument();
    expect(await screen.findByText('Pasás de 8 a 9 almuerzos disponibles.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Si ya pagaste con Mercado Pago, cuando se confirme el pago te acreditamos esos 3 almuerzos en tu saldo.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Tu saldo no cambia')).not.toBeInTheDocument();
    expect(screen.queryByText(/no se cobra/i)).not.toBeInTheDocument();
  });

  it('uses the singular when Mercado Pago covers one lunch (F26)', async () => {
    renderSheet({ order: { ...partial, creditTotal: 2 } });

    expect(
      await screen.findByText(
        'Si ya pagaste con Mercado Pago, cuando se confirme el pago te acreditamos ese almuerzo en tu saldo.',
      ),
    ).toBeInTheDocument();
  });

  it('pluralizes the reserved lunches', async () => {
    renderSheet({ order: { ...partial, creditsFromBalance: 3 } });

    expect(await screen.findByText('Tus 3 almuerzos reservados vuelven a tu saldo')).toBeInTheDocument();
  });

  it('keeps "Tu saldo no cambia" when nothing was reserved from the balance', async () => {
    renderSheet({ order: { ...partial, creditsFromBalance: 0 } });

    expect(await screen.findByText('Tu saldo no cambia')).toBeInTheDocument();
  });
});

describe('CancelOrderSheet — presentation (F22b)', () => {
  it('is a bottom sheet by default', async () => {
    renderSheet();
    expect(await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' })).toHaveAttribute('data-presentation', 'sheet');
  });

  it('is a centered dialog when asked', async () => {
    renderSheet({ presentation: 'dialog' });
    expect(await screen.findByRole('dialog', { name: '¿Cancelar este pedido?' })).toHaveAttribute('data-presentation', 'dialog');
  });
});
