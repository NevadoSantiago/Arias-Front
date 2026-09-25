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

describe('PackCheckoutSheet', () => {
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
