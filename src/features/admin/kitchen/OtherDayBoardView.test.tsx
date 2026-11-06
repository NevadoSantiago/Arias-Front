import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildDayOrders, summarizeDishes, type DayOption } from './dashboardDay';
import { OtherDayBoardView } from './OtherDayBoardView';

const TZ = 'America/Argentina/Buenos_Aires';

const day: DayOption = {
  date: '2026-10-05',
  label: 'Lun 5/10',
  longLabel: 'lunes 5/10',
  isToday: false,
  status: 'open',
  motivo: null,
};

const order = (id: number, rewardItems: PickupOrder['rewardItems']): PickupOrder => ({
  id,
  customerNickname: `cliente${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
  rewardItems,
  notas: null,
  estado: 'PENDIENTE',
  pickupAt: '2026-10-05T16:00:00Z',
  comandadoAt: null,
  deliveredAt: null,
  printStatus: 'NONE',
  printedAt: null,
});

function renderDay(orders: PickupOrder[]) {
  const dayOrders = buildDayOrders(orders, TZ);
  render(
    <OtherDayBoardView
      day={day}
      orders={dayOrders}
      summary={summarizeDishes(dayOrders)}
      leadMinutes={60}
      onBackToToday={vi.fn()}
    />,
  );
}

describe('OtherDayBoardView — gift desserts', () => {
  it('lists the gift desserts apart from the dishes, and on the order that carries one', () => {
    renderDay([
      order(1, [{ dessertId: 4, nombre: 'Flan casero' }]),
      order(2, [{ dessertId: 4, nombre: 'Flan casero' }]),
      order(3, []),
    ]);

    const gifts = screen.getByRole('list', { name: 'Postres de regalo' });
    expect(within(gifts).getByText('2 ×')).toBeInTheDocument();
    expect(within(gifts).getByText('Flan casero')).toBeInTheDocument();
    expect(screen.getAllByText('Postre de regalo: Flan casero')).toHaveLength(2);
  });

  it('has no gift section when no order carries a dessert', () => {
    renderDay([order(1, [])]);

    expect(screen.queryByRole('list', { name: 'Postres de regalo' })).not.toBeInTheDocument();
  });
});
