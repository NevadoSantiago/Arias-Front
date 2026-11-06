import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountDiscountNote } from './AccountDiscountNote';

const base = { percent: 10, expiresAt: '2099-01-01T15:00:00Z' };

describe('AccountDiscountNote', () => {
  it('names the loyalty line as the origin of the discount', () => {
    render(<AccountDiscountNote discount={{ ...base, source: 'LOYALTY' }} />);

    expect(screen.getByText(/10% aplicado/i)).toBeInTheDocument();
    expect(screen.getByText(/línea de beneficios\. se usa en esta compra/i)).toBeInTheDocument();
  });

  it('keeps the launch name for any other origin', () => {
    render(<AccountDiscountNote discount={{ ...base, source: 'REVIEW_CAMPAIGN' }} />);

    expect(screen.getByText(/descuento primeros 100\. se usa en esta compra/i)).toBeInTheDocument();
  });
});
