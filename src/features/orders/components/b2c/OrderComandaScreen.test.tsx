import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderComandaScreen } from './OrderComandaScreen';
import type { OrderV2 } from '../../services/ordersApi';

// 13:00 hs en Buenos Aires; "ahora" es el mismo día, 09:00 hs.
const PICKUP = '2026-09-24T16:00:00Z';
const NOW = new Date('2026-09-24T12:00:00Z');

const scheduled: OrderV2 = {
  id: 142,
  fecha: '2026-09-24',
  pickupAt: PICKUP,
  estado: 'PENDIENTE',
  creditTotal: 2,
  notas: null,
  items: [
    { id: 1, dishId: 10, dishNombre: 'Milanesa napolitana', dishCategoria: 'Básico', sideId: 5, sideNombre: 'Papas fritas', creditCost: 1, notas: 'Sin sal, por favor' },
    { id: 2, dishId: 11, dishNombre: 'Ensalada César', dishCategoria: 'Básico', sideId: null, sideNombre: null, creditCost: 1, notas: null },
  ],
  cancellable: true,
  modifiable: true,
  pickupTimeChangeable: true,
  paidWithMercadoPago: false,
  creditsFromBalance: 0,
};

function renderScreen(order: OrderV2, props: Partial<React.ComponentProps<typeof OrderComandaScreen>> = {}) {
  const handlers = {
    onBack: vi.fn(),
    onRequestChangePickupTime: vi.fn(),
    onRequestCancel: vi.fn(),
    onRequestPayNow: vi.fn(),
  };
  render(
    <MemoryRouter>
      <OrderComandaScreen
        order={order}
        now={NOW}
        callName="Sofi"
        walletAvailable={10}
        pickupLeadMinutes={20}
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  );
  return handlers;
}

