import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StationBadge } from './StationBadge';

describe('StationBadge', () => {
  it('shows Parrilla highlighted with a flame icon', () => {
    render(<StationBadge station="PARRILLA" />);
    const badge = screen.getByText('Parrilla').closest('span')!;
    expect(badge.querySelector('svg.lucide-flame')).not.toBeNull();
    expect(badge.getAttribute('data-station')).toBe('PARRILLA');
  });

  it('shows Cocina as a quiet outline badge', () => {
    render(<StationBadge station="COCINA" />);
    const badge = screen.getByText('Cocina').closest('span')!;
    expect(badge.querySelector('svg.lucide-flame')).toBeNull();
    expect(badge.getAttribute('data-station')).toBe('COCINA');
  });
});
