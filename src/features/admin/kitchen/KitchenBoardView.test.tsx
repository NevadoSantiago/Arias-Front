import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
  printStatus: 'NONE',
  printedAt: null,
});

function renderBoard(orders: PickupOrder[], onConfirmar = vi.fn()) {
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
      timezone={TZ}
      agentOnline
      reprinted={new Set()}
      onReprint={vi.fn()}
      onComandar={vi.fn()}
      onConfirmar={onConfirmar}
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

describe('KitchenBoardView — scheduled box', () => {
  const pending = (id: number, pickup: string): PickupOrder => ({ ...order(id, pickup), estado: 'PENDIENTE' });

  it('offers a Confirmar button per scheduled order that confirms just that order', () => {
    const onConfirmar = vi.fn();
    renderBoard([pending(8, '13:10'), pending(9, '13:30')], onConfirmar);

    fireEvent.click(screen.getByRole('button', { name: /confirmar pedido n° 9/i }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onConfirmar.mock.calls[0][0]).toHaveLength(1);
    expect(onConfirmar.mock.calls[0][0][0].id).toBe(9);
    expect(screen.getAllByText(/^Se confirma /)).toHaveLength(2);
  });

  it('tells the admin they can confirm by hand', () => {
    renderBoard([pending(8, '13:10')]);
    expect(screen.getByText(/pasan solos a confirmados a la hora indicada, o confirmalos vos/i)).toBeInTheDocument();
  });
});

describe('KitchenBoardView — commanded box, stale list', () => {
  const stale = (id: number) => ({ ...order(id, '11:00'), estado: 'COMANDADO' as const, comandadoAt: at('10:50') });

  const openStaleList = () => fireEvent.click(screen.getByRole('button', { name: /Retiro hace más de/ }));

  it('offers a single Entregado button when only one stale order is listed', () => {
    renderBoard([stale(1)]);
    openStaleList();

    expect(screen.getByRole('button', { name: 'Entregado, pedido N° 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como entregado' })).not.toBeInTheDocument();
  });

  it('keeps the bulk button when two or more stale orders are listed', () => {
    renderBoard([stale(1), stale(2)]);
    openStaleList();

    expect(screen.getByRole('button', { name: 'Entregado, pedido N° 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregado, pedido N° 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar los 2 como entregados' })).toBeInTheDocument();
  });
});
