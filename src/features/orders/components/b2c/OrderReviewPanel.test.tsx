import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { OrderReviewPanel } from './OrderReviewPanel';
import type { OrderReviewProps } from './orderReviewProps';

vi.mock('../../services/ordersApi', () => ({
  getPickupSlots: vi.fn().mockResolvedValue([]),
}));

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
});
