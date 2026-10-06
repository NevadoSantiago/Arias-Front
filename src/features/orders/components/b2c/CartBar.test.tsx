import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CartBar } from './CartBar';

describe('CartBar', () => {
  it('shows a hint to tap a dish when the cart is empty', () => {
    render(<CartBar count={0} isToday={true} dayLabel="hoy" onOpenReview={vi.fn()} />);

    expect(screen.getByText(/tocá un plato para armar tu pedido/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver pedido/i })).not.toBeInTheDocument();
  });

  it('shows "N plato · hoy" without the lunch cost for a single dish today and opens the review on click', () => {
    const onOpenReview = vi.fn();
    render(<CartBar count={1} isToday={true} dayLabel="hoy" onOpenReview={onOpenReview} />);

    expect(screen.getByText('1 plato · hoy')).toBeInTheDocument();
    expect(screen.queryByText(/usa \d+ almuerzo/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ver pedido/i }));
    expect(onOpenReview).toHaveBeenCalled();
  });

  it('pluralizes the dish count and shows the day label for a future day', () => {
    render(<CartBar count={3} isToday={false} dayLabel="lunes 28" onOpenReview={vi.fn()} />);

    expect(screen.getByText('3 platos · lunes 28')).toBeInTheDocument();
  });
});
