import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SectionPills } from './SectionPills';
import type { MenuSection } from '../../types';

const sections: MenuSection[] = [
  { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  { id: 2, nombre: 'Pastas', ordenDisplay: 2 },
];

describe('SectionPills (B2C, prototype style)', () => {
  it('renders "Todos" and one tab per section', () => {
    render(
      <SectionPills sections={sections} active="all" counts={{ all: 3, 1: 2, 2: 1 }} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('tab', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Carnes' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pastas' })).toBeInTheDocument();
  });

  it('marks the active section as selected', () => {
    render(
      <SectionPills sections={sections} active={2} counts={{ all: 3, 1: 2, 2: 1 }} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('tab', { name: 'Pastas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Carnes' })).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the section id when a pill is clicked', () => {
    const onChange = vi.fn();
    render(
      <SectionPills sections={sections} active="all" counts={{ all: 3, 1: 2, 2: 1 }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Pastas' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('disables a section with zero dishes and does not call onChange when clicked', () => {
    const onChange = vi.fn();
    render(
      <SectionPills sections={sections} active="all" counts={{ all: 2, 1: 2, 2: 0 }} onChange={onChange} />,
    );

    const pastasTab = screen.getByRole('tab', { name: 'Pastas' });
    expect(pastasTab).toBeDisabled();

    fireEvent.click(pastasTab);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the tablist without a visible scrollbar', () => {
    render(
      <SectionPills sections={sections} active="all" counts={{ all: 3, 1: 2, 2: 1 }} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('tablist')).toHaveClass('no-scrollbar');
  });
});
