import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard } from './kitchenBoard';
import { KitchenBoardView } from './KitchenBoardView';

const TZ = 'America/Argentina/Buenos_Aires';

/** Local HH:MM in Buenos Aires -> ISO instant for 2026-10-01. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 1, h + 3, m)).toISOString();
};

const order = (id: number, pickup: string): PickupOrder => ({
  id,
  customerNickname: `cliente${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
  notas: null,
  estado: 'CONFIRMADO',
  pickupAt: at(pickup),
  comandadoAt: null,
  deliveredAt: null,
});

function renderBoard(orders: PickupOrder[]) {
  const board = buildKitchenBoard(orders, {
    now: new Date(at('12:03')),
    timezone: TZ,
    leadMinutes: 20,
    slotMinutes: 10,
    slotAnchorMinutes: 11 * 60,
  });
  return render(
    <KitchenBoardView
      board={board}
      leadMinutes={20}
      slotMinutes={10}
      busy={false}
      onComandar={vi.fn()}
      onEntregar={vi.fn()}
    />,
  );
}

describe('KitchenBoardView — confirmed box', () => {
  it('shows the empty state, and no slot cards, when nothing is confirmed', () => {
    renderBoard([]);

    expect(screen.getByText('Nada para comandar ahora')).toBeInTheDocument();
    expect(screen.queryByText('12:10')).not.toBeInTheDocument();
    expect(screen.queryByText('12:20')).not.toBeInTheDocument();
  });

  it('shows only the slots that have orders', () => {
    renderBoard([order(1, '12:20')]);

    expect(screen.getByText('12:20')).toBeInTheDocument();
    expect(screen.queryByText('12:10')).not.toBeInTheDocument();
    expect(screen.queryByText(/sin pedidos para este horario/i)).not.toBeInTheDocument();
  });
});
