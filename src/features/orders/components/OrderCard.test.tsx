import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrderCard } from './OrderCard';
import type { OrderV2 } from '../services/ordersApi';

const NOW = new Date('2026-09-24T12:00:00Z');

const order: OrderV2 = {
  id: 77,
  fecha: '2026-09-24',
  pickupAt: '2026-09-24T16:00:00Z',
  estado: 'PENDIENTE',
  creditTotal: 1,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

function renderCard(props: Partial<React.ComponentProps<typeof OrderCard>> = {}) {
  const handlers = {
    onRequestCancel: vi.fn(),
    onRequestChangePickupTime: vi.fn(),
    onRequestPayNow: vi.fn(),
    onOpen: vi.fn(),
  };
  render(
    <ul>
      <OrderCard order={order} now={NOW} {...handlers} {...props} />
    </ul>,
  );
  return handlers;
}

describe('OrderCard — open the comanda (F20)', () => {
  it('offers no "open" control when onOpen is not passed (the card stays as before)', () => {
    renderCard({ onOpen: undefined });

    expect(screen.queryByRole('button', { name: /ver la comanda/i })).not.toBeInTheDocument();
  });

  it('opens the comanda from a keyboard-reachable control named after the order', () => {
    const { onOpen } = renderCard();

    const open = screen.getByRole('button', { name: /ver la comanda del pedido del hoy.*24 de septiembre, retiro 13:00, programado/i });
    fireEvent.click(open);

    expect(onOpen).toHaveBeenCalledWith(order);
    // Anillo de foco visible en la tarjeta entera (el área táctil cubre la tarjeta).
    expect(open.className).toMatch(/focus-visible:/);
  });

  it('keeps the card actions on separate hit areas: they never open the comanda', () => {
    const { onOpen, onRequestCancel, onRequestChangePickupTime } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /^cancelar pedido$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cambiar el horario de retiro/i }));

    expect(onRequestCancel).toHaveBeenCalled();
    expect(onRequestChangePickupTime).toHaveBeenCalledWith(order);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('"Pagar ahora" never opens the comanda either', () => {
    const { onOpen, onRequestPayNow } = renderCard({
      order: { ...order, estado: 'PENDIENTE_PAGO', paidWithMercadoPago: true },
    });

    fireEvent.click(screen.getByRole('button', { name: /pagar ahora/i }));

    expect(onRequestPayNow).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
