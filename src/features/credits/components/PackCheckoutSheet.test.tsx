import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackCheckoutSheet } from './PackCheckoutSheet';
import type { PackCheckoutSelection } from './PackCheckoutSheet';

const selection: PackCheckoutSelection = {
  isLoose: false,
  icon: 'stack2',
  productName: 'Paquete Semana',
  amountLabel: '5 almuerzos',
  perLunchLabel: '$ 1.400 por almuerzo',
  hasDiscount: true,
  discountLabel: '−10%',
  accountDiscount: null,
  totalLabel: '$ 7.000',
  fromAvailable: 12,
  toAvailable: 17,
};

function renderSheet(props: Partial<Parameters<typeof PackCheckoutSheet>[0]> = {}) {
  const onClose = vi.fn();
  const onPay = vi.fn();
  render(
    <PackCheckoutSheet open={true} onClose={onClose} selection={selection} onPay={onPay} isPending={false} {...props} />,
  );
  return { onClose, onPay };
}

const withAccountDiscount: PackCheckoutSelection = {
  ...selection,
  totalLabel: '$ 6.300',
  accountDiscount: { percent: 10, subtotalLabel: '$ 7.000', savingLabel: '$ 700', expiresAt: '2099-01-01T15:00:00Z' },
};

describe('PackCheckoutSheet', () => {
  it('breaks down subtotal, account discount and total, and says when it expires', async () => {
    renderSheet({ selection: withAccountDiscount });

    await screen.findByRole('dialog', { name: /revisá tu compra/i });
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('$ 7.000')).toBeInTheDocument();
    expect(screen.getByText(/descuento primeros 100/i)).toHaveTextContent('· −10%');
    expect(screen.getByText('−$ 700')).toBeInTheDocument();
    expect(screen.getByText('$ 6.300')).toBeInTheDocument();
    expect(screen.getByText(/se usa en esta compra\. vence/i)).toBeInTheDocument();
  });

  it('shows no account-discount rows when there is none', async () => {
    renderSheet();

    await screen.findByText('Paquete Semana');
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument();
    expect(screen.queryByText(/primeros 100/i)).not.toBeInTheDocument();
  });

  it('shows the product, the per-lunch price, the discount and the total', async () => {
    renderSheet();

    expect(await screen.findByRole('dialog', { name: /revisá tu compra/i })).toBeInTheDocument();
    expect(screen.getByText('Paquete Semana')).toBeInTheDocument();
    expect(screen.getByText('5 almuerzos')).toBeInTheDocument();
    expect(screen.getByText('$ 1.400 por almuerzo')).toBeInTheDocument();
    expect(screen.getByText('−10%')).toBeInTheDocument();
    expect(screen.getByText('$ 7.000')).toBeInTheDocument();
  });

  it('hides the discount row when hasDiscount is false', async () => {
    renderSheet({ selection: { ...selection, hasDiscount: false } });

    await screen.findByText('Paquete Semana');
    expect(screen.queryByText('−10%')).not.toBeInTheDocument();
  });

  it('shows the balance transition when the wallet balance is known', async () => {
    renderSheet();

    expect(await screen.findByText(/tu saldo pasa de/i)).toBeInTheDocument();
    expect(screen.getByText('12', { exact: false })).toBeInTheDocument();
  });

  it('hides the balance transition when the wallet balance is not known', async () => {
    renderSheet({ selection: { ...selection, fromAvailable: null, toAvailable: null } });

    await screen.findByText('Paquete Semana');
    expect(screen.queryByText(/tu saldo pasa de/i)).not.toBeInTheDocument();
  });

  it('calls onPay when "Pagar con Mercado Pago" is clicked, and disables it while pending', async () => {
    const { onPay } = renderSheet();

    const button = await screen.findByRole('button', { name: /pagar con mercado pago/i });
    fireEvent.click(button);
    expect(onPay).toHaveBeenCalled();
  });

  it('disables the pay button and shows a redirecting label while a purchase is pending', async () => {
    renderSheet({ isPending: true });

    const button = await screen.findByRole('button', { name: /redirigiendo/i });
    expect(button).toBeDisabled();
  });
});
