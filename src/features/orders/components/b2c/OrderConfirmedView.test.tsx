import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderConfirmedView } from './OrderConfirmedView';
import type { ComandaFooter, ComandaItem } from './comandaModel';

const items: ComandaItem[] = [
  { id: 1, name: 'Milanesa napolitana', side: 'c/ papas fritas', note: 'Sin sal, por favor', costLabel: '2 almuerzos', isNew: false },
  { id: 2, name: 'Ensalada César', side: null, note: null, costLabel: '1 almuerzo', isNew: false },
];

const lunchFooter: ComandaFooter = {
  label: 'Reservaste 3 almuerzos para este pedido',
  value: 'Te quedan 9 almuerzos',
  icon: 'lunches',
};

function renderView(props: Partial<Parameters<typeof OrderConfirmedView>[0]> = {}) {
  const onBackToMenu = vi.fn();
  render(
    <MemoryRouter>
      <OrderConfirmedView
        isToday={true}
        dayLongLabel="Jueves 24 de septiembre"
        pickupTimeLabel="15:00"
        orderId={142}
        callName="Sofi"
        items={items}
        footer={lunchFooter}
        onBackToMenu={onBackToMenu}
        {...props}
      />
    </MemoryRouter>,
  );
  return { onBackToMenu };
}

describe('OrderConfirmedView', () => {
  it('shows "¡Pedido confirmado!" and "Te esperamos hoy" for a same-day order', () => {
    renderView({ isToday: true });

    expect(screen.getByText('¡Pedido confirmado!')).toBeInTheDocument();
    expect(screen.getByText('Te esperamos hoy a las 15:00.')).toBeInTheDocument();
  });

  it('shows "¡Pedido programado!" and "Te esperamos el <día>" for a future order', () => {
    renderView({ isToday: false, dayLongLabel: 'Lunes 28 de septiembre' });

    expect(screen.getByText('¡Pedido programado!')).toBeInTheDocument();
    expect(screen.getByText('Te esperamos el lunes 28 de septiembre a las 15:00.')).toBeInTheDocument();
  });

  it('renders the order as a comanda: number, date, the name they call and the pickup time with the restaurant address', () => {
    renderView();

    expect(screen.getByRole('article', { name: /comanda número 0142/i })).toBeInTheDocument();
    expect(screen.getByText('Comanda Nº 0142')).toBeInTheDocument();
    expect(screen.getByText('Te vamos a llamar como')).toBeInTheDocument();
    expect(screen.getByText('Sofi')).toBeInTheDocument();
    expect(screen.getByText('Hoy, jueves 24 de septiembre · 15:00 hs')).toBeInTheDocument();
    expect(screen.getByText('11 de Septiembre 4502')).toBeInTheDocument();
  });

  it('shows the pickup day and time and each line item with its side, note and cost', () => {
    renderView({ isToday: false, dayLongLabel: 'Lunes 28 de septiembre' });

    expect(screen.getByText('Lunes 28 de septiembre · 15:00 hs')).toBeInTheDocument();
    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('c/ papas fritas')).toBeInTheDocument();
    expect(screen.getByText('Sin sal, por favor')).toBeInTheDocument();
    expect(screen.getByText('2 almuerzos')).toBeInTheDocument();
    expect(screen.getByText('Ensalada César')).toBeInTheDocument();
    expect(screen.getByText('1 almuerzo')).toBeInTheDocument();
  });

  it('shows how many lunches were reserved and, when known, what is left', () => {
    renderView();

    expect(screen.getByText('Reservaste 3 almuerzos para este pedido')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 9 almuerzos')).toBeInTheDocument();
  });

  it('hides the balance line when the wallet balance is not known', () => {
    renderView({ footer: { ...lunchFooter, value: null } });

    expect(screen.queryByText(/te quedan/i)).not.toBeInTheDocument();
  });

  it('shows the reminder and the cancellation note for a lunch-paid order', () => {
    renderView();

    expect(screen.getByText('Te avisamos 25 minutos antes del horario de retiro.')).toBeInTheDocument();
    expect(screen.getByText('Si cancelás el pedido, el almuerzo vuelve a tu saldo.')).toBeInTheDocument();
  });

  it('calls onBackToMenu from "Volver al menú" and links "Ver mis almuerzos" to /credits', () => {
    const { onBackToMenu } = renderView();

    fireEvent.click(screen.getByRole('button', { name: /volver al menú/i }));
    expect(onBackToMenu).toHaveBeenCalled();

    expect(screen.getByRole('link', { name: /ver mis almuerzos/i })).toHaveAttribute('href', '/credits');
  });

  describe('paid with Mercado Pago', () => {
    const directProps = {
      footer: { label: 'Pagado con Mercado Pago', value: '2 almuerzos', icon: 'card' as const },
      paidWithMercadoPago: true,
      creditsFromBalance: 0,
      items: items.map((i) => ({ ...i, costLabel: '1 almuerzo' })),
    };

    it('says Mercado Pago approved the payment and shows the lunches in the footer', () => {
      renderView(directProps);

      expect(screen.getByText('Mercado Pago aprobó el pago. Te esperamos hoy a las 15:00.')).toBeInTheDocument();
      expect(screen.getByText('Pagado con Mercado Pago')).toBeInTheDocument();
      expect(screen.getAllByText('2 almuerzos').length).toBeGreaterThan(0);
      expect(screen.queryByText(/te quedan/i)).not.toBeInTheDocument();
    });

    it('drops the balance note and links "Ver mis pedidos" instead of "Ver mis almuerzos"', () => {
      renderView(directProps);

      expect(screen.queryByText(/vuelve a tu saldo/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /ver mis almuerzos/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /ver mis pedidos/i })).toHaveAttribute('href', '/orders/mine');
    });
  });

  describe('items added to an existing order', () => {
    const addedItems: ComandaItem[] = [
      { ...items[0], isNew: false },
      { ...items[1], isNew: true },
    ];

    it('lands on the comanda of that order with the "sumado" headline and the new item tagged', () => {
      renderView({
        addedPlates: 1,
        items: addedItems,
        footer: { label: 'Reservaste 1 almuerzo más para este pedido', value: 'Te quedan 8 almuerzos', icon: 'lunches' },
      });

      expect(screen.getByText('¡Sumado a tu pedido!')).toBeInTheDocument();
      expect(screen.getByText('Sumaste 1 plato a tu pedido de hoy a las 15:00.')).toBeInTheDocument();
      expect(screen.getByText('Comanda Nº 0142')).toBeInTheDocument();
      expect(screen.getAllByText('Nuevo')).toHaveLength(1);
      expect(screen.getByText('Reservaste 1 almuerzo más para este pedido')).toBeInTheDocument();
    });

    it('pluralises the headline for several plates and names the day for a future order', () => {
      renderView({ addedPlates: 2, isToday: false, dayLongLabel: 'Lunes 28 de septiembre', items: addedItems });

      expect(
        screen.getByText('Sumaste 2 platos a tu pedido del lunes 28 de septiembre a las 15:00.'),
      ).toBeInTheDocument();
    });
  });

  it('never says "créditos"', () => {
    renderView();

    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });
});
