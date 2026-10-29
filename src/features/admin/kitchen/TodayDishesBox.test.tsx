import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard } from './kitchenBoard';
import { TodayDishesBox } from './TodayDishesBox';

const TZ = 'America/Argentina/Buenos_Aires';

/** Local HH:MM[:SS] in Buenos Aires -> epoch ms for 2026-10-01. */
const ms = (hhmmss: string) => {
  const [h, m, s = 0] = hhmmss.split(':').map(Number);
  return Date.UTC(2026, 9, 1, h + 3, m, s);
};
const at = (hhmm: string) => new Date(ms(hhmm)).toISOString();

const order = (
  id: number,
  estado: PickupOrder['estado'],
  pickup: string,
  dish = 'Milanesa',
  side: string | null = null,
): PickupOrder => ({
  id,
  customerNickname: `cliente${id}`,
  items: [{ dishNombre: dish, sideNombre: side, creditCost: 1, notas: null }],
  notas: null,
  estado,
  pickupAt: at(pickup),
  comandadoAt: null,
  deliveredAt: null,
  printStatus: 'NONE',
  printedAt: null,
});

const NOW = '12:26:28';
const boardOf = (orders: PickupOrder[]) => buildKitchenBoard(orders, { nowMs: ms(NOW), timezone: TZ, leadMinutes: 60 });

const ORDERS = [
  order(1, 'COMANDADO', '12:10', 'Milanesa', 'Papas'), // overdue
  order(2, 'COMANDADO', '12:40', 'Milanesa', 'Ensalada'),
  order(3, 'CONFIRMADO', '13:00', 'Tarta'),
  order(4, 'PENDIENTE', '13:30', 'Tarta'),
  order(5, 'ENTREGADO', '12:00', 'Pizza'),
];

function renderBox(orders = ORDERS, nowMs = ms(NOW)) {
  const utils = render(<TodayDishesBox board={boardOf(orders)} nowMs={nowMs} />);
  const rerenderWith = (next: PickupOrder[]) => utils.rerender(<TodayDishesBox board={boardOf(next)} nowMs={nowMs} />);
  return { ...utils, rerenderWith };
}

const header = () => screen.getByRole('button', { name: /resumen de platos/i });
const open = () => fireEvent.click(header());
const from = () => screen.getByLabelText('Desde') as HTMLSelectElement;
const to = () => screen.getByLabelText('hasta') as HTMLSelectElement;

describe('TodayDishesBox', () => {
  it('starts collapsed and shows the dish total in the header', () => {
    renderBox();

    expect(header()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveTextContent('4 platos');
    expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument();
  });

  it('counts scheduled and commanded orders (overdue too), never the delivered one', () => {
    renderBox();
    open();

    expect(header()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('4 platos · 4 pedidos con retiro entre 12:10 y 13:30')).toBeInTheDocument();
    expect(screen.getByText('No cuenta los pedidos entregados ni cancelados.')).toBeInTheDocument();
    expect(screen.queryByText('Pizza')).not.toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Platos a preparar' });
    expect(within(list).getAllByText('2 ×')).toHaveLength(2);
    expect(within(list).getByText('Milanesa')).toBeInTheDocument();
    expect(within(list).getByText('1 c/ Ensalada · 1 c/ Papas')).toBeInTheDocument();
  });

  it('uses singular for one dish', () => {
    renderBox([order(1, 'PENDIENTE', '13:00')]);

    expect(header()).toHaveTextContent('1 plato');
    expect(header()).not.toHaveTextContent('1 platos');
  });

  it('offers the distinct pickup times and disables the ones that would invert the range', () => {
    renderBox();
    open();

    expect(within(from()).getAllByRole('option').map((o) => o.textContent)).toEqual(['12:10', '12:40', '13:00', '13:30']);
    fireEvent.change(from(), { target: { value: String(ms('13:00')) } });

    const disabledInTo = within(to())
      .getAllByRole('option')
      .filter((o) => (o as HTMLOptionElement).disabled);
    expect(disabledInTo.map((o) => o.textContent)).toEqual(['12:10', '12:40']);
  });

  it('narrows the summary and shows the range in the collapsed header', () => {
    renderBox();
    open();
    fireEvent.change(from(), { target: { value: String(ms('12:40')) } });
    fireEvent.change(to(), { target: { value: String(ms('13:00')) } });

    expect(screen.getByText('2 platos · 2 pedidos con retiro entre 12:40 y 13:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todo el día' })).toHaveAttribute('aria-pressed', 'false');
    open();
    expect(header()).toHaveTextContent('2 platos');
    expect(header()).toHaveTextContent('Retiro 12:40 a 13:00');
  });

  it('says "a las" when both ends are the same time', () => {
    renderBox();
    open();
    fireEvent.change(from(), { target: { value: String(ms('13:00')) } });
    fireEvent.change(to(), { target: { value: String(ms('13:00')) } });

    expect(screen.getByText('1 plato · 1 pedido con retiro a las 13:00')).toBeInTheDocument();
    open();
    expect(header()).toHaveTextContent('Retiro a las 13:00');
  });

  it('pushes the other end when one end crosses it', () => {
    renderBox();
    open();
    fireEvent.change(from(), { target: { value: String(ms('12:40')) } });
    fireEvent.change(to(), { target: { value: String(ms('13:00')) } });
    fireEvent.change(from(), { target: { value: String(ms('13:30')) } });

    expect(to().value).toBe(String(ms('13:30')));
  });

  it('"Desde ahora" starts at the first pickup from the current minute on and "Todo el día" resets', () => {
    renderBox();
    open();
    const fromNow = screen.getByRole('button', { name: 'Desde ahora' });
    fireEvent.click(fromNow);

    expect(from().value).toBe(String(ms('12:40')));
    expect(to().value).toBe(String(ms('13:30')));
    expect(fromNow).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Todo el día' }));

    expect(from().value).toBe(String(ms('12:10')));
    expect(screen.getByRole('button', { name: 'Todo el día' })).toHaveAttribute('aria-pressed', 'true');
    expect(fromNow).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables "Desde ahora" when no pickup remains', () => {
    renderBox(ORDERS, ms('14:00'));
    open();

    expect(screen.getByRole('button', { name: 'Desde ahora' })).toBeDisabled();
  });

  it('keeps the range sane when the selected times disappear after a refresh', () => {
    const { rerenderWith } = renderBox();
    open();
    fireEvent.change(from(), { target: { value: String(ms('12:40')) } });
    fireEvent.change(to(), { target: { value: String(ms('13:00')) } });

    rerenderWith([ORDERS[0], { ...ORDERS[1], estado: 'ENTREGADO' }, ORDERS[2], ORDERS[3]]);

    expect(screen.getByText('1 plato · 1 pedido con retiro a las 13:00')).toBeInTheDocument();

    rerenderWith([ORDERS[0], { ...ORDERS[1], estado: 'ENTREGADO' }, { ...ORDERS[2], estado: 'ENTREGADO' }, ORDERS[3]]);

    expect(screen.getByText('2 platos · 2 pedidos con retiro entre 12:10 y 13:30')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is left to make', () => {
    renderBox([order(5, 'ENTREGADO', '12:00')]);
    open();

    expect(header()).toHaveTextContent('0 platos');
    expect(screen.getByText('No hay pedidos para preparar hoy.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument();
  });
});
