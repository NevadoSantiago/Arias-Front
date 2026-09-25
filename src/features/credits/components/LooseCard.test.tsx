import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LooseCard } from './LooseCard';

function renderCard(props: Partial<Parameters<typeof LooseCard>[0]> = {}) {
  const onSelect = vi.fn();
  const onQtyChange = vi.fn();
  const onPickRecommended = vi.fn();
  render(
    <LooseCard
      checked={false}
      onSelect={onSelect}
      qty={1}
      onQtyChange={onQtyChange}
      unitPriceLabel="$ 1.500"
      showNudge={false}
      onPickRecommended={onPickRecommended}
      {...props}
    />,
  );
  return { onSelect, onQtyChange, onPickRecommended };
}

describe('LooseCard', () => {
  it('shows "Sueltos" with the per-unit price and reflects the checked state on the radio', () => {
    renderCard({ checked: true });

    const radio = screen.getByRole('radio', { name: /sueltos/i });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('$ 1.500')).toBeInTheDocument();
    expect(screen.getByText('cada uno')).toBeInTheDocument();
  });

  it('calls onSelect when the radio is clicked', () => {
    const { onSelect } = renderCard({ checked: false });

    fireEvent.click(screen.getByRole('radio', { name: /sueltos/i }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('increments and decrements the quantity within 1..10', () => {
    const { onQtyChange } = renderCard({ qty: 5 });

    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    expect(onQtyChange).toHaveBeenCalledWith(6);

    fireEvent.click(screen.getByRole('button', { name: /un almuerzo menos/i }));
    expect(onQtyChange).toHaveBeenCalledWith(4);
  });

  it('does not go below 1 or above 10', () => {
    const onQtyChange = vi.fn();
    const { rerender } = render(
      <LooseCard
        checked={true}
        onSelect={vi.fn()}
        qty={1}
        onQtyChange={onQtyChange}
        unitPriceLabel="$ 1.500"
        showNudge={false}
        onPickRecommended={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /un almuerzo menos/i }));
    expect(onQtyChange).not.toHaveBeenCalled();

    rerender(
      <LooseCard
        checked={true}
        onSelect={vi.fn()}
        qty={10}
        onQtyChange={onQtyChange}
        unitPriceLabel="$ 1.500"
        showNudge={false}
        onPickRecommended={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /un almuerzo más/i }));
    expect(onQtyChange).not.toHaveBeenCalled();
  });

  it('shows the "Semana" nudge only when showNudge is true, and lets the customer jump to it', () => {
    const { onPickRecommended } = renderCard({ showNudge: true, checked: true, qty: 4 });

    expect(screen.getByText(/llevás 5 y cada uno te sale más barato/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver paquete/i }));
    expect(onPickRecommended).toHaveBeenCalled();
  });

  it('hides the nudge when showNudge is false', () => {
    renderCard({ showNudge: false });
    expect(screen.queryByText(/llevás 5/i)).not.toBeInTheDocument();
  });
});
