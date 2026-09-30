import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseHistory } from './PurchaseHistory';
import { getMovements } from '../services/creditsApi';
import type { CreditMovement } from '../types';

vi.mock('../services/creditsApi', () => ({ getMovements: vi.fn() }));

const movement: CreditMovement = {
  id: 1,
  type: 'PACK_PURCHASE',
  deltaAvailable: 5,
  deltaCommitted: 0,
  orderId: null,
  purchaseId: 'p',
  description: 'Mercado Pago',
  createdAt: '2026-05-01T12:00:00Z',
};

function renderHistory(layout?: 'wide') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(getMovements).mockResolvedValue([movement]);
  return render(
    <QueryClientProvider client={queryClient}>
      <PurchaseHistory layout={layout} />
    </QueryClientProvider>,
  );
}

describe('PurchaseHistory layouts (F22c)', () => {
  it('default (mobile): the date rides in the detail line', async () => {
    const { container } = renderHistory();

    const item = (await screen.findAllByRole('listitem'))[0];
    expect(item).toHaveTextContent(/2026 · Mercado Pago/);
    expect(container.querySelector('time')).toBeNull();
  });

  it('wide (desktop): the date has its own column and the detail line keeps only the description', async () => {
    const { container } = renderHistory('wide');

    const item = (await screen.findAllByRole('listitem'))[0];
    const time = container.querySelector('time');
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute('datetime', '2026-05-01T12:00:00Z');
    expect(item).toHaveTextContent('Mercado Pago');
    expect(item).not.toHaveTextContent(/2026 · Mercado Pago/);
  });
});
