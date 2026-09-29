import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChangePickupTimeSheet } from './ChangePickupTimeSheet';
import { getPickupSlots } from '../services/ordersApi';
import type { OrderV2 } from '../services/ordersApi';

vi.mock('../services/ordersApi', () => ({
  getPickupSlots: vi.fn(),
}));

const CURRENT = '2026-05-21T15:00:00Z';
const OTHER = '2026-05-21T15:30:00Z';
const SLOTS = [CURRENT, '2026-05-21T15:10:00Z', OTHER];

function localHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const order: OrderV2 = {
  id: 77,
  fecha: '2026-05-21',
  pickupAt: CURRENT,
  estado: 'PENDIENTE',
  creditTotal: 3,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa', dishCategoria: 'Premium', sideId: 5, sideNombre: 'Puré', creditCost: 2, notas: null },
    { id: 2, dishId: 11, dishNombre: 'Ensalada', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
};

function renderSheet(props: Partial<React.ComponentProps<typeof ChangePickupTimeSheet>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ChangePickupTimeSheet
        order={order}
        changing={false}
        errorMessage={null}
        onConfirm={onConfirm}
        onClose={onClose}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onConfirm, onClose };
}

function pickOther() {
  const target = new Date(OTHER);
  fireEvent.change(screen.getByLabelText('Hora de retiro'), { target: { value: String(target.getHours()) } });
  fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: String(target.getMinutes()) } });
}

describe('ChangePickupTimeSheet', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when there is no order', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    renderSheet({ order: null });

    expect(screen.queryByText('Cambiar horario de retiro')).not.toBeInTheDocument();
    expect(getPickupSlots).not.toHaveBeenCalled();
  });

  it('step 1 shows the current time and items, asks for that day slots, and disables "Continuar" while unchanged', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    renderSheet();

    expect(await screen.findByText('Cambiar horario de retiro')).toBeInTheDocument();
    expect(getPickupSlots).toHaveBeenCalledWith('2026-05-21');
    expect(screen.getByText('Horario actual')).toBeInTheDocument();
    expect(screen.getByText('Milanesa · puré + Ensalada')).toBeInTheDocument();
    expect(await screen.findByLabelText('Hora de retiro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('enables "Continuar" once another slot is picked and goes to the before/after confirm step', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    renderSheet();
    await screen.findByLabelText('Hora de retiro');

    pickOther();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByText(`¿Cambiar el retiro a las ${localHM(OTHER)}?`)).toBeInTheDocument();
    expect(screen.getByText('Antes')).toBeInTheDocument();
    expect(screen.getByText('Ahora')).toBeInTheDocument();
    expect(screen.getByText(localHM(CURRENT))).toBeInTheDocument();
    expect(screen.getByText(/tu pedido y tus almuerzos no cambian/i)).toBeInTheDocument();
  });

  it('confirms with the exact ISO slot the backend returned', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    const { onConfirm } = renderSheet();
    await screen.findByLabelText('Hora de retiro');

    pickOther();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: /sí, cambiar horario/i }));

    expect(onConfirm).toHaveBeenCalledWith(OTHER);
  });

  it('"Elegir otro horario" goes back to step 1 keeping the picked time', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    renderSheet();
    await screen.findByLabelText('Hora de retiro');

    pickOther();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: /elegir otro horario/i }));

    expect(screen.getByText('Cambiar horario de retiro')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('shows the backend error in the confirm step and disables the button while changing', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    renderSheet({ errorMessage: 'El horario de retiro ya no se puede cambiar.' });
    await screen.findByLabelText('Hora de retiro');
    pickOther();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('El horario de retiro ya no se puede cambiar.');
  });

  it('"Volver sin cambiar" closes the sheet', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(SLOTS);
    const { onClose } = renderSheet();
    await screen.findByLabelText('Hora de retiro');

    fireEvent.click(screen.getByRole('button', { name: /volver sin cambiar/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
