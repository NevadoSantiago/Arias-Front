import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreditPackFormDialog } from './CreditPackFormDialog';
import { createCreditPack, updateCreditPack } from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/services/adminApi', () => ({
  createCreditPack: vi.fn(),
  updateCreditPack: vi.fn(),
}));

function renderDialog(props: Partial<React.ComponentProps<typeof CreditPackFormDialog>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreditPackFormDialog open onClose={vi.fn()} editing={null} {...props} />
    </QueryClientProvider>,
  );
}

describe('CreditPackFormDialog', () => {
  it('converts the ARS price to priceCents on create — priceCents is the authoritative value', async () => {
    vi.mocked(createCreditPack).mockResolvedValueOnce({
      id: 1,
      code: 'PACK10',
      nombre: 'Paquete 10',
      creditAmount: 10,
      priceCents: 1500000,
      discountPercent: 5,
      ordenDisplay: 1,
      enabled: true,
    });

    renderDialog();

    fireEvent.change(screen.getByLabelText(/^código$/i), { target: { value: 'pack10' } });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Paquete 10' } });
    fireEvent.change(screen.getByLabelText(/^almuerzos$/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^precio \(ars\)$/i), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText(/^descuento/i), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /crear paquete/i }));

    expect(await screen.findByRole('button', { name: /crear paquete/i })).toBeInTheDocument();
    expect(createCreditPack).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'pack10',
        priceCents: 1_500_000,
        discountPercent: 5,
      }),
    );
  });

  it('never recalculates price from the discount when editing — sends priceCents as-is', async () => {
    vi.mocked(updateCreditPack).mockResolvedValueOnce({
      id: 2,
      code: 'PACK20',
      nombre: 'Paquete 20 editado',
      creditAmount: 20,
      priceCents: 2800000,
      discountPercent: 10,
      ordenDisplay: 2,
      enabled: true,
    });

    renderDialog({
      editing: {
        id: 2,
        code: 'PACK20',
        nombre: 'Paquete 20',
        creditAmount: 20,
        priceCents: 3000000,
        discountPercent: 0,
        ordenDisplay: 2,
        enabled: true,
      },
    });

    fireEvent.change(screen.getByLabelText(/^precio \(ars\)$/i), { target: { value: '28000' } });
    fireEvent.change(screen.getByLabelText(/^descuento/i), { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByRole('button', { name: /guardar cambios/i })).toBeInTheDocument();
    expect(updateCreditPack).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ priceCents: 2_800_000, discountPercent: 10, enabled: true }),
    );
  });
});
