import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrderReviewPanel } from './OrderReviewPanel';
import type { CartLine } from '../../hooks/useCart';
import type { OrderReviewProps } from './orderReviewProps';

vi.mock('../../services/ordersApi', () => ({
  getPickupSlots: vi.fn().mockResolvedValue([]),
}));

const cartLine: CartLine = {
  localId: 'l1',
  dish: {
    id: 10,
    nombre: 'Milanesa napolitana',
    descripcion: '',
    fotoUrl: null,
    category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 3 },
    menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
    sideType: null,
    allowedSides: [],
    stockActual: 5,
    especial: false,
  },
  sideId: null,
  sideNombre: null,
  notas: null,
};

function baseProps(overrides: Partial<OrderReviewProps> = {}): OrderReviewProps {
  return {
    isToday: true,
    dayShortLabel: 'jueves 24',
    fecha: '2026-05-21',
    suggestion: null,
    onSelectPickup: vi.fn(),
    addToOrder: null,
    newOrderNotice: null,
    pickupTimeLabel: null,
    pickupJumpTo: null,
    onJoinOrder: vi.fn(),
    lines: [],
    totalLunches: 0,
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

function renderPanel(overrides: Partial<OrderReviewProps> = {}) {
  const props = baseProps(overrides);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <OrderReviewPanel {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return props;
}

describe('OrderReviewPanel', () => {
  it('cannot confirm with an empty cart, even if the parent says canConfirm', () => {
    const props = renderPanel({ lines: [], canConfirm: true });

    const button = screen.getByRole('button', { name: 'Confirmar pedido' });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Agregá al menos un plato para confirmar.')).toBeInTheDocument();
  });

  it('labels today', () => {
    renderPanel();
    expect(screen.getByText('Para retirar hoy, jueves 24')).toBeInTheDocument();
  });

  it('labels a scheduled day', () => {
    renderPanel({ isToday: false });
    expect(screen.getByText('Pedido programado para el jueves 24')).toBeInTheDocument();
  });

  it('offers to use the available lunches and pay the rest with Mercado Pago when the balance covers part (F23)', () => {
    renderPanel({ lines: [cartLine], walletAvailable: 2, totalLunches: 3 });

    expect(screen.getByText('Te falta 1 almuerzo')).toBeInTheDocument();
    expect(
      screen.getByText('Podés usar tus 2 almuerzos y pagar 1 con Mercado Pago, o comprar un paquete y ahorrar.'),
    ).toBeInTheDocument();
  });

  it('keeps the "pay only this order" text with an empty balance (F23)', () => {
    renderPanel({ lines: [cartLine], walletAvailable: 0, totalLunches: 2 });

    expect(
      screen.getByText('Podés pagar solo este pedido con Mercado Pago, o comprar un paquete y ahorrar.'),
    ).toBeInTheDocument();
  });
});

function renderPanelWith(overrides: Partial<OrderReviewProps>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (o: Partial<OrderReviewProps>) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OrderReviewPanel {...baseProps(o)} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(ui(overrides));
  return { ...view, rerender: (o: Partial<OrderReviewProps>) => view.rerender(ui(o)) };
}

describe('OrderReviewPanel — gift dessert', () => {
  const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString();

  it('offers to pick the pending gift dessert and shows the chosen one with its free line', () => {
    const onPick = vi.fn();
    const onRemove = vi.fn();
    const gift = { pending: { expiresAt: inThreeDays }, chosen: null, teaser: null, onPick, onRemove };
    const { rerender } = renderPanelWith({ lines: [cartLine], totalLunches: 3, gift });

    fireEvent.click(screen.getByRole('button', { name: /elegir postre/i }));
    expect(onPick).toHaveBeenCalledTimes(1);

    rerender({ lines: [cartLine], totalLunches: 3, gift: { ...gift, chosen: { nombre: 'Flan casero', fotoUrl: null } } });
    expect(screen.getByText('Flan casero')).toBeInTheDocument();
    expect(screen.getByText('Este pedido usa').nextElementSibling).toHaveTextContent('3 almuerzos');
    fireEvent.click(screen.getByRole('button', { name: /quitar$/i }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('shows the lunches missing for the dessert', () => {
    const gift = { pending: null, chosen: null, teaser: 'Te faltan 4 almuerzos para tu postre de regalo.', onPick: vi.fn(), onRemove: vi.fn() };
    renderPanelWith({ lines: [cartLine], totalLunches: 3, gift });

    expect(screen.getByText('Te faltan 4 almuerzos para tu postre de regalo.')).toBeInTheDocument();
  });

  it('shows no dessert while the cart is empty', () => {
    const gift = { pending: { expiresAt: inThreeDays }, chosen: null, teaser: null, onPick: vi.fn(), onRemove: vi.fn() };
    renderPanelWith({ lines: [], gift });

    expect(screen.queryByRole('button', { name: /elegir postre/i })).not.toBeInTheDocument();
  });
});
