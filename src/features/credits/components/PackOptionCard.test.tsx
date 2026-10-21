import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PackOptionCard } from './PackOptionCard';
import type { CreditPack } from '../types';

const weekPack: CreditPack = {
  id: 2,
  code: 'WEEK', packType: 'SUGERIDO',
  nombre: 'Paquete Semana',
  creditAmount: 5,
  priceCents: 700000,
  discountPercent: 10,
  ordenDisplay: 2,
  enabled: true,
  lema: null,
};

function renderCard(props: Partial<Parameters<typeof PackOptionCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <PackOptionCard
      pack={weekPack}
      checked={false}
      onSelect={onSelect}
      recommended={false}
      priceLabel="$ 7.000"
      perLunchLabel="$ 1.400"
      {...props}
    />,
  );
  return { onSelect };
}

describe('PackOptionCard', () => {
  it('shows the lunch count, the tagline and the per-lunch price from the pack data', () => {
    renderCard();

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('almuerzos')).toBeInTheDocument();
    expect(screen.getByText('Resolvé tu semana')).toBeInTheDocument();
    expect(screen.getByText('$ 1.400')).toBeInTheDocument();
    expect(screen.getByText('por almuerzo')).toBeInTheDocument();
  });

  it('uses the monthly tagline for 10 or more lunches', () => {
    renderCard({ pack: { ...weekPack, nombre: 'Paquete Mes', creditAmount: 20 } });
    expect(screen.getByText('¡Resolvé todo el mes!')).toBeInTheDocument();
  });

  it('never shows savings, totals or the old badge', () => {
    renderCard({ recommended: true });
    expect(screen.queryByText(/ahorrás/i)).not.toBeInTheDocument();
    expect(screen.queryByText('$ 7.000')).not.toBeInTheDocument();
    expect(screen.queryByText('Recomendado')).not.toBeInTheDocument();
  });

  it('shows the "Mejor opción" ribbon only when recommended is true', () => {
    const { unmount } = render(
      <PackOptionCard pack={weekPack} checked={false} onSelect={vi.fn()} recommended priceLabel="$ 7.000" perLunchLabel="$ 1.400" />,
    );
    expect(screen.getByText('Mejor opción')).toHaveAttribute('data-part', 'recommended-ribbon');
    unmount();

    renderCard({ recommended: false });
    expect(screen.queryByText('Mejor opción')).not.toBeInTheDocument();
  });

  it('names the radio with the pack, the lunches and the total, without savings', () => {
    renderCard();

    expect(screen.getByRole('radio', { name: 'Paquete Semana, 5 almuerzos, $ 7.000' })).toBeInTheDocument();
  });

  it('reflects checked on the radio and calls onSelect when clicked', () => {
    const { onSelect } = renderCard({ checked: true });

    const radio = screen.getByRole('radio', { name: /paquete semana/i });
    expect(radio).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows the selected seal only when checked', () => {
    const { unmount } = render(
      <PackOptionCard pack={weekPack} checked onSelect={vi.fn()} recommended={false} priceLabel="$ 7.000" perLunchLabel="$ 1.400" />,
    );
    expect(document.querySelector('[data-part="selected-seal"]')).not.toBeNull();
    unmount();

    renderCard({ checked: false });
    expect(document.querySelector('[data-part="selected-seal"]')).toBeNull();
  });

  it('keeps the price in its own block in both layouts', () => {
    renderCard({ layout: 'stacked' });

    expect(screen.getByText('$ 1.400').closest('[data-part="price-block"]')).not.toBeNull();
    expect(screen.getByText('5').closest('[data-part="price-block"]')).toBeNull();
  });

  it('stacked layout puts the word under the numeral; row layout keeps them on one line', () => {
    const { unmount } = render(
      <PackOptionCard pack={weekPack} checked={false} onSelect={vi.fn()} recommended={false} priceLabel="$ 7.000" perLunchLabel="$ 1.400" layout="stacked" />,
    );
    expect(screen.getByText('5').closest('[data-part="count-block"]')).toHaveAttribute('data-layout', 'stacked');
    unmount();

    renderCard();
    expect(screen.getByText('5').closest('[data-part="count-block"]')).toHaveAttribute('data-layout', 'row');
  });
});
