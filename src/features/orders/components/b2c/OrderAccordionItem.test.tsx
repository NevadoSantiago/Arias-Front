import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderAccordionItem } from './OrderAccordionItem';
import type { OrderV2 } from '../../services/ordersApi';

const NOW = new Date('2026-09-24T11:40:00-03:00');

const scheduled: OrderV2 = {
  id: 202,
  fecha: '2026-09-25',
  pickupAt: '2026-09-25T13:00:00-03:00',
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa Napolitana', dishCategoria: 'Premium', sideId: 5, sideNombre: 'Papas fritas', creditCost: 1, notas: 'Sin sal, por favor' },
    { id: 2, dishId: 11, dishNombre: 'Ensalada César', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

const awaiting: OrderV2 = {
  ...scheduled,
  estado: 'PENDIENTE_PAGO',
  paidWithMercadoPago: true,
  modifiable: false,
  pickupTimeChangeable: false,
};

const readOnly = (estado: OrderV2['estado']): OrderV2 => ({
  ...scheduled,
  estado,
  cancellable: false,
  modifiable: false,
  pickupTimeChangeable: false,
});

type Props = Partial<React.ComponentProps<typeof OrderAccordionItem>>;

function renderItem(order: OrderV2, props: Props = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onRequestChangePickupTime: vi.fn(),
    onRequestCancel: vi.fn(),
    onRequestPayNow: vi.fn(),
  };
  render(
    <MemoryRouter>
      <ul>
        <OrderAccordionItem
          order={order}
          now={NOW}
          callName="Sofi"
          pickupLeadMinutes={20}
          open={false}
          {...handlers}
          {...props}
        />
      </ul>
    </MemoryRouter>,
  );
  return handlers;
}

const header = () => screen.getByRole('button', { name: /retiro 13:00 hs/i });

describe('OrderAccordionItem — header', () => {
  it('shows the pickup time, the state badge and "N platos · N almuerzos", collapsed', () => {
    renderItem(scheduled);

    expect(within(header()).getByText('Retiro 13:00 hs')).toBeInTheDocument();
    expect(within(header()).getByText('Programado')).toBeInTheDocument();
    expect(within(header()).getByText('2 platos · 2 almuerzos')).toBeInTheDocument();
    expect(screen.queryByText('Comanda Nº 0202')).not.toBeInTheDocument();
  });

  it('is a button with aria-expanded and aria-controls pointing at its panel', () => {
    renderItem(scheduled);

    expect(header()).toHaveAttribute('aria-expanded', 'false');
    expect(header()).toHaveAttribute('aria-controls', 'order-acc-202-p');
  });

  it('asks to toggle when the header is clicked', () => {
    const { onToggle } = renderItem(scheduled);

    fireEvent.click(header());

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the date only in "Anteriores" (showDate)', () => {
    renderItem({ ...scheduled, pickupAt: '2026-09-22T13:00:00-03:00' }, { showDate: true });

    expect(within(header()).getByText('Martes 22')).toBeInTheDocument();
  });

  it('shows the payment line for a partial payment awaiting Mercado Pago', () => {
    renderItem({ ...awaiting, creditsFromBalance: 1 });

    expect(within(header()).getByText(/1 de tu saldo · 1 a pagar/)).toBeInTheDocument();
    expect(within(header()).getByText('Pago pendiente')).toBeInTheDocument();
  });

  it('says a scheduled order can no longer be changed', () => {
    renderItem({ ...scheduled, pickupTimeChangeable: false });

    expect(within(header()).getByText('Ya no se puede cambiar')).toBeInTheDocument();
  });
});

describe('OrderAccordionItem — keyboard', () => {
  it('keeps the arrows, Home and End inside the list of the focused header', () => {
    const upcoming = [scheduled, { ...scheduled, id: 203, pickupAt: '2026-09-25T14:00:00-03:00' }];
    const previous = [
      { ...scheduled, id: 301, pickupAt: '2026-09-20T13:00:00-03:00' },
      { ...scheduled, id: 302, pickupAt: '2026-09-20T14:00:00-03:00' },
    ];
    render(
      <MemoryRouter>
        {[upcoming, previous].map((list, n) => (
          <ul key={n} aria-label={n === 0 ? 'Próximos' : 'Anteriores'}>
            {list.map((o) => (
              <OrderAccordionItem key={o.id} order={o} now={NOW} callName="Sofi" open={false} showDate={n === 1} onToggle={() => {}} />
            ))}
          </ul>
        ))}
      </MemoryRouter>,
    );
    const first = within(screen.getByRole('list', { name: 'Próximos' })).getAllByRole('button');
    const second = within(screen.getByRole('list', { name: 'Anteriores' })).getAllByRole('button');

    first[1].focus();
    fireEvent.keyDown(first[1], { key: 'ArrowDown' });
    expect(first[0]).toHaveFocus();
    fireEvent.keyDown(first[0], { key: 'ArrowUp' });
    expect(first[1]).toHaveFocus();
    fireEvent.keyDown(first[1], { key: 'Home' });
    expect(first[0]).toHaveFocus();
    second[0].focus();
    fireEvent.keyDown(second[0], { key: 'End' });
    expect(second[1]).toHaveFocus();
    fireEvent.keyDown(second[1], { key: 'ArrowDown' });
    expect(second[0]).toHaveFocus();
  });

  it('moves focus between headers with the arrows, Home and End (wrapping around)', () => {
    const second = { ...scheduled, id: 203, pickupAt: '2026-09-25T14:00:00-03:00' };
    const third = { ...scheduled, id: 204, pickupAt: '2026-09-25T15:00:00-03:00' };
    render(
      <MemoryRouter>
        <ul>
          {[scheduled, second, third].map((o) => (
            <OrderAccordionItem
              key={o.id}
              order={o}
              now={NOW}
              callName="Sofi"
              open={false}
              onToggle={() => {}}
            />
          ))}
        </ul>
      </MemoryRouter>,
    );
    const heads = screen.getAllByRole('button', { name: /retiro/i });

    heads[0].focus();
    fireEvent.keyDown(heads[0], { key: 'ArrowDown' });
    expect(heads[1]).toHaveFocus();
    fireEvent.keyDown(heads[1], { key: 'End' });
    expect(heads[2]).toHaveFocus();
    fireEvent.keyDown(heads[2], { key: 'ArrowDown' });
    expect(heads[0]).toHaveFocus();
    fireEvent.keyDown(heads[0], { key: 'ArrowUp' });
    expect(heads[2]).toHaveFocus();
    fireEvent.keyDown(heads[2], { key: 'Home' });
    expect(heads[0]).toHaveFocus();
  });

  it('does not stop Enter and Space: the native button turns them into a click', () => {
    renderItem(scheduled);
    header().focus();

    // fireEvent.keyDown devuelve false si alguien llamó preventDefault.
    expect(fireEvent.keyDown(header(), { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(header(), { key: ' ' })).toBe(true);
  });
});

describe('OrderAccordionItem — panel', () => {
  it('opens the comanda: number, the name they call, address, items and the payment footer', () => {
    renderItem(scheduled, { open: true });

    expect(header()).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('region', { name: /retiro 13:00 hs/i });
    expect(within(panel).getByText('Comanda Nº 0202')).toBeInTheDocument();
    expect(within(panel).getByText('Te vamos a llamar como')).toBeInTheDocument();
    expect(within(panel).getByText('Sofi')).toBeInTheDocument();
    expect(within(panel).getByText('11 de Septiembre 4502')).toBeInTheDocument();
    expect(within(panel).getByText('Milanesa Napolitana')).toBeInTheDocument();
    expect(within(panel).getByText('c/ papas fritas')).toBeInTheDocument();
    expect(within(panel).getAllByText('1 almuerzo')).toHaveLength(2);
    expect(within(panel).queryByText(/Reservaste/)).not.toBeInTheDocument();
    expect(within(panel).queryByText(/Te quedan/)).not.toBeInTheDocument();
    expect(within(panel).getByText(/Podés cambiarlo o cancelarlo hasta 20 minutos antes del retiro/)).toBeInTheDocument();
    expect(within(panel).queryByText(/\$/)).not.toBeInTheDocument();
  });

  it('Programado: offers change time, add dishes (link with day and time) and cancel', () => {
    const { onRequestChangePickupTime, onRequestCancel } = renderItem(scheduled, { open: true });

    fireEvent.click(screen.getByRole('button', { name: /cambiar horario/i }));
    expect(onRequestChangePickupTime).toHaveBeenCalledWith(scheduled);
    const add = screen.getByRole('link', { name: /agregar platos/i });
    expect(add.getAttribute('href')).toBe(
      `/orders/today?fecha=2026-09-25&hora=${encodeURIComponent(scheduled.pickupAt)}`,
    );
    fireEvent.click(screen.getByRole('button', { name: /cancelar pedido/i }));
    expect(onRequestCancel).toHaveBeenCalledWith(scheduled);
    expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
  });

  it('Programado without the change window: no "Cambiar horario"', () => {
    renderItem({ ...scheduled, pickupTimeChangeable: false }, { open: true });

    expect(screen.queryByRole('button', { name: /cambiar horario/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
  });

  it('Pago pendiente: "Pagar ahora" stays even if the order is not cancellable (the backend decides)', () => {
    renderItem({ ...awaiting, cancellable: false }, { open: true });

    expect(screen.getByRole('button', { name: /pagar ahora/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('Pago pendiente: "Pagar ahora" and cancel, but no change or add', () => {
    const { onRequestPayNow } = renderItem(awaiting, { open: true });

    fireEvent.click(screen.getByRole('button', { name: /pagar ahora/i }));
    expect(onRequestPayNow).toHaveBeenCalledWith(awaiting);
    expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cambiar horario/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
    expect(screen.getByText(/esperando la confirmación de Mercado Pago/i)).toBeInTheDocument();
  });

  it('disables "Pagar ahora" while it is in progress', () => {
    renderItem(awaiting, { open: true, payingNow: true });

    expect(screen.getByRole('button', { name: /pagar ahora/i })).toBeDisabled();
  });

  it('Confirmado: read-only, no actions', () => {
    renderItem(readOnly('CONFIRMADO'), { open: true });

    expect(screen.queryByRole('button', { name: /cancelar pedido|cambiar horario|pagar ahora/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
  });

  it('Cancelado: says the lunches went back and offers no actions', () => {
    renderItem(readOnly('CANCELADO'), { open: true });

    expect(screen.getAllByText(/2 almuerzos devueltos a tu saldo/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /cancelar pedido/i })).not.toBeInTheDocument();
  });

  it('shows the in-row message as a status, and closes it', () => {
    const onDismissNotice = vi.fn();
    renderItem(scheduled, {
      open: true,
      notice: { title: 'Horario cambiado', text: 'Retirás tu pedido el viernes 25 de septiembre a las 13:10 hs.' },
      onDismissNotice,
    });

    const status = screen.getByRole('status');
    expect(within(status).getByText('Horario cambiado')).toBeInTheDocument();
    fireEvent.click(within(status).getByRole('button', { name: /cerrar aviso/i }));
    expect(onDismissNotice).toHaveBeenCalled();
  });

  it.each(['stack', 'wide'] as const)(
    'on %s the headline and actions sit below the ticket, with no side column',
    (layout) => {
      renderItem(scheduled, { open: true, layout });

      const panel = screen.getByRole('region', { name: /retiro 13:00 hs/i });
      const ticket = within(panel).getByTestId('comanda');
      const below = panel.querySelector('[data-testid="order-actions-area"]') as HTMLElement | null;
      expect(below).not.toBeNull();
      expect(panel.querySelector('[data-layout="split"]')).toBeNull();
      expect(ticket.compareDocumentPosition(below!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(ticket.contains(below!)).toBe(false);
      expect(within(below!).getByRole('button', { name: /cambiar horario/i })).toBeInTheDocument();
      expect(within(below!).getByText(/Podés cambiarlo o cancelarlo/)).toBeInTheDocument();
    },
  );

  it('never says "créditos"', () => {
    renderItem(scheduled, { open: true });

    expect(document.body.textContent).not.toMatch(/créditos?\b/i);
  });
});

describe('OrderAccordionItem — remove a dish (F29)', () => {
  it('offers a "×" on each dish of a scheduled, modifiable order', () => {
    const onRequestRemoveItem = vi.fn();
    renderItem(scheduled, { open: true, onRequestRemoveItem });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Ensalada César del pedido' }));

    expect(screen.getAllByRole('button', { name: /^quitar /i })).toHaveLength(2);
    expect(onRequestRemoveItem).toHaveBeenCalledWith(scheduled, scheduled.items[1]);
  });

  it('removes the dish by its id, even when ids do not follow the display order', () => {
    const shuffled: OrderV2 = {
      ...scheduled,
      items: [
        { ...scheduled.items[0], id: 90, dishNombre: 'Tarta' },
        { ...scheduled.items[1], id: 12, dishNombre: 'Empanadas' },
      ],
    };
    const onRequestRemoveItem = vi.fn();
    renderItem(shuffled, { open: true, onRequestRemoveItem });

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Tarta del pedido' }));

    expect(onRequestRemoveItem).toHaveBeenCalledWith(shuffled, shuffled.items.find((i) => i.id === 90));
  });

  it.each([
    ['not modifiable (after the cutoff)', { ...scheduled, modifiable: false }],
    ['awaiting payment', awaiting],
    ['confirmed', readOnly('CONFIRMADO')],
    ['cancelled', readOnly('CANCELADO')],
  ])('offers no "×" when the order is %s', (_name, order) => {
    renderItem(order, { open: true, onRequestRemoveItem: vi.fn() });

    expect(screen.queryByRole('button', { name: /^quitar /i })).not.toBeInTheDocument();
  });

  it('offers no "×" when the page does not wire it', () => {
    renderItem(scheduled, { open: true });

    expect(screen.queryByRole('button', { name: /^quitar /i })).not.toBeInTheDocument();
  });
});

describe('OrderAccordionItem — scroll into view', () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    vi.restoreAllMocks();
  });

  it('scrolls to the open row when arriving by a deep link', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderItem(scheduled, { open: true, scrollMode: 'deep' });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['scrolls', { top: -80 }],
    ['does not scroll', { top: 120 }],
  ])('always tells the page it handled scrollMode, when it %s', (_name, rect) => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    const onScrolled = vi.fn();

    renderItem(scheduled, { open: true, scrollMode: 'keep', onScrolled });

    expect(onScrolled).toHaveBeenCalledTimes(1);
  });

  it('brings the header back after opening, when it went out of view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: -80 } as DOMRect);

    renderItem(scheduled, { open: true, scrollMode: 'keep' });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('does not scroll when the header is still visible', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 120 } as DOMRect);

    renderItem(scheduled, { open: true, scrollMode: 'keep' });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('respects prefers-reduced-motion: jumps instead of animating', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;

    renderItem(scheduled, { open: true, scrollMode: 'deep' });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  });
});
