import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderNoticeBanner } from './OrderNoticeBanner';

describe('OrderNoticeBanner', () => {
  it('is a success status by default', () => {
    render(<OrderNoticeBanner notice={{ title: 'Pedido cancelado', text: 'Volvió a tu saldo.' }} />);

    expect(screen.getByRole('status')).toHaveClass('bg-success/15');
    expect(screen.getByText('Volvió a tu saldo.')).toBeInTheDocument();
  });

  it('uses the warning tone for an outcome that needs attention', () => {
    render(<OrderNoticeBanner notice={{ title: 'Pedido cancelado', text: 'Se cobró igual.', tone: 'warning' }} />);

    expect(screen.getByRole('status')).toHaveClass('bg-warning/15');
    expect(screen.getByRole('status')).not.toHaveClass('bg-success/15');
  });
});
