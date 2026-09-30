import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseHistory } from './PurchaseHistory';
import { getMovements } from '../services/creditsApi';
import type { CreditMovement } from '../types';

vi.mock('../services/creditsApi', () => ({
  getMovements: vi.fn(),
}));

function movement(overrides: Partial<CreditMovement> & Pick<CreditMovement, 'id' | 'type'>): CreditMovement {
  return {
    deltaAvailable: 0,
    deltaCommitted: 0,
    description: null,
    createdAt: '2026-05-01T12:00:00Z',
    ...overrides,
  } as CreditMovement;
}

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PurchaseHistory />
    </QueryClientProvider>,
  );
}

describe('PurchaseHistory', () => {
  it('shows the first 5 movements with a signed amount and an icon each, then reveals the rest on "Ver movimientos anteriores"', async () => {
    const movements = Array.from({ length: 7 }, (_, i) =>
      movement({
        id: i + 1,
        type: 'PACK_PURCHASE',
        deltaAvailable: 5,
        description: `Compra ${i + 1}`,
      }),
    );
    vi.mocked(getMovements).mockResolvedValueOnce(movements);

    renderHistory();

    let items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Compra 1');
    // Un ícono por fila.
    items.forEach((item) => expect(item.querySelector('svg')).toBeTruthy());
    expect(screen.getAllByText('+5')).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: /ver movimientos anteriores/i }));

    items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[6]).toHaveTextContent('Compra 7');
  });

  it('does not show the toggle when there are 5 or fewer movements', async () => {
    vi.mocked(getMovements).mockResolvedValueOnce([
      movement({ id: 1, type: 'CONSUME', deltaAvailable: -1 }),
    ]);

    renderHistory();

    await screen.findByRole('listitem');
    expect(screen.queryByRole('button', { name: /ver movimientos anteriores/i })).not.toBeInTheDocument();
  });

  it('shows a negative sign for a negative movement', async () => {
    vi.mocked(getMovements).mockResolvedValueOnce([
      movement({ id: 1, type: 'COMMIT', deltaAvailable: -1 }),
    ]);

    renderHistory();

    expect(await screen.findByText('-1')).toBeInTheDocument();
  });

  // F18 (backend B7): una compra DIRECT aprobada con el pedido ya cancelado
  // manda los almuerzos a disponibles en vez de perderlos — se muestra como
  // un movimiento positivo, con su propia etiqueta.
  it('labels DIRECT_PURCHASE_REFUND as a positive movement back to the balance', async () => {
    vi.mocked(getMovements).mockResolvedValueOnce([
      movement({ id: 1, type: 'DIRECT_PURCHASE_REFUND', deltaAvailable: 2 }),
    ]);

    renderHistory();

    expect(await screen.findByText(/pago de un pedido cancelado/i)).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveClass('text-success');
  });
});
