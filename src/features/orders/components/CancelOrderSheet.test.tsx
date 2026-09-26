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
});
