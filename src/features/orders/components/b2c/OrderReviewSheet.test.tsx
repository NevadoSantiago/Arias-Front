import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrderReviewSheet } from './OrderReviewSheet';
import { getPickupSlots } from '../../services/ordersApi';
import type { CartLine } from '../../hooks/useCart';
import type { Dish } from '../../types';

vi.mock('../../services/ordersApi', () => ({
  getPickupSlots: vi.fn(),
}));

const dish: Dish = {
  id: 10,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 2 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};

const line: CartLine = { localId: 'l1', dish, sideId: null, sideNombre: null, notas: null };

function baseProps(overrides: Partial<Parameters<typeof OrderReviewSheet>[0]> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    isToday: true,
    dayShortLabel: 'jueves 24',
    fecha: '2026-05-21',
    lastUsedTimeOfDay: null,
    onSelectPickup: vi.fn(),
    addToOrder: null,
    newOrderNotice: null,
    pickupTimeLabel: null,
    pickupJumpTo: null,
    onJoinOrder: vi.fn(),
    lines: [line],
    totalLunches: 2,
    onRemoveLine: vi.fn(),
    walletAvailable: 12,
    confirmLabel: 'Confirmar pedido',
    canConfirm: true,
    submitting: false,
    submitError: null,
    insufficientBalance: false,
    onConfirm: vi.fn(),
    ...overrides,
  };
}

function renderSheet(overrides: Partial<Parameters<typeof OrderReviewSheet>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const props = baseProps(overrides);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrderReviewSheet {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return props;
}

describe('OrderReviewSheet', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Para retirar hoy, <día>" for today', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ isToday: true, dayShortLabel: 'jueves 24' });

    expect(screen.getByText('Para retirar hoy, jueves 24')).toBeInTheDocument();
  });

  it('shows "Pedido programado para el <día>" for a future day', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ isToday: false, dayShortLabel: 'lunes 28' });

    expect(screen.getByText('Pedido programado para el lunes 28')).toBeInTheDocument();
  });

  it('lists the cart lines and removes one when its remove button is clicked', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    const props = renderSheet();

    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quitar milanesa napolitana/i }));
    expect(props.onRemoveLine).toHaveBeenCalledWith('l1');
  });

  it('embeds the pickup time picker and forwards the selected slot', async () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    const props = renderSheet();

    await screen.findByRole('radio', { name: /lo antes posible/i });
    expect(props.onSelectPickup).toHaveBeenCalledWith('2026-05-21T15:00:00Z');
  });

  it('shows the display-only balance math from the wallet', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ walletAvailable: 12, totalLunches: 2 });

    expect(screen.getByText('Tenés disponibles')).toBeInTheDocument();
    expect(screen.getByText('12 almuerzos')).toBeInTheDocument();
    expect(screen.getByText('Este pedido usa')).toBeInTheDocument();
    expect(screen.getByText('Te quedan')).toBeInTheDocument();
    expect(screen.getByText('10 almuerzos')).toBeInTheDocument();
  });

  it('hides the balance box when the wallet balance is not known yet', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ walletAvailable: null });

    expect(screen.queryByText('Tenés disponibles')).not.toBeInTheDocument();
  });

  it('shows the confirm button with the given label, disabled when canConfirm is false', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    const props = renderSheet({ confirmLabel: 'Retiro hoy 15:00 hs', canConfirm: false });

    const button = screen.getByRole('button', { name: /retiro hoy 15:00 hs/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when the confirm button is enabled and clicked', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    const props = renderSheet({ confirmLabel: 'Retiro hoy 15:00 hs', canConfirm: true });

    fireEvent.click(screen.getByRole('button', { name: /retiro hoy 15:00 hs/i }));
    expect(props.onConfirm).toHaveBeenCalled();
  });

  it('shows the submit error as an alert', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ submitError: 'Ocurrió un error al confirmar el pedido.' });

    expect(screen.getByRole('alert')).toHaveTextContent('Ocurrió un error al confirmar el pedido.');
  });

  it('calls onClose when "Agregar otro plato" is clicked', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    const props = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: /agregar otro plato/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});

// F16: agregar platos a un pedido modificable en vez de armar uno nuevo.
describe('OrderReviewSheet — add to an existing order (F16)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "Se agrega a tu pedido de las HH:MM" and KEEPS the pickup time picker visible when addToOrder is set', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({
      addToOrder: { pickupAt: '2026-05-21T15:00:00Z' },
      confirmLabel: 'Sumar a mi pedido de las 12:00',
    });

    expect(screen.getByText(/se agrega a tu pedido de las \d{2}:\d{2}/i)).toBeInTheDocument();
    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    expect(getPickupSlots).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /sumar a mi pedido de las/i })).toBeInTheDocument();
  });

  it('explains that a different time makes a new order and leaves the existing one as is', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T18:00:00Z']);
    renderSheet({
      pickupTimeLabel: '15:00',
      newOrderNotice: {
        otherPickupAts: ['2026-05-21T15:00:00Z'],
        lockedSamePickupAt: null,
        joinablePickupAt: '2026-05-21T15:00:00Z',
      },
    });

    expect(screen.getByText('Nuevo pedido a las 15:00')).toBeInTheDocument();
    expect(screen.getByText(/tu pedido de las \d{2}:\d{2} queda como está/i)).toBeInTheDocument();
  });

  it('offers a shortcut to switch to the existing order time', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T18:00:00Z']);
    const { onJoinOrder } = renderSheet({
      pickupTimeLabel: '15:00',
      newOrderNotice: {
        otherPickupAts: ['2026-05-21T15:00:00Z'],
        lockedSamePickupAt: null,
        joinablePickupAt: '2026-05-21T15:00:00Z',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /sumarlo al pedido de las \d{2}:\d{2}/i }));
    expect(onJoinOrder).toHaveBeenCalledWith('2026-05-21T15:00:00Z');
  });

  it('says the order goes apart when the same-time order is awaiting payment, with no shortcut', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({
      pickupTimeLabel: '12:00',
      newOrderNotice: {
        otherPickupAts: ['2026-05-21T15:00:00Z'],
        lockedSamePickupAt: '2026-05-21T15:00:00Z',
        joinablePickupAt: null,
      },
    });

    expect(screen.getByText(/espera el pago, así que este va aparte/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sumarlo al pedido/i })).not.toBeInTheDocument();
  });

  it('shows the pickup time picker (no addToOrder line) for a normal new order', () => {
    vi.mocked(getPickupSlots).mockResolvedValue(['2026-05-21T15:00:00Z']);
    renderSheet({ addToOrder: null });

    expect(screen.getByText('¿A qué hora lo retirás?')).toBeInTheDocument();
    expect(screen.queryByText(/se agrega a tu pedido de las/i)).not.toBeInTheDocument();
  });
});
