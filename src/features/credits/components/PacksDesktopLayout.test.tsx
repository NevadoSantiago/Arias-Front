import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { PacksDesktopLayout } from './PacksDesktopLayout';
import { buildCatalog } from '../purchaseModel';
import type { CreditPack } from '../types';

vi.mock('@/features/orders/services/ordersApi', () => ({
  getRestaurantConfig: vi.fn().mockResolvedValue({ horaCorte: '10:00', pickupWindowStart: null, pickupWindowEnd: null }),
}));

const week: CreditPack = { id: 2, code: 'WEEK', packType: 'SUGERIDO', nombre: 'Paquete Semana', creditAmount: 5, priceCents: 700000, discountPercent: 10, ordenDisplay: 2, enabled: true };

describe('PacksDesktopLayout', () => {
  it('has no pay button in the fallback aside when there is no valid plan (the selected pack left the catalog)', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PacksDesktopLayout
            catalog={buildCatalog([week])}
            selection={{ kind: 'pack', packId: 99 }}
            onSelect={() => {}}
            qty={1}
            onQtyChange={() => {}}
            plan={null}
            onPay={() => {}}
            isPending={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const aside = screen.getByRole('complementary', { name: 'Tu compra' });
    expect(aside).toHaveTextContent('Elegí qué querés comprar.');
    expect(screen.queryByRole('button', { name: /pagar/i })).not.toBeInTheDocument();
  });
});
