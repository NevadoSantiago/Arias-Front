import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      packType: 'OTRO',
      nombre: 'Paquete 10',
      creditAmount: 10,
      priceCents: 1500000,
      discountPercent: 5,
      ordenDisplay: 1,
      enabled: true,
    });

    renderDialog();

    fireEvent.change(screen.getByLabelText(/^tipo$/i), { target: { value: 'OTRO' } });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Paquete 10' } });
    fireEvent.change(screen.getByLabelText(/^almuerzos$/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^precio \(ars\)$/i), { target: { value: '15000' } });
    fireEvent.change(screen.getByLabelText(/^descuento/i), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /crear paquete/i }));

    expect(await screen.findByRole('button', { name: /crear paquete/i })).toBeInTheDocument();
    expect(createCreditPack).toHaveBeenCalledWith(
      expect.objectContaining({
        packType: 'OTRO',
        priceCents: 1_500_000,
        discountPercent: 5,
      }),
    );
  });

  it('never recalculates price from the discount when editing — sends priceCents as-is', async () => {
    vi.mocked(updateCreditPack).mockResolvedValueOnce({
      id: 2,
      code: 'PACK20',
      packType: 'OTRO',
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
        packType: 'OTRO',
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

  it('does not send a code on create — the server generates it', async () => {
    vi.mocked(createCreditPack).mockResolvedValueOnce({} as never);
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^tipo$/i), { target: { value: 'INDIVIDUAL' } });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Sueltos' } });
    fireEvent.change(screen.getByLabelText(/^precio \(ars\)$/i), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: /crear paquete/i }));
    await waitFor(() => expect(createCreditPack).toHaveBeenCalled());
    const payload = vi.mocked(createCreditPack).mock.calls.at(-1)![0] as unknown as Record<string, unknown>;
    expect(payload.packType).toBe('INDIVIDUAL');
    expect(payload).not.toHaveProperty('code');
    expect(screen.queryByLabelText(/^código$/i)).not.toBeInTheDocument();
  });

  it('labels the options Individual / Sugerido / Otro and disables existing singleton types', () => {
    renderDialog({ existingTypes: ['INDIVIDUAL'] });
    const individual = screen.getByRole('option', { name: /individual · ya existe/i }) as HTMLOptionElement;
    expect(individual.disabled).toBe(true);
    expect((screen.getByRole('option', { name: /^sugerido$/i }) as HTMLOptionElement).disabled).toBe(false);
    expect((screen.getByRole('option', { name: /^otro$/i }) as HTMLOptionElement).disabled).toBe(false);
  });

  it('shows a help line for the selected type', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^tipo$/i), { target: { value: 'SUGERIDO' } });
    expect(screen.getByText(/se sugiere a quien compra almuerzos sueltos/i)).toBeInTheDocument();
  });

  it('locks the type select when editing', () => {
    renderDialog({
      editing: {
        id: 2, code: 'PACK20', packType: 'SUGERIDO', nombre: 'Semana', creditAmount: 5,
        priceCents: 700000, discountPercent: 0, ordenDisplay: 2, enabled: true,
      },
    });
    const select = screen.getByLabelText(/^tipo$/i) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.value).toBe('SUGERIDO');
  });

  it('shows a clear Spanish message on a duplicate type (409)', async () => {
    vi.mocked(createCreditPack).mockRejectedValueOnce({
      response: { status: 409, data: { type: 'https://arias.com/errors/credit-pack-type-duplicate', detail: 'Ya existe un paquete de tipo INDIVIDUAL' } },
    });
    renderDialog();
    fireEvent.change(screen.getByLabelText(/^tipo$/i), { target: { value: 'SUGERIDO' } });
    fireEvent.change(screen.getByLabelText(/^nombre$/i), { target: { value: 'Semana' } });
    fireEvent.change(screen.getByLabelText(/^precio \(ars\)$/i), { target: { value: '7000' } });
    fireEvent.click(screen.getByRole('button', { name: /crear paquete/i }));
    expect(await screen.findByText(/ya existe un paquete de ese tipo/i)).toBeInTheDocument();
  });
});
