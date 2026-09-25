import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackOptionCard } from './PackOptionCard';
import type { CreditPack } from '../types';

const weekPack: CreditPack = {
  id: 2,
  code: 'WEEK',
  nombre: 'Paquete Semana',
  creditAmount: 5,
  priceCents: 700000,
  discountPercent: 10,
  ordenDisplay: 2,
  enabled: true,
};

function renderCard(props: Partial<Parameters<typeof PackOptionCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <PackOptionCard
      pack={weekPack}
      checked={false}
      onSelect={onSelect}
      recommended={false}
      stackLayers={2}
      priceLabel="$ 7.000"
      perLunchLabel="$ 1.400 por almuerzo"
      {...props}
    />,
  );
  return { onSelect };
}

describe('PackOptionCard', () => {
  it('shows the pack name, amount and prices from the pack data', () => {
    renderCard();

    expect(screen.getByText('Paquete Semana')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('$ 7.000')).toBeInTheDocument();
    expect(screen.getByText('$ 1.400 por almuerzo')).toBeInTheDocument();
  });

  it('shows the discount line only when discountPercent is greater than 0', () => {
    renderCard({ pack: { ...weekPack, discountPercent: 0 } });
    expect(screen.queryByText(/ahorrás/i)).not.toBeInTheDocument();
  });

  it('shows "Ahorrás N%" using the pack\'s own discountPercent', () => {
    renderCard();
    expect(screen.getByText('Ahorrás 10%')).toBeInTheDocument();
  });

  it('shows the "Recomendado" badge only when recommended is true', () => {
    renderCard({ recommended: true });
    expect(screen.getByText('Recomendado')).toBeInTheDocument();
  });

  it('hides the badge when recommended is false', () => {
    renderCard({ recommended: false });
    expect(screen.queryByText('Recomendado')).not.toBeInTheDocument();
  });

  it('reflects checked on the radio and calls onSelect when clicked', () => {
    const { onSelect } = renderCard({ checked: true });

    const radio = screen.getByRole('radio', { name: /paquete semana/i });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalled();
  });
});
