import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RemoveOrderItemSheet } from './RemoveOrderItemSheet';
import type { OrderItemV2, OrderV2 } from '../services/ordersApi';

const item: OrderItemV2 = {
  id: 1,
  dishId: 10,
  dishNombre: 'Milanesa',
  dishCategoria: 'Premium',
  sideId: null,
  sideNombre: null,
  creditCost: 2,
  notas: null,
};

const secondItem: OrderItemV2 = {
  id: 2,
  dishId: 11,
  dishNombre: 'Ensalada',
  dishCategoria: 'Básico',
  sideId: null,
  sideNombre: null,
  creditCost: 1,
  notas: null,
};

function order(items: OrderItemV2[]): OrderV2 {
  return {
    id: 123,
    fecha: '2026-09-24',
    pickupAt: '2026-09-24T15:00:00Z',
    estado: 'PENDIENTE',
    creditTotal: items.reduce((sum, i) => sum + i.creditCost, 0),
    notas: null,
    items,
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    paidWithMercadoPago: false,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof RemoveOrderItemSheet>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  const view = render(
    <RemoveOrderItemSheet
      target={{ order: order([item, secondItem]), item }}
      removing={false}
      errorMessage={null}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onClose, onConfirm };
}

describe('RemoveOrderItemSheet', () => {
  it('shows the confirmation copy with the dish name and the credit refund, for a dish that is not the only one', () => {
    renderSheet();

    expect(screen.getByText('¿Quitar Milanesa de tu pedido?')).toBeInTheDocument();
    expect(screen.getByText(/vuelve 2 almuerzos a tu saldo/i)).toBeInTheDocument();
    expect(screen.queryByText(/se cancela el pedido/i)).not.toBeInTheDocument();
  });

  it('warns that the order will be cancelled when it is the only dish', () => {
    renderSheet({ target: { order: order([item]), item } });

    expect(screen.getByText('¿Quitar Milanesa de tu pedido?')).toBeInTheDocument();
    expect(screen.getByText(/es el único plato: se cancela el pedido/i)).toBeInTheDocument();
  });

  it('calls onConfirm when "Sí, quitar" is clicked and onClose when "No" is clicked', () => {
    const { onConfirm, onClose } = renderSheet();

    fireEvent.click(screen.getByRole('button', { name: /sí, quitar/i }));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^no$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the error message inside the modal', () => {
    renderSheet({ errorMessage: 'No pudimos quitar el plato.' });

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos quitar el plato.');
  });

  it('stays open and disables the buttons while removing is pending, ignoring Escape', () => {
    const { onClose } = renderSheet({ removing: true });

    expect(screen.getByRole('button', { name: /quitando…/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^no$/i })).toBeDisabled();

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('¿Quitar Milanesa de tu pedido?')).toBeInTheDocument();
  });

  it('renders nothing open when target is null', () => {
    renderSheet({ target: null });

    expect(screen.queryByText(/¿quitar/i)).not.toBeInTheDocument();
  });
});
