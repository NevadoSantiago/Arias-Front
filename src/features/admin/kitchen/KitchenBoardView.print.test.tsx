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
  pickupAt: at('12:34'),
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
  const board = buildKitchenBoard(orders, { nowMs: Date.parse(at('12:03')), timezone: TZ, leadMinutes: 60 });
  return render(
    <MemoryRouter>
      <KitchenBoardView
        board={board}
        nowMs={Date.parse(at('12:03'))}
        leadMinutes={60}
        busy={false}
        timezone={TZ}
        agentOnline
        reprinted={new Set()}
        onComandar={vi.fn()}
        onEntregar={vi.fn()}
        onReprint={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

const card = (id: number) => screen.getByRole('article', { name: new RegExp(`N° ${id},`) });

describe('KitchenBoardView — print status', () => {
  it('shows a badge with icon and short text per print status', () => {
    renderBoard([
      commanded(1, { printStatus: 'NONE' }),
      commanded(2, { printStatus: 'QUEUED' }),
      commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') }),
      commanded(4, { printStatus: 'FAILED' }),
      commanded(5, { printStatus: 'EXPIRED' }),
    ]);
    expect(within(card(1)).getByText('Sin imprimir')).toBeInTheDocument();
    expect(within(card(2)).getByText('En cola')).toBeInTheDocument();
    expect(within(card(3)).getByText('Impresa')).toBeInTheDocument();
    expect(within(card(4)).getByText('Falló')).toBeInTheDocument();
    expect(within(card(5)).getByText('Sin imprimir')).toBeInTheDocument();
  });

  it('does not show the print time inline: it is in the hover tooltip only', () => {
    renderBoard([commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') })]);
    const row = card(3);
    const badge = within(row).getByText('Impresa').closest('[tabindex]') as HTMLElement;
    expect(badge).toHaveTextContent(/^Impresa$/);
    const tooltip = within(row).getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Impresa a las 12:01');
    expect(badge).toHaveAttribute('aria-describedby', tooltip.id);
    // Hidden until hover / keyboard focus.
    expect(tooltip.className).toContain('invisible');
    expect(tooltip.className).toContain('group-hover:visible');
    expect(tooltip.className).toContain('group-focus-within:visible');
  });

  it('says it is waiting for the PC inline only when the agent is offline', () => {
    const { unmount } = renderBoard([commanded(2, { printStatus: 'QUEUED' })]);
    expect(within(card(2)).queryByText('esperando a la PC del local')).not.toBeInTheDocument();
    unmount();
    renderBoard([commanded(2, { printStatus: 'QUEUED' })], { agentOnline: false });
    expect(within(card(2)).getByText('esperando a la PC del local')).toBeInTheDocument();
  });

  it('labels the action Imprimir for NONE and Reimprimir otherwise', () => {
    renderBoard([commanded(1), commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') })]);
    expect(within(card(1)).getByRole('button', { name: 'Imprimir comanda del pedido N° 1' })).toBeInTheDocument();
    expect(within(card(3)).getByRole('button', { name: 'Reimprimir comanda del pedido N° 3' })).toBeInTheDocument();
  });

  it('makes Reimprimir a prominent text button on FAILED and EXPIRED, an icon button otherwise', () => {
    renderBoard([
      commanded(3, { printStatus: 'PRINTED', printedAt: at('12:01') }),
      commanded(4, { printStatus: 'FAILED' }),
      commanded(5, { printStatus: 'EXPIRED' }),
    ]);
    expect(within(card(4)).getByRole('button', { name: /reimprimir comanda/i })).toHaveTextContent('Reimprimir');
    expect(within(card(5)).getByRole('button', { name: /reimprimir comanda/i })).toHaveTextContent('Reimprimir');
    expect(within(card(3)).getByRole('button', { name: /reimprimir comanda/i })).toHaveTextContent(/^$/);
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

  it('puts Reimprimir before Entregado', () => {
    renderBoard([commanded(1)]);
    const buttons = within(card(1)).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(buttons).toEqual(['Imprimir comanda del pedido N° 1', 'Entregado, pedido N° 1']);
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
