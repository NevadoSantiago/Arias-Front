import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackSummaryCard } from './PackSummaryCard';
import type { CreditPack } from '../types';

const weekPack: CreditPack = {
  id: 2,
  code: 'WEEK',
  packType: 'SUGERIDO',
  nombre: 'Semana',
  creditAmount: 5,
  priceCents: 700000,
  discountPercent: 10,
  ordenDisplay: 2,
  enabled: true,
  lema: 'Resolvé tu semana',
};

function renderCard(props: Partial<Parameters<typeof PackSummaryCard>[0]> = {}) {
  const onSelect = vi.fn();
  const view = render(
    <PackSummaryCard
      pack={weekPack}
      checked={false}
      onSelect={onSelect}
      recommended={false}
      priceLabel="$ 7.000"
      perLunchLabel="$ 1.400"
      lema="Resolvé tu semana"
      {...props}
    />,
  );
  return { onSelect, ...view };
}

describe('PackSummaryCard', () => {
  it('shows the name, the amount, the lema and the per-lunch price', () => {
    renderCard();
    expect(screen.getByText('Semana')).toBeInTheDocument();
    expect(screen.getByText('5 almuerzos')).toBeInTheDocument();
    expect(screen.getByText('Resolvé tu semana')).toBeInTheDocument();
    expect(screen.getByText('Precio por almuerzo')).toBeInTheDocument();
    expect(screen.getByText('$ 1.400')).toBeInTheDocument();
  });

  it('shows the discount row only when the discount is greater than 0', () => {
    const { unmount } = renderCard();
    expect(screen.getByText('Descuento')).toBeInTheDocument();
    expect(screen.getByText('−10%')).toBeInTheDocument();
    unmount();

    renderCard({ pack: { ...weekPack, discountPercent: 0 } });
    expect(screen.queryByText('Descuento')).not.toBeInTheDocument();
  });

  it('never shows the total price, only in the accessible name', () => {
    renderCard();
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
    expect(screen.queryByText('$ 7.000')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Semana, 5 almuerzos, $ 7.000' })).toBeInTheDocument();
  });

  it('reflects the checked state and shows the seal only when checked', () => {
    const { unmount } = renderCard({ checked: false });
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
    expect(document.querySelector('[data-part="selected-seal"]')).toBeNull();
    unmount();

    renderCard({ checked: true });
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelector('[data-part="selected-seal"]')).not.toBeNull();
  });

  it('shows the "Mejor opción" ribbon only when recommended', () => {
    const { unmount } = renderCard({ recommended: false });
    expect(screen.queryByText('Mejor opción')).not.toBeInTheDocument();
    unmount();

    renderCard({ recommended: true });
    expect(screen.getByText('Mejor opción')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const { onSelect } = renderCard();
    fireEvent.click(screen.getByRole('radio'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('uses the singular for a one-lunch pack', () => {
    renderCard({ pack: { ...weekPack, creditAmount: 1 } });
    expect(screen.getByText('1 almuerzo')).toBeInTheDocument();
  });
});
