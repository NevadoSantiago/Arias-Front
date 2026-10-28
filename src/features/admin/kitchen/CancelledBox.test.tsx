import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CancelledOrder } from '@/features/admin/services/adminApi';
import { CancelledBox } from './CancelledBox';
import { CancelledNotice } from './CancelledNotice';

const TZ = 'America/Argentina/Buenos_Aires';
/** Local HH:MM in Buenos Aires -> ISO instant for 2026-10-28. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 28, h + 3, m)).toISOString();
};

const cancelled = (id: number, extra: Partial<CancelledOrder> = {}): CancelledOrder => ({
  id,
  customerNickname: `alias${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: 'Papas', creditCost: 1, notas: null }],
  notas: null,
  pickupAt: at('13:30'),
  comandadoAt: null,
  cancelledAt: at('10:15'),
  cancelRefunded: true,
  cancelReason: 'CUSTOMER',
  ...extra,
});

function renderBox(orders: CancelledOrder[], { open = false, onOpenChange = vi.fn() } = {}) {
  render(<CancelledBox orders={orders} timezone={TZ} open={open} onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

const toggle = () => screen.getByRole('button', { name: /pedidos cancelados/i });

describe('CancelledBox', () => {
  it('is a collapsed section with the count, and shows no rows', () => {
    renderBox([cancelled(1), cancelled(2)]);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(within(toggle()).getByText('2')).toBeInTheDocument();
    expect(screen.queryByText('N° 1')).not.toBeInTheDocument();
  });

  it('asks to open when the header is clicked', () => {
    const { onOpenChange } = renderBox([cancelled(1)]);

    fireEvent.click(toggle());

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('shows the "N ya comandado" chip on the collapsed header only when some were already commanded', () => {
    renderBox([cancelled(1, { comandadoAt: at('12:40') }), cancelled(2, { comandadoAt: at('12:41') }), cancelled(3)]);

    expect(within(toggle()).getByText('2 ya comandados')).toBeInTheDocument();
  });

  it('has no chip without commanded orders', () => {
    renderBox([cancelled(1)]);

    expect(within(toggle()).queryByText(/ya comandado/)).not.toBeInTheDocument();
  });

  it('lists the rows as the backend sends them (newest first), with number, customer, items and times', () => {
    renderBox([cancelled(9, { cancelledAt: at('12:31') }), cancelled(4, { cancelledAt: at('10:15') })], { open: true });

    const rows = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-cancelled-order'));
    expect(rows.map((r) => r.getAttribute('data-cancelled-order'))).toEqual(['9', '4']);
    expect(within(rows[0]).getByText('N° 9')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/alias9/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Milanesa c/ Papas')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Retiro 13:30 · cancelado 12:31')).toBeInTheDocument();
  });

  it('shows the dish notes and the order note', () => {
    renderBox(
      [
        cancelled(1, {
          items: [{ dishNombre: 'Suprema', sideNombre: null, creditCost: 1, notas: 'Sin sal' }],
          notas: 'Retira la hermana',
        }),
      ],
      { open: true },
    );

    expect(screen.getByText('Sin sal')).toBeInTheDocument();
    expect(screen.getByText('Retira la hermana')).toBeInTheDocument();
  });

  it('marks a row "Ya comandado" only when it had been commanded', () => {
    renderBox([cancelled(1, { comandadoAt: at('12:40') }), cancelled(2)], { open: true });

    const [first, second] = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-cancelled-order'));
    expect(within(first).getByText('Ya comandado')).toBeInTheDocument();
    expect(within(second).queryByText('Ya comandado')).not.toBeInTheDocument();
  });

  it('tags the credit: returned, consumed, or nothing when unknown', () => {
    renderBox(
      [cancelled(1, { cancelRefunded: true }), cancelled(2, { cancelRefunded: false }), cancelled(3, { cancelRefunded: null })],
      { open: true },
    );

    const [a, b, c] = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-cancelled-order'));
    expect(within(a).getByText('Crédito devuelto')).toBeInTheDocument();
    expect(within(b).getByText('Crédito consumido')).toBeInTheDocument();
    expect(within(c).queryByText(/Crédito/)).not.toBeInTheDocument();
  });

  it('is read-only: the header is the only button', () => {
    renderBox([cancelled(1, { comandadoAt: at('12:40') })], { open: true });

    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('says so when nothing was cancelled today', () => {
    renderBox([], { open: true });

    expect(screen.getByText('Todavía no se canceló ningún pedido hoy.')).toBeInTheDocument();
  });
});

describe('CancelledNotice', () => {
  it('tells the kitchen not to prepare the order and to discard the printed ticket', () => {
    render(<CancelledNotice order={cancelled(7, { customerNickname: 'Juanma' })} onShow={vi.fn()} onDismiss={vi.fn()} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Se canceló el pedido N° 7 · Juanma.');
    expect(notice).toHaveTextContent('Ya estaba comandado: no lo prepares y descartá la comanda impresa.');
  });

  it('offers "Ver cancelados" and a close button', () => {
    const onShow = vi.fn();
    const onDismiss = vi.fn();
    render(<CancelledNotice order={cancelled(7)} onShow={onShow} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Ver cancelados' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    expect(onShow).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});
