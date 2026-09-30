import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WeekSwitch, WeekView } from './WeekViews';
import { buildOrderWeeks } from './myOrdersWeeks';
import type { OrderV2 } from '../../services/ordersApi';

// Jueves 24 de septiembre de 2026, 11:40 en Buenos Aires.
const NOW = new Date('2026-09-24T11:40:00-03:00');

const order = (id: number, pickupAt: string): OrderV2 => ({
  id,
  fecha: pickupAt.slice(0, 10),
  pickupAt,
  estado: 'PENDIENTE',
  creditTotal: 1,
  notas: null,
  items: [],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
});

function weeks(upcoming: OrderV2[], past: OrderV2[] = []) {
  return buildOrderWeeks({ upcoming, past, now: NOW });
}

const renderOrder = (o: OrderV2) => <li key={o.id}>pedido {o.id}</li>;

function renderWeek(week: ReturnType<typeof weeks>[number], props: Partial<React.ComponentProps<typeof WeekView>> = {}) {
  render(
    <MemoryRouter>
      <WeekView week={week} variant="mobile" showPast={false} onShowPast={() => {}} renderOrder={renderOrder} {...props} />
    </MemoryRouter>,
  );
}

describe('WeekSwitch', () => {
  it('shows each week with its dates and order count, and marks the selected one', () => {
    const [esta, proxima] = weeks([order(1, '2026-09-25T13:00:00-03:00'), order(2, '2026-09-29T13:00:00-03:00'), order(3, '2026-09-30T13:00:00-03:00')]);
    const onSelect = vi.fn();
    render(<WeekSwitch weeks={[esta, proxima]} selected="esta" onSelect={onSelect} />);

    const first = screen.getByRole('button', { name: /esta semana/i });
    const second = screen.getByRole('button', { name: /semana próxima/i });
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(second).toHaveAttribute('aria-pressed', 'false');
    expect(within(first).getByText('21–25 sep')).toBeInTheDocument();
    expect(within(first).getByText('1')).toBeInTheDocument();
    expect(within(second).getByText('28 sep – 2 oct')).toBeInTheDocument();
    expect(within(second).getByText('2')).toBeInTheDocument();

    fireEvent.click(second);
    expect(onSelect).toHaveBeenCalledWith('proxima');
  });
});

describe('WeekView — mobile', () => {
  it('shows a header per day with its orders, "Hoy" on today, and a compact empty day', () => {
    const [esta] = weeks([order(1, '2026-09-24T12:00:00-03:00')]);
    renderWeek(esta);

    const today = screen.getByRole('heading', { name: /jueves 24/i });
    expect(within(today).getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('pedido 1')).toBeInTheDocument();
    const friday = screen.getByRole('heading', { name: /viernes 25/i }).parentElement as HTMLElement;
    expect(within(friday).getByText('Sin pedidos')).toBeInTheDocument();
  });

  it('shows the empty state with "Hacer un pedido" when the whole week has no orders', () => {
    const [esta, proxima] = weeks([]);
    renderWeek(proxima);

    expect(screen.getByText('No tenés pedidos para la semana próxima')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer un pedido' })).toHaveAttribute('href', '/orders/today');
    expect(screen.queryByText('Sin pedidos')).not.toBeInTheDocument();
    expect(esta.count).toBe(0);
  });

  it('says "No tenés pedidos esta semana" for the current week', () => {
    const [esta] = weeks([]);
    renderWeek(esta);

    expect(screen.getByText('No tenés pedidos esta semana')).toBeInTheDocument();
  });

  it('folds the past days into one line, with a link to the past orders that reveals them', () => {
    const past = [order(9, '2026-09-22T13:00:00-03:00')];
    const [esta] = weeks([order(1, '2026-09-25T13:00:00-03:00')], past);
    const onShowPast = vi.fn();
    renderWeek(esta, { onShowPast });

    expect(screen.getByText('Lunes 21 a miércoles 23')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver 1 pedido' }));
    expect(onShowPast).toHaveBeenCalled();
  });

  it('shows no link when there are no past orders or they are already visible', () => {
    const [esta] = weeks([order(1, '2026-09-25T13:00:00-03:00')]);
    renderWeek(esta);
    expect(screen.queryByRole('button', { name: /^ver \d+ pedidos?$/i })).not.toBeInTheDocument();
  });
});

describe('WeekView — desktop', () => {
  it('stacks a week header (name, dates, count) over one row per day', () => {
    const [esta] = weeks([order(1, '2026-09-24T12:00:00-03:00'), order(2, '2026-09-24T13:00:00-03:00')]);
    renderWeek(esta, { variant: 'desktop' });

    const heading = screen.getByRole('heading', { name: 'Esta semana' });
    const header = heading.closest('header') as HTMLElement;
    expect(within(header).getByText('21–25 sep')).toBeInTheDocument();
    expect(within(header).getByText('2 pedidos')).toBeInTheDocument();

    const rows = screen.getAllByTestId('day-row');
    expect(rows).toHaveLength(2);
    // A la izquierda el día, el número, "Hoy" y la cantidad; a la derecha, los pedidos en una sola columna.
    expect(within(rows[0]).getByText('Jueves')).toBeInTheDocument();
    expect(within(rows[0]).getByText('24')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Hoy')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2 pedidos')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('list', { name: 'Jueves 24' })).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('data-today', 'true');
    expect(rows[1]).toHaveAttribute('data-today', 'false');
    expect(within(rows[1]).getByText('Sin pedidos')).toBeInTheDocument();
  });

  it('shows the empty state for a week with no orders', () => {
    const [, proxima] = weeks([]);
    renderWeek(proxima, { variant: 'desktop' });

    expect(screen.getByRole('heading', { name: 'Semana próxima' })).toBeInTheDocument();
    expect(screen.getByText('No tenés pedidos para la semana próxima')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Hacer un pedido' })).toBeInTheDocument();
  });
});
