import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LooseSummaryCard } from './LooseSummaryCard';

type Props = Parameters<typeof LooseSummaryCard>[0];

function renderCard(over: Partial<Props> = {}) {
  const props: Props = {
    checked: false,
    onSelect: vi.fn(),
    qty: 1,
    onQtyChange: vi.fn(),
    unitPriceLabel: '$ 1.500',
    showNudge: false,
    onPickRecommended: vi.fn(),
    lema: 'Resolvé hoy',
    ...over,
  };
  const view = render(<LooseSummaryCard {...props} />);
  return { props, ...view };
}

describe('LooseSummaryCard', () => {
  it('shows "Sueltos", the lema and the per-lunch price, without a total', () => {
    renderCard({ checked: true, qty: 3 });
    expect(screen.getByText('Sueltos')).toBeInTheDocument();
    expect(screen.getByText('Resolvé hoy')).toBeInTheDocument();
    expect(screen.getByText('Precio por almuerzo')).toBeInTheDocument();
    expect(screen.getByText('$ 1.500')).toBeInTheDocument();
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  it('shows one lunch when unchecked and the quantity when checked', () => {
    const { unmount } = renderCard({ checked: false, qty: 4 });
    expect(screen.getByText('1 almuerzo')).toBeInTheDocument();
    unmount();
    renderCard({ checked: true, qty: 4 });
    expect(screen.getByText('4 almuerzos')).toBeInTheDocument();
  });

  it('reflects the checked state and shows the seal only when checked', () => {
    const { unmount } = renderCard({ checked: false });
    expect(screen.getByRole('radio', { name: /sueltos/i })).toHaveAttribute('aria-checked', 'false');
    expect(document.querySelector('[data-part="selected-seal"]')).toBeNull();
    unmount();
    renderCard({ checked: true });
    expect(screen.getByRole('radio', { name: /sueltos/i })).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-part="selected-seal"]')).not.toBeNull();
  });

  it('shows the stepper only while selected', () => {
    const { unmount } = renderCard({ checked: false });
    expect(screen.queryByRole('button', { name: /un almuerzo más/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Cantidad')).not.toBeInTheDocument();
    unmount();
    renderCard({ checked: true });
    expect(screen.getByRole('button', { name: /un almuerzo más/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /un almuerzo menos/i })).toBeInTheDocument();
    expect(screen.getByText('Cantidad')).toBeInTheDocument();
  });

  it('calls onSelect when the radio is clicked', () => {
    const { props } = renderCard();
    fireEvent.click(screen.getByRole('radio', { name: /sueltos/i }));
    expect(props.onSelect).toHaveBeenCalled();
  });

  it('increments and decrements the quantity', () => {
    const { props } = renderCard({ qty: 5, checked: true });
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    expect(props.onQtyChange).toHaveBeenCalledWith(6);
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo menos/i }));
    expect(props.onQtyChange).toHaveBeenCalledWith(4);
  });

  it('disables the stepper at the 1 and 10 bounds', () => {
    const low = renderCard({ qty: 1, checked: true });
    expect(screen.getByRole('button', { name: /un almuerzo menos/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo menos/i }));
    expect(low.props.onQtyChange).not.toHaveBeenCalled();
    low.unmount();

    const top = renderCard({ qty: 10, checked: true });
    expect(screen.getByRole('button', { name: /un almuerzo más/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    expect(top.props.onQtyChange).not.toHaveBeenCalled();
  });

  it('shows the Semana nudge only when showNudge is true and lets the customer jump to it', () => {
    const hidden = renderCard({ showNudge: false, checked: true, qty: 4 });
    expect(screen.queryByText(/llevás 5/i)).not.toBeInTheDocument();
    hidden.unmount();

    const shown = renderCard({ showNudge: true, checked: true, qty: 4 });
    expect(screen.getByText(/llevás 5 y cada uno te sale más barato/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver paquete/i }));
    expect(shown.props.onPickRecommended).toHaveBeenCalled();
  });
});

describe('LooseSummaryCard with an account discount', () => {
  it('shows the discount row and the total with the list price struck through', () => {
    renderCard({ checked: true, qty: 3, accountDiscount: { percent: 10, listTotalLabel: '$ 4.500', totalLabel: '$ 4.050' } });

    expect(screen.getByText('Primeros 100')).toBeInTheDocument();
    expect(screen.getByText('−10%')).toBeInTheDocument();
    expect(screen.getByText('$ 4.500').className).toContain('line-through');
    expect(screen.getByText('$ 4.050')).toBeInTheDocument();
  });
});
