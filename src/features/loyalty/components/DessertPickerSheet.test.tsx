import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DessertPickerSheet } from './DessertPickerSheet';
import { getAvailableDesserts } from '../services/loyaltyApi';

vi.mock('../services/loyaltyApi', () => ({ getAvailableDesserts: vi.fn() }));

const DAY = 86_400_000;

const desserts = [
  { id: 1, nombre: 'Flan casero', descripcion: 'Con dulce de leche', fotoUrl: null, stockActual: 5 },
  { id: 2, nombre: 'Brownie', descripcion: null, fotoUrl: null, stockActual: 1 },
  { id: 3, nombre: 'Tiramisú', descripcion: 'Del día', fotoUrl: null, stockActual: 0 },
];

function renderPicker(props: Partial<React.ComponentProps<typeof DessertPickerSheet>> = {}) {
  const handlers = { onClose: vi.fn(), onConfirm: vi.fn() };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <DessertPickerSheet
        open
        expiresAt={new Date(Date.now() + 3 * DAY).toISOString()}
        selectedId={null}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...handlers, queryClient };
}

describe('DessertPickerSheet', () => {
  beforeEach(() => {
    vi.mocked(getAvailableDesserts).mockReset().mockResolvedValue(desserts);
  });

  it("lists the available desserts with name, description and today's stock", async () => {
    renderPicker();

    expect(await screen.findByRole('dialog', { name: /elegí tu postre/i })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /flan casero/i })).toBeInTheDocument();
    expect(screen.getByText('Con dulce de leche')).toBeInTheDocument();
    expect(screen.getByText('Quedan 5 hoy')).toBeInTheDocument();
    expect(screen.getByText('Quedan 1 hoy')).toBeInTheDocument();
    expect(screen.getByText(/de regalo, sin cargo · vence en 3 días/i)).toBeInTheDocument();
  });

  it('disables a dessert with no stock and says so', async () => {
    renderPicker();

    const out = await screen.findByRole('radio', { name: /tiramisú/i });
    expect(out).toBeDisabled();
    expect(screen.getByText('Sin stock hoy')).toBeInTheDocument();
  });

  it('selects a dessert and confirms it with its data', async () => {
    const { onConfirm } = renderPicker();

    const confirm = await screen.findByRole('button', { name: /sumar al pedido/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(await screen.findByRole('radio', { name: /brownie/i }));
    expect(screen.getByRole('radio', { name: /brownie/i })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledWith({ dessertId: 2, nombre: 'Brownie', fotoUrl: null });
  });

  it('starts on the current choice so it can be changed', async () => {
    const { onConfirm } = renderPicker({ selectedId: 1 });

    expect(await screen.findByRole('radio', { name: /flan casero/i })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(await screen.findByRole('radio', { name: /brownie/i }));
    fireEvent.click(screen.getByRole('button', { name: /sumar al pedido/i }));

    expect(onConfirm).toHaveBeenCalledWith({ dessertId: 2, nombre: 'Brownie', fotoUrl: null });
  });

  it('does not keep a current choice that ran out of stock', async () => {
    renderPicker({ selectedId: 3 });

    await screen.findByRole('radio', { name: /tiramisú/i });
    expect(screen.getByRole('button', { name: /sumar al pedido/i })).toBeDisabled();
  });

  it('says there are none when no dessert is available today', async () => {
    vi.mocked(getAvailableDesserts).mockResolvedValue([]);
    renderPicker();

    expect(await screen.findByText(/hoy no hay postres disponibles/i)).toBeInTheDocument();
  });

  it('says it could not load them when the request fails', async () => {
    vi.mocked(getAvailableDesserts).mockRejectedValue(new Error('boom'));
    renderPicker();

    expect(await screen.findByText(/no pudimos cargar los postres/i)).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const { onClose } = renderPicker();

    fireEvent.click(await screen.findByRole('button', { name: /cerrar/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it('does not fetch while closed', () => {
    renderPicker({ open: false });

    expect(getAvailableDesserts).not.toHaveBeenCalled();
  });
});
