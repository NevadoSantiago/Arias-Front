import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard } from './kitchenBoard';
import { KitchenBoardView } from './KitchenBoardView';

const TZ = 'America/Argentina/Buenos_Aires';
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 1, h + 3, m)).toISOString();
};

const commanded = (id: number, extra: Partial<PickupOrder> = {}): PickupOrder => ({
  id,
  customerNickname: `cliente${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
  notas: null,
  estado: 'COMANDADO',
  pickupAt: at('12:10'),
  comandadoAt: at('11:55'),
  deliveredAt: null,
  printStatus: 'NONE',
  printedAt: null,
  ...extra,
});

function renderBoard(
  orders: PickupOrder[],
  props: Partial<React.ComponentProps<typeof KitchenBoardView>> = {},
) {
  const board = buildKitchenBoard(orders, {
    now: new Date(at('12:03')),
    timezone: TZ,
    leadMinutes: 20,
    slotMinutes: 10,
    slotAnchorMinutes: 11 * 60,
  });
  return render(
    <MemoryRouter>
      <KitchenBoardView
        board={board}
        leadMinutes={20}
        slotMinutes={10}
        busy={false}
        timezone={TZ}
        agentOnline
        reprinted={new Set()}
        onComandar={vi.fn()}
        onConfirmar={vi.fn()}
        onEntregar={vi.fn()}
        onReprint={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

const card = (id: number) => screen.getByRole('article', { name: new RegExp(`N° ${id},`) });

describe('KitchenBoardView — print status', () => {
  it('shows a chip per print status', () => {
    renderBoard([
      commanded(1, { printStatus: 'NONE' }),
      commanded(2, { printStatus: 'QUEUED' }),
      commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') }),
      commanded(4, { printStatus: 'FAILED' }),
      commanded(5, { printStatus: 'EXPIRED' }),
    ]);
    expect(within(card(1)).getByText('Sin comanda impresa')).toBeInTheDocument();
    expect(within(card(2)).getByText('En cola')).toBeInTheDocument();
    expect(within(card(2)).getByText('imprimiendo…')).toBeInTheDocument();
    expect(within(card(3)).getByText('Impresa 12:01')).toBeInTheDocument();
    expect(within(card(4)).getByText('Falló — revisá la ticketera')).toBeInTheDocument();
    expect(within(card(5)).getByText('Sin imprimir')).toBeInTheDocument();
    expect(within(card(5)).getByText('no salió en 30 min')).toBeInTheDocument();
  });

  it('labels the action Imprimir for NONE and Reimprimir otherwise', () => {
    renderBoard([commanded(1), commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') })]);
    expect(within(card(1)).getByRole('button', { name: 'Imprimir comanda del pedido N° 1' })).toHaveTextContent('Imprimir');
    expect(within(card(3)).getByRole('button', { name: 'Reimprimir comanda del pedido N° 3' })).toHaveTextContent('Reimprimir');
  });

  it('disables the action while QUEUED', () => {
    renderBoard([commanded(2, { printStatus: 'QUEUED' })]);
    expect(within(card(2)).getByRole('button', { name: /reimprimir comanda/i })).toBeDisabled();
  });

  it('reprints the clicked order', () => {
    const onReprint = vi.fn();
    renderBoard([commanded(4, { printStatus: 'FAILED' })], { onReprint });
    fireEvent.click(within(card(4)).getByRole('button', { name: /reimprimir comanda/i }));
    expect(onReprint).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  it('gives brief "Enviada" feedback instead of a dialog', () => {
    renderBoard([commanded(4, { printStatus: 'FAILED' })], { reprinted: new Set([4]) });
    expect(within(card(4)).getByRole('button', { name: /reimprimir comanda/i })).toHaveTextContent('Enviada');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('puts Reimprimir at the opposite end from Entregado', () => {
    renderBoard([commanded(1)]);
    const buttons = within(card(1)).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['Imprimir comanda del pedido N° 1', 'Entregado, pedido N° 1']);
  });

  it('waits for the PC when the agent is offline', () => {
    renderBoard([commanded(2, { printStatus: 'QUEUED' })], { agentOnline: false });
    expect(within(card(2)).getByText('esperando a la PC del local')).toBeInTheDocument();
  });
});

describe('KitchenBoardView — problem banner', () => {
  it('does not show when every order is fine', () => {
    renderBoard([commanded(1, { printStatus: 'PRINTED', printedAt: at('12:01') }), commanded(2, { printStatus: 'QUEUED' })]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('summarizes failed and expired orders and links to Ticketeras', () => {
    renderBoard([
      commanded(1, { printStatus: 'FAILED' }),
      commanded(2, { printStatus: 'EXPIRED' }),
      commanded(3, { printStatus: 'EXPIRED' }),
    ]);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('1 comanda falló y 2 quedaron sin imprimir.');
    expect(alert).toHaveTextContent('Fijate que la ticketera esté prendida, con papel y la tapa cerrada, y tocá Reimprimir.');
    expect(within(alert).getByRole('link', { name: 'Ver ticketeras' })).toHaveAttribute('href', '/admin/printers');
  });
});
