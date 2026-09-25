import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DishListItem } from './DishListItem';
import type { Dish } from '../../types';

const dish: Dish = {
  id: 1,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas y ensalada',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null, creditCost: 2 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};

describe('DishListItem (B2C, prototype style)', () => {
  it('renders the dish name and the lunch cost', () => {
    render(<DishListItem dish={dish} onSelect={vi.fn()} />);

    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('Usa 2 almuerzos')).toBeInTheDocument();
  });

  it('shows a low-stock badge for today and lets the dish be selected', () => {
    const onSelect = vi.fn();
    render(<DishListItem dish={{ ...dish, stockActual: 2 }} onSelect={onSelect} />);

    expect(screen.getByText('Últimos 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /milanesa napolitana/i }));
    expect(onSelect).toHaveBeenCalledWith({ ...dish, stockActual: 2 });
  });

  it('shows a "Sin stock" badge for today and does not let an out-of-stock dish be selected', () => {
    const onSelect = vi.fn();
    render(<DishListItem dish={{ ...dish, stockActual: 0 }} onSelect={onSelect} />);

    expect(screen.getByText('Sin stock')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /milanesa napolitana/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides stock badges and stays selectable on a future day (hideStock), even with zero stock', () => {
    const onSelect = vi.fn();
    render(<DishListItem dish={{ ...dish, stockActual: 0 }} onSelect={onSelect} hideStock />);

    expect(screen.queryByText('Sin stock')).not.toBeInTheDocument();
    expect(screen.queryByText(/Últimos/)).not.toBeInTheDocument();

    const button = screen.getByRole('button', { name: /milanesa napolitana/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalled();
  });
});
