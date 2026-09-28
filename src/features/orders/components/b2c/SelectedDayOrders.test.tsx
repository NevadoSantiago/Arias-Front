import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SelectedDayOrders } from './SelectedDayOrders';
import type { OrderV2 } from '../../services/ordersApi';

function order(overrides: Partial<OrderV2> = {}): OrderV2 {
  return {
    id: 1,
    fecha: '2026-09-24',
    pickupAt: '2026-09-24T15:00:00Z',
    estado: 'PENDIENTE',
    creditTotal: 2,
    notas: null,
    items: [
      {
        id: 10,
        dishId: 10,
        dishNombre: 'Milanesa',
        dishCategoria: 'Premium',
        sideId: null,
        sideNombre: null,
        creditCost: 2,
        notas: null,
      },
    ],
    cancellable: true,
    modifiable: true,
    pickupTimeChangeable: true,
    ...overrides,
  };
}

function renderList(
  orders: OrderV2[],
  onRequestRemoveItem?: (order: OrderV2, item: OrderV2['items'][number]) => void,
  extra: Partial<Parameters<typeof SelectedDayOrders>[0]> = {},
) {
  render(
    <MemoryRouter>
      <SelectedDayOrders
        orders={orders}
        dayHeadingLabel="hoy"
        now={new Date('2026-09-24T10:00:00Z')}
        onRequestCancel={vi.fn()}
        onRequestRemoveItem={onRequestRemoveItem}
        {...extra}
      />
    </MemoryRouter>,
  );
}

describe('SelectedDayOrders — remove-item "×" (F16)', () => {
  it('shows a "×" for a dish when the order is cancellable and onRequestRemoveItem is provided', () => {
    const onRequestRemoveItem = vi.fn();
    renderList([order({ cancellable: true })], onRequestRemoveItem);

    const button = screen.getByRole('button', { name: /quitar milanesa/i });
    fireEvent.click(button);

    expect(onRequestRemoveItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.objectContaining({ id: 10, dishNombre: 'Milanesa' }),
    );
  });

  it('does not show a "×" when the order is not cancellable', () => {
    renderList([order({ cancellable: false })], vi.fn());

    expect(screen.queryByRole('button', { name: /quitar milanesa/i })).not.toBeInTheDocument();
  });

  it('does not show a "×" when onRequestRemoveItem is not provided (MyOrdersPage stays unchanged)', () => {
    renderList([order({ cancellable: true })]);

    expect(screen.queryByRole('button', { name: /quitar milanesa/i })).not.toBeInTheDocument();
  });

  // F18: un pedido PENDIENTE_PAGO es cancelable pero nunca modificable — no
  // debe ofrecer la "×" aunque `cancellable` sea true.
  it('does not show a "×" for a PENDIENTE_PAGO order even though it is cancellable', () => {
    const onRequestRemoveItem = vi.fn();
    renderList([order({ cancellable: true, estado: 'PENDIENTE_PAGO' })], onRequestRemoveItem);

    expect(screen.queryByRole('button', { name: /quitar milanesa/i })).not.toBeInTheDocument();
  });
});

// F18: "Tu pedido para <día>" también muestra el badge, el aviso de corte y
// "Pagar ahora" para un pedido PENDIENTE_PAGO — mismas props que "Mis
// pedidos", enhebradas a través de `SelectedDayOrders`.
describe('SelectedDayOrders — PENDIENTE_PAGO', () => {
  it('shows the badge, the deadline line and "Pagar ahora", wired through onRequestPayNow', () => {
    const onRequestPayNow = vi.fn();
    renderList(
      [order({ estado: 'PENDIENTE_PAGO', cancellable: true, pickupAt: '2026-09-24T16:00:00Z' })],
      undefined,
      { pickupLeadMinutes: 20, onRequestPayNow },
    );

    expect(screen.getByText('Pago pendiente')).toBeInTheDocument();
    expect(screen.getByText(/estamos esperando la confirmación de mercado pago/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /pagar ahora/i }));
    expect(onRequestPayNow).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

// Regla de pedidos del mismo día: el aviso del banner explica qué pasa según
// haya (o no) un pedido modificable ese día.
describe('SelectedDayOrders — same-day hint', () => {
  it('explains that the same time adds to the order and another time makes a new one', () => {
    renderList([order({ modifiable: true })]);

    expect(
      screen.getByText(/si elegís el mismo horario, lo que pidas se suma a ese pedido. con otro horario, armás un pedido nuevo./i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/cancelalo y armá uno nuevo/i)).not.toBeInTheDocument();
  });

  it('explains that an order awaiting payment is not added to', () => {
    renderList([order({ estado: 'PENDIENTE_PAGO', modifiable: false })]);

    expect(
      screen.getByText(/ese pedido espera el pago, así que lo que pidas ahora va en un pedido nuevo./i),
    ).toBeInTheDocument();
  });

  it('shows no same-day hint when no order can be added to nor is awaiting payment', () => {
    renderList([order({ estado: 'CONFIRMADO', cancellable: false, modifiable: false })]);

    expect(screen.queryByText(/lo que pidas/i)).not.toBeInTheDocument();
  });
});