describe('OrderComandaScreen', () => {
  it('is a full-screen dialog named by its title, with the comanda of the order and the name they call', () => {
    renderScreen(scheduled);

    expect(screen.getByRole('dialog', { name: 'Pedido programado' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /comanda número 0142/i })).toBeInTheDocument();
    expect(screen.getByText('Sofi')).toBeInTheDocument();
    expect(screen.getByText('Hoy, jueves 24 de septiembre · 13:00 hs')).toBeInTheDocument();
    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('Sin sal, por favor')).toBeInTheDocument();
    expect(screen.getByText('Reservaste 2 almuerzos para este pedido')).toBeInTheDocument();
    expect(screen.getByText('Te quedan 10 almuerzos')).toBeInTheDocument();
  });

  it('goes back with the "‹ Mis pedidos" control', () => {
    const { onBack } = renderScreen(scheduled);

    fireEvent.click(screen.getByRole('button', { name: /mis pedidos/i }));

    expect(onBack).toHaveBeenCalled();
  });

  describe('modal behaviour', () => {
    it('closes with Escape', () => {
      const { onBack } = renderScreen(scheduled);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onBack).toHaveBeenCalled();
    });

    it('keeps the focus inside while it is open', async () => {
      render(
        <MemoryRouter>
          <button type="button">Afuera</button>
          <OrderComandaScreen order={scheduled} now={NOW} callName="Sofi" walletAvailable={10} onBack={vi.fn()} />
        </MemoryRouter>,
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toContainElement(document.activeElement as HTMLElement);

      screen.getByRole('button', { name: 'Afuera', hidden: true }).focus();

      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    });

    it('gives the focus back to the element that opened it', async () => {
      function Host() {
        const [open, setOpen] = useState(false);
        return (
          <MemoryRouter>
            <button type="button" onClick={() => setOpen(true)}>
              Abrir
            </button>
            {open && (
              <OrderComandaScreen order={scheduled} now={NOW} callName="Sofi" walletAvailable={10} onBack={() => setOpen(false)} />
            )}
          </MemoryRouter>
        );
      }
      render(<Host />);
      const opener = screen.getByRole('button', { name: 'Abrir' });
      opener.focus();
      fireEvent.click(opener);

      fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' });

      await waitFor(() => expect(opener).toHaveFocus());
    });
  });

  describe('Programado', () => {
    it('shows the badge, the cutoff headline and the three actions', () => {
      renderScreen(scheduled);

      expect(screen.getByText('Programado')).toBeInTheDocument();
      expect(
        screen.getByText('Te esperamos hoy a las 13:00. Podés cambiarlo o cancelarlo hasta 20 minutos antes del retiro.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cambiar horario/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /agregar platos/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
    });

    it('sends "Agregar platos" to the order page with the day and the pickup time', () => {
      renderScreen(scheduled);

      const href = screen.getByRole('link', { name: /agregar platos/i }).getAttribute('href');
      expect(href).toBe(`/orders/today?fecha=2026-09-24&hora=${encodeURIComponent(PICKUP)}`);
    });

    it('asks to change the time or cancel with the order', () => {
      const { onRequestChangePickupTime, onRequestCancel } = renderScreen(scheduled);

      fireEvent.click(screen.getByRole('button', { name: /cambiar horario/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancelar pedido/i }));

      expect(onRequestChangePickupTime).toHaveBeenCalledWith(scheduled);
      expect(onRequestCancel).toHaveBeenCalledWith(scheduled);
    });

    it('offers "Agregar platos" only when the order is modifiable', () => {
      renderScreen({ ...scheduled, modifiable: false });

      expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cambiar horario/i })).toBeInTheDocument();
    });

    it('is read-only once the cutoff passed (no flags): says so and offers no action', () => {
      renderScreen({ ...scheduled, cancellable: false, modifiable: false, pickupTimeChangeable: false });

      expect(screen.getByText('Te esperamos hoy a las 13:00. Ya pasó el límite para cambiarlo o cancelarlo.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cambiar horario|cancelar pedido/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
    });
  });

  describe('Pago pendiente', () => {
    const awaiting: OrderV2 = {
      ...scheduled,
      estado: 'PENDIENTE_PAGO',
      paidWithMercadoPago: true,
      creditsFromBalance: 0,
      modifiable: false,
      pickupTimeChangeable: false,
    };

    it('shows the awaiting-payment copy, the price placeholder and "Pagar ahora" plus "Cancelar pedido" only', () => {
      renderScreen(awaiting);

      expect(screen.getByRole('dialog', { name: 'Falta confirmar el pago' })).toBeInTheDocument();
      expect(screen.getByText('Pago pendiente')).toBeInTheDocument();
      expect(
        screen.getByText('Estamos esperando la confirmación de Mercado Pago. Si no se confirma antes de las 12:40, se cancela.'),
      ).toBeInTheDocument();
      expect(screen.getByText('A pagar con Mercado Pago')).toBeInTheDocument();
      expect(screen.getAllByText('$ [PRECIO]').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /pagar ahora/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancelar pedido/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cambiar horario/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
    });

    it('pays now with the order from "Pagar ahora"', () => {
      const { onRequestPayNow } = renderScreen(awaiting);
      fireEvent.click(screen.getByRole('button', { name: /pagar ahora/i }));
      expect(onRequestPayNow).toHaveBeenCalledWith(awaiting);
    });

    it('disables "Pagar ahora" while paying', () => {
      renderScreen(awaiting, { payingNow: true });

      expect(screen.getByRole('button', { name: /pagar ahora/i })).toBeDisabled();
    });
  });

  describe('read-only states', () => {
    it('Confirmado: "ya lo estamos preparando", paid footer and no actions', () => {
      renderScreen({
        ...scheduled,
        estado: 'CONFIRMADO',
        cancellable: false,
        modifiable: false,
        pickupTimeChangeable: false,
      });

      expect(screen.getByRole('dialog', { name: 'Ya lo estamos preparando' })).toBeInTheDocument();
      expect(screen.getByText('Confirmado')).toBeInTheDocument();
      expect(screen.getByText('Te esperamos hoy a las 13:00. Este pedido ya no se puede modificar.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cambiar horario|cancelar pedido|pagar ahora/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /agregar platos/i })).not.toBeInTheDocument();
    });

    it('Confirmado paid with Mercado Pago: "Pagado con Mercado Pago" and the price placeholder', () => {
      renderScreen({
        ...scheduled,
        estado: 'CONFIRMADO',
        paidWithMercadoPago: true,
        creditsFromBalance: 0,
        cancellable: false,
        modifiable: false,
        pickupTimeChangeable: false,
      });

      expect(screen.getByText('Pagado con Mercado Pago')).toBeInTheDocument();
      expect(screen.getAllByText('$ [PRECIO]').length).toBeGreaterThan(0);
    });

    it('Cancelado: muted comanda, the lunches went back, and no actions', () => {
      renderScreen({
        ...scheduled,
        estado: 'CANCELADO',
        cancellable: false,
        modifiable: false,
        pickupTimeChangeable: false,
      });

      expect(screen.getByRole('dialog', { name: 'Pedido cancelado' })).toBeInTheDocument();
      expect(screen.getByText('Cancelado')).toBeInTheDocument();
      expect(screen.getByText('2 almuerzos volvieron a tu saldo.')).toBeInTheDocument();
      expect(screen.getByTestId('comanda')).toHaveClass('opacity-60');
      expect(screen.queryByRole('button', { name: /cambiar horario|cancelar pedido|pagar ahora/i })).not.toBeInTheDocument();
    });

    it('a past order shows the day it was picked up and no actions', () => {
      renderScreen({
        ...scheduled,
        pickupAt: '2026-09-22T16:10:00Z',
        fecha: '2026-09-22',
        estado: 'ENTREGADO',
        cancellable: false,
        modifiable: false,
        pickupTimeChangeable: false,
      });

      expect(screen.getByRole('dialog', { name: 'Pedido retirado' })).toBeInTheDocument();
      expect(screen.getByText('Pagado con almuerzos')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cambiar horario|cancelar pedido|pagar ahora/i })).not.toBeInTheDocument();
    });
  });

  it('never says "créditos"', () => {
    renderScreen(scheduled);

    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });
});

describe('OrderComandaScreen — dialog presentation (F22b)', () => {
  it('is a centered modal with a close button, and keeps Escape', async () => {
    const handlers = renderScreen(scheduled, { presentation: 'dialog' });
    const dialog = screen.getByRole('dialog', { name: 'Pedido programado' });
    expect(dialog).toHaveAttribute('data-presentation', 'dialog');
    expect(screen.queryByRole('button', { name: /mis pedidos/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar la comanda' }));
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(handlers.onBack).toHaveBeenCalledTimes(2));
  });

  it('defaults to the full-screen presentation', () => {
    renderScreen(scheduled);
    expect(screen.getByRole('dialog', { name: 'Pedido programado' })).toHaveAttribute('data-presentation', 'screen');
  });
});
