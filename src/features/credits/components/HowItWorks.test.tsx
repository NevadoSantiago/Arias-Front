import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';
import { catalogAmounts, formatAmountList } from '../howItWorksCopy';

describe('formatAmountList', () => {
  it('joins with commas and "o" before the last value', () => {
    expect(formatAmountList([1, 5, 20])).toBe('1, 5 o 20');
    expect(formatAmountList([5, 20])).toBe('5 o 20');
  });

  it('returns the single value as is', () => {
    expect(formatAmountList([5])).toBe('5');
  });

  it('falls back to a generic phrase when there are no amounts', () => {
    expect(formatAmountList([])).toBe('la cantidad que quieras');
  });
});

describe('catalogAmounts', () => {
  const pack = (creditAmount: number) => ({ creditAmount }) as never;

  it('lists the day pack and the named packs ascending, without repeats', () => {
    expect(catalogAmounts({ dayPack: pack(1), namedPacks: [pack(20), pack(5), pack(5)] })).toEqual([1, 5, 20]);
  });

  it('works without a day pack', () => {
    expect(catalogAmounts({ dayPack: null, namedPacks: [pack(20), pack(5)] })).toEqual([5, 20]);
  });
});

describe('HowItWorks', () => {
  it('shows the title and the three steps in order', () => {
    render(<HowItWorks packAmounts={[1, 5, 20]} />);

    expect(screen.getByRole('region', { name: '¿Cómo funciona?' })).toBeInTheDocument();
    const steps = screen.getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Comprá tus almuerzos');
    expect(steps[1]).toHaveTextContent('Elegí qué comer');
    expect(steps[2]).toHaveTextContent('Indicá el horario y retirala');
    expect(steps[1]).toHaveTextContent('Todos los platos del menú valen lo mismo: 1 almuerzo = 1 crédito.');
    expect(steps[2]).toHaveTextContent('Elegí cuándo retirás y nosotros la tenemos lista para vos.');
  });

  it('builds the first step copy from the enabled pack amounts', () => {
    render(<HowItWorks packAmounts={[1, 5, 20]} />);
    expect(screen.getByText('Elegí 1, 5 o 20. Cuantos más comprás, menos pagás.')).toBeInTheDocument();
  });

  it('handles a single amount and an empty catalog', () => {
    const { unmount } = render(<HowItWorks packAmounts={[5]} />);
    expect(screen.getByText('Elegí 5. Cuantos más comprás, menos pagás.')).toBeInTheDocument();
    unmount();

    render(<HowItWorks packAmounts={[]} />);
    expect(screen.getByText('Elegí la cantidad que quieras. Cuantos más comprás, menos pagás.')).toBeInTheDocument();
  });

  it('shows the step numbers and hides the decorative illustrations from assistive tech', () => {
    const { container } = render(<HowItWorks packAmounts={[1, 5, 20]} />);

    ['1', '2', '3'].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(3);
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
