import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PendingPurchasesNotice } from './PendingPurchasesNotice';
import type { CreditPurchase } from '../types';

// 12:05 en Buenos Aires (UTC-3), el mismo día que `NOW`.
const NOW = new Date('2026-09-29T18:00:00Z');

const pack: CreditPurchase = {
  id: 'pack-1',
  type: 'PACK',
  creditAmount: 5,
  amountCents: 700000,
  currency: 'ARS',
  status: 'PENDING',
  createdAt: '2026-09-29T14:52:00Z',
  creditedAt: null,
  reversedAt: null,
  packNombre: 'Paquete Semana',
  orderId: null,
  orderEstado: null,
};
const direct: CreditPurchase = {
  ...pack,
  id: 'dir-1',
  type: 'DIRECT',
  creditAmount: 2,
  amountCents: 300000,
  createdAt: '2026-09-29T15:05:00Z',
  packNombre: null,
  orderId: 42,
  orderEstado: 'PENDIENTE_PAGO',
};

function renderNotice(purchases: CreditPurchase[], props: Partial<React.ComponentProps<typeof PendingPurchasesNotice>> = {}) {
  const onPayNow = vi.fn();
  const view = render(
    <MemoryRouter>
      <PendingPurchasesNotice purchases={purchases} now={NOW} payingOrderId={null} onPayNow={onPayNow} {...props} />
    </MemoryRouter>,
  );
  return { onPayNow, ...view };
}

describe('PendingPurchasesNotice (D6)', () => {
  it('renders nothing without pending purchases', () => {
    const { container } = renderNotice([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('a pack: named after the pack, with amount, badge, credited text and the payment status link, never "Pagar ahora"', () => {
    renderNotice([pack]);

    const region = screen.getByRole('region', { name: 'Pago pendiente' });
    expect(within(region).getByText('Paquete Semana')).toBeInTheDocument();
    expect(within(region).getByText('5 almuerzos · Mercado Pago · iniciado hoy 11:52')).toBeInTheDocument();
    expect(within(region).getByText(/7\.000,00/)).toBeInTheDocument();
    expect(within(region).getByText('+5 por acreditar')).toBeInTheDocument();
    expect(
      within(region).getByText('Los 5 almuerzos se acreditan en tu saldo apenas Mercado Pago confirme el pago.'),
    ).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: /ver estado del pago/i })).toHaveAttribute('href', '/compras/pack-1/procesando');
    expect(within(region).queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
    expect(within(region).queryByRole('link', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(region).not.toHaveTextContent(/créditos/i);
  });

  it('loose lunches: "N almuerzos sueltos" when the pack is the DAY pack, and "N almuerzo(s)" without a name', () => {
    const loose = { ...pack, creditAmount: 3, packNombre: 'Sueltos' };
    const first = renderNotice([loose], { looseName: 'Sueltos' });
    expect(screen.getByText('3 almuerzos sueltos')).toBeInTheDocument();
    expect(screen.getByText('Mercado Pago · iniciado hoy 11:52')).toBeInTheDocument();
    first.unmount();

    renderNotice([{ ...pack, creditAmount: 1, packNombre: null }]);
    expect(screen.getByText('1 almuerzo', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('+1 por acreditar')).toBeInTheDocument();
    expect(screen.getByText('El almuerzo se acredita en tu saldo apenas Mercado Pago confirme el pago.')).toBeInTheDocument();
  });

  it('says "ayer" when the payment was started the day before', () => {
    renderNotice([{ ...pack, createdAt: '2026-09-28T20:30:00Z' }]);

    expect(screen.getByText('5 almuerzos · Mercado Pago · iniciado ayer 17:30')).toBeInTheDocument();
  });

  it('an order payment: numbered like the comanda, with the three actions', () => {
    const { onPayNow } = renderNotice([direct]);

    const region = screen.getByRole('region', { name: 'Pago pendiente' });
    expect(within(region).getByText('Pago del pedido #0042')).toBeInTheDocument();
    expect(within(region).getByText('2 almuerzos · Mercado Pago · iniciado hoy 12:05')).toBeInTheDocument();
    expect(within(region).getByText('2 para tu pedido')).toBeInTheDocument();
    expect(
      within(region).getByText('Apenas Mercado Pago confirme el pago, los 2 almuerzos se acreditan y quedan reservados para este pedido.'),
    ).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: /ver estado del pago/i })).toHaveAttribute('href', '/compras/dir-1/procesando');
    expect(within(region).getByRole('link', { name: /ver pedido/i })).toHaveAttribute('href', '/orders/mine?pedido=42');

    fireEvent.click(within(region).getByRole('button', { name: 'Pagar ahora el pedido #0042 con Mercado Pago' }));
    expect(onPayNow).toHaveBeenCalledWith(42);
  });

  it('disables "Pagar ahora" while that order is being resumed', () => {
    renderNotice([direct], { payingOrderId: 42 });

    expect(screen.getByRole('button', { name: /pagar ahora el pedido #0042/i })).toBeDisabled();
  });

  it('a cancelled order: the lunches go to the balance, and there is no "Pagar ahora"', () => {
    renderNotice([{ ...direct, orderEstado: 'CANCELADO' }]);

    expect(screen.getByText('+2 por acreditar')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Este pedido se canceló. Cuando Mercado Pago confirme el pago, los 2 almuerzos se acreditan en tu saldo para que los uses cuando quieras.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver pedido/i })).toBeInTheDocument();
  });

  it('shows "Pagar ahora" only while the order awaits payment', () => {
    renderNotice([{ ...direct, orderEstado: 'CONFIRMADO' }]);

    expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
  });

  it('a direct payment without its order (older response) keeps the status link only', () => {
    renderNotice([{ ...direct, orderId: null, orderEstado: null }]);

    expect(screen.getByText('Pago de tu pedido')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver estado del pago/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver pedido/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /pagar ahora/i })).not.toBeInTheDocument();
  });

  it('two payments are grouped and expandable, with aria-expanded on the toggle', () => {
    renderNotice([direct, pack]);

    const region = screen.getByRole('region', { name: '2 pagos pendientes' });
    expect(within(region).getByText(/pedido #0042 y Paquete Semana/)).toBeInTheDocument();
    expect(within(region).getByText(/todavía no están en tu saldo/i)).toBeInTheDocument();
    expect(within(region).queryByText('Pago del pedido #0042')).not.toBeInTheDocument();

    const toggle = within(region).getByRole('button', { name: /ver los 2 pagos/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    expect(within(region).getByRole('button', { name: /ocultar detalle/i })).toHaveAttribute('aria-expanded', 'true');
    expect(within(region).getByText('Pago del pedido #0042')).toBeInTheDocument();
    expect(within(region).getByText('Paquete Semana')).toBeInTheDocument();
    expect(within(region).getAllByRole('link', { name: /ver estado del pago/i })).toHaveLength(2);

    fireEvent.click(within(region).getByRole('button', { name: /ocultar detalle/i }));
    expect(within(region).queryByText('Pago del pedido #0042')).not.toBeInTheDocument();
  });

  it('the wide variant marks its layout for desktop', () => {
    renderNotice([pack], { variant: 'wide' });

    expect(screen.getByRole('region', { name: 'Pago pendiente' })).toHaveAttribute('data-layout', 'wide');
  });
});
