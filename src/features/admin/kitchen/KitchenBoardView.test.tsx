import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PickupOrder } from '@/features/admin/services/adminApi';
import { buildKitchenBoard } from './kitchenBoard';
import { KitchenBoardView } from './KitchenBoardView';

const TZ = 'America/Argentina/Buenos_Aires';

/** Local HH:MM[:SS] in Buenos Aires -> epoch ms for 2026-10-01. */
const ms = (hhmmss: string) => {
  const [h, m, s = 0] = hhmmss.split(':').map(Number);
  return Date.UTC(2026, 9, 1, h + 3, m, s);
};
const at = (hhmm: string) => new Date(ms(hhmm)).toISOString();

const order = (id: number, estado: PickupOrder['estado'], pickup: string, extra: Partial<PickupOrder> = {}): PickupOrder => ({
  id,
  customerNickname: `cliente${id}`,
  items: [{ dishNombre: 'Milanesa', sideNombre: null, creditCost: 1, notas: null }],
  notas: null,
  estado,
  pickupAt: at(pickup),
  comandadoAt: null,
  deliveredAt: null,
  printStatus: 'PRINTED',
  printedAt: null,
  ...extra,
});

function renderBoard(
  orders: PickupOrder[],
  { now = '12:26:28', ...props }: Partial<React.ComponentProps<typeof KitchenBoardView>> & { now?: string } = {},
) {
  const board = buildKitchenBoard(orders, { nowMs: ms(now), timezone: TZ, leadMinutes: 60 });
  return render(
    <MemoryRouter>
      <KitchenBoardView
        board={board}
        leadMinutes={60}
        busy={false}
        timezone={TZ}
        agentOnline
        reprinted={new Set()}
        onReprint={vi.fn()}
        onComandar={vi.fn()}
        onEntregar={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

const commandedBox = () => screen.getByRole('region', { name: 'Pedidos comandados' });
const scheduledBox = () => screen.getByRole('region', { name: 'Pedidos programados' });

afterEach(() => vi.restoreAllMocks());

describe('KitchenBoardView — structure', () => {
  it('has no Confirmados box, no slot grouping and no bulk command button', () => {
    renderBoard([order(1, 'COMANDADO', '12:34'), order(2, 'COMANDADO', '12:34')]);
    expect(screen.queryByRole('region', { name: /confirmados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /comandar los/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Primero')).not.toBeInTheDocument();
  });

  it('puts Comandados first (main column), Programados beside it and Entregados collapsed below', () => {
    renderBoard([order(5, 'ENTREGADO', '12:00', { deliveredAt: at('12:01') })]);
    const regions = screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby') ?? r.getAttribute('aria-label'));
    expect(regions.indexOf('kb-commanded')).toBeLessThan(regions.indexOf('kb-scheduled'));
    expect(regions.indexOf('kb-scheduled')).toBeLessThan(regions.indexOf('kb-delivered'));
    expect(screen.getByRole('button', { name: /pedidos entregados/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('explains the empty boxes', () => {
    renderBoard([]);
    expect(screen.getByText('No hay pedidos en cocina')).toBeInTheDocument();
    expect(screen.getByText(/pasan solos a comandados 60 min antes del retiro/i)).toBeInTheDocument();
    expect(screen.getByText('No quedan pedidos programados para hoy.')).toBeInTheDocument();
  });
});

describe('KitchenBoardView — pickup groups', () => {
  it('has one group per occupied minute with "HH:MM · entrega en mm:ss"', () => {
    renderBoard([
      order(1, 'COMANDADO', '12:34'),
      order(2, 'COMANDADO', '12:34'),
      order(3, 'COMANDADO', '12:45'),
    ]);
    const groups = within(commandedBox()).getAllByRole('region', { name: /^Retiro \d{2}:\d{2}$/ });
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Retiro 12:34', 'Retiro 12:45']);
    expect(within(groups[0]).getByTestId('group-header')).toHaveTextContent('12:34 · entrega en 07:32');
    expect(within(groups[0]).getAllByRole('article')).toHaveLength(2);
  });

  it('only changes the color of the countdown: muted, dark mustard at 10 min, deep red bold at 3', () => {
    renderBoard(
      [order(1, 'COMANDADO', '12:40'), order(2, 'COMANDADO', '12:35'), order(3, 'COMANDADO', '12:28')],
      { now: '12:26:28' },
    );
    const header = (time: string) => screen.getByRole('region', { name: `Retiro ${time}` }).querySelector('[data-testid="group-header"]') as HTMLElement;
    expect(header('12:40').className).toContain('text-muted-foreground');
    expect(header('12:35').className).toContain('text-warning-deep');
    expect(header('12:28').className).toContain('text-primary-deep');
    expect(header('12:28').className).toContain('font-semibold');
    // Subtle: no pill, no background, no animation.
    for (const h of [header('12:40'), header('12:35'), header('12:28')]) {
      expect(h.className).not.toMatch(/\bbg-|rounded|animate-/);
    }
  });

  it('pins the overdue orders on top with how late they are', () => {
    renderBoard([order(1, 'COMANDADO', '12:34'), order(2, 'COMANDADO', '12:20')], { now: '12:27:10' });
    const box = commandedBox();
    const overdue = within(box).getByRole('region', { name: 'Atrasados' });
    expect(within(overdue).getByText('Retiro 12:20 · atrasado +07:10')).toBeInTheDocument();
    const sections = within(box).getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(sections.indexOf('Atrasados')).toBeLessThan(sections.indexOf('Retiro 12:34'));
    expect(within(overdue).queryByTestId('group-header')).not.toBeInTheDocument();
  });

  it('shows the order number, nickname, ticket-style lines and both kinds of notes', () => {
    renderBoard([
      order(7, 'COMANDADO', '12:34', {
        notas: 'timbre roto',
        items: [
          { dishNombre: 'Milanesa Napolitana', sideNombre: 'papas fritas', creditCost: 1, notas: null },
          { dishNombre: 'Milanesa Napolitana', sideNombre: 'papas fritas', creditCost: 1, notas: null },
          { dishNombre: 'Flan', sideNombre: null, creditCost: 1, notas: 'sin dulce de leche' },
        ],
      }),
    ]);
    const row = screen.getByRole('article', { name: /N° 7,/ });
    expect(within(row).getByText('N° 7')).toBeInTheDocument();
    expect(within(row).getByText('cliente7')).toBeInTheDocument();
    expect(within(row).getByText('2x Milanesa Napolitana')).toBeInTheDocument();
    expect(within(row).getByText('2x C/papas fritas')).toBeInTheDocument();
    expect(within(row).getByText('1x Flan')).toBeInTheDocument();
    expect(within(row).getByText('sin dulce de leche')).toBeInTheDocument();
    expect(within(row).getByText('timbre roto')).toBeInTheDocument();
    expect(within(row).getByText('Nota del pedido')).toBeInTheDocument();
  });

  it('marks an order as delivered from its row', () => {
    const onEntregar = vi.fn();
    renderBoard([order(4, 'COMANDADO', '12:34')], { onEntregar });
    fireEvent.click(screen.getByRole('button', { name: 'Entregado, pedido N° 4' }));
    expect(onEntregar).toHaveBeenCalledWith([expect.objectContaining({ id: 4 })]);
  });

  it('disables the actions while a move is in flight', () => {
    renderBoard([order(4, 'COMANDADO', '12:34')], { busy: true });
    expect(screen.getByRole('button', { name: 'Entregado, pedido N° 4' })).toBeDisabled();
  });
});

describe('KitchenBoardView — 60 minute timeline', () => {
  it('has "Ahora" and "+60" ends with clock ticks', () => {
    renderBoard([], { now: '12:00:00' });
    const strip = screen.getByRole('region', { name: 'Próximos 60 minutos' });
    expect(within(strip).getByText('Ahora 12:00')).toBeInTheDocument();
    expect(within(strip).getByText('+60 min · 13:00')).toBeInTheDocument();
    expect(within(strip).getByText('12:30')).toBeInTheDocument();
  });

  it('has one marker per occupied minute, with the count when there are several', () => {
    renderBoard(
      [order(1, 'COMANDADO', '12:15'), order(2, 'COMANDADO', '12:15'), order(3, 'COMANDADO', '12:40'), order(4, 'COMANDADO', '13:30')],
      { now: '12:00:00' },
    );
    const strip = screen.getByRole('region', { name: 'Próximos 60 minutos' });
    const markers = within(strip).getAllByRole('button', { name: /^\d{2}:\d{2},/ });
    expect(markers.map((m) => m.getAttribute('aria-label'))).toEqual([
      '12:15, 2 pedidos, Impresa',
      '12:40, 1 pedido, Impresa',
    ]);
    expect(within(markers[0]).getByText('2')).toBeInTheDocument();
    expect(within(markers[1]).queryByText('1')).not.toBeInTheDocument();
  });

  it('names the worst print status of the minute', () => {
    renderBoard(
      [
        order(1, 'COMANDADO', '12:15', { printStatus: 'PRINTED' }),
        order(2, 'COMANDADO', '12:15', { printStatus: 'FAILED' }),
        order(3, 'COMANDADO', '12:20', { printStatus: 'QUEUED' }),
      ],
      { now: '12:00:00' },
    );
    expect(screen.getByRole('button', { name: '12:15, 2 pedidos, Falló' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12:20, 1 pedido, En cola' })).toBeInTheDocument();
  });

  it('scrolls to the group when a marker is clicked and highlights it', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderBoard([order(1, 'COMANDADO', '12:15'), order(2, 'COMANDADO', '12:40')], { now: '12:00:00' });
    fireEvent.click(screen.getByRole('button', { name: /^12:40,/ }));
    const group = screen.getByRole('region', { name: 'Retiro 12:40' });
    expect(scrollIntoView.mock.contexts).toContain(group);
    expect(group.className).toContain('ring-2');
    expect(screen.getByRole('region', { name: 'Retiro 12:15' }).className).not.toContain('ring-2');
  });

  it('offers a shortcut to the overdue orders', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderBoard([order(1, 'COMANDADO', '11:50')], { now: '12:00:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Atrasados 1' }));
    expect(scrollIntoView.mock.contexts).toContain(screen.getByRole('region', { name: 'Atrasados' }));
  });
});

describe('KitchenBoardView — Programados', () => {
  const pending = [
    order(9, 'PENDIENTE', '14:10'),
    order(7, 'PENDIENTE', '13:40'),
    order(8, 'CONFIRMADO', '13:00'),
  ];

  it('lists them by pickup time with "Retira HH:MM · se comanda HH:MM", legacy CONFIRMADO included', () => {
    renderBoard(pending, { now: '12:00:00' });
    const cards = within(scheduledBox()).getAllByRole('listitem');
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Pedido N° 8', 'Pedido N° 7', 'Pedido N° 9']);
    expect(within(cards[1]).getByText('Retira 13:40 · se comanda 12:40')).toBeInTheDocument();
    expect(within(cards[1]).getByText('(en 40 min)')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Retira 13:00 · se comanda 12:00')).toBeInTheDocument();
  });

  it('asks for confirmation inside the card, with no browser dialog', () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onComandar = vi.fn();
    renderBoard(pending, { now: '12:00:00', onComandar });
    const card = within(scheduledBox()).getByRole('listitem', { name: 'Pedido N° 7' });
    fireEvent.click(within(card).getByRole('button', { name: 'Comandar ahora el pedido N° 7' }));
    expect(onComandar).not.toHaveBeenCalled();
    const group = within(card).getByRole('group', { name: 'Confirmar comandar pedido N° 7' });
    expect(group).toHaveTextContent('¿Comandar ahora?');

    fireEvent.click(within(group).getByRole('button', { name: 'Sí, comandar' }));
    expect(onComandar).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
    expect(confirm).not.toHaveBeenCalled();
    expect(within(card).queryByRole('group')).not.toBeInTheDocument();
  });

  it('cancels the confirmation without commanding', () => {
    const onComandar = vi.fn();
    renderBoard(pending, { now: '12:00:00', onComandar });
    const card = within(scheduledBox()).getByRole('listitem', { name: 'Pedido N° 7' });
    fireEvent.click(within(card).getByRole('button', { name: 'Comandar ahora el pedido N° 7' }));
    fireEvent.click(within(card).getByRole('button', { name: 'Cancelar' }));
    expect(onComandar).not.toHaveBeenCalled();
    expect(within(card).getByRole('button', { name: 'Comandar ahora el pedido N° 7' })).toBeInTheDocument();
  });

  it('disables the confirmation while a move is in flight', () => {
    renderBoard(pending, { now: '12:00:00', busy: true });
    expect(screen.getByRole('button', { name: 'Comandar ahora el pedido N° 7' })).toBeDisabled();
  });
});
