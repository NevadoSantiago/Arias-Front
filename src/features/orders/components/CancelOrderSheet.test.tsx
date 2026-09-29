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
