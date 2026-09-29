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
    lastUsedTimeOfDay: null,
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
