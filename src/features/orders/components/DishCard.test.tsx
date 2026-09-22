import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DishCard } from './DishCard';
import type { Dish } from '../types';

const dish: Dish = {
  id: 1,
  nombre: 'Milanesa napolitana',
  descripcion: 'Con papas fritas y ensalada',
  fotoUrl: null,
  category: { id: 1, nombre: 'Básico', parentId: null },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockActual: 5,
  especial: false,
};

describe('DishCard', () => {
  it('renders the dish name and description', () => {
    render(<DishCard dish={dish} onSelect={vi.fn()} />);

    expect(screen.getByText('Milanesa napolitana')).toBeInTheDocument();
    expect(screen.getByText('Con papas fritas y ensalada')).toBeInTheDocument();
  });

  it('calls onSelect with the dish when clicked and stock is available', () => {
    const onSelect = vi.fn();
    render(<DishCard dish={dish} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /milanesa napolitana/i }));

    expect(onSelect).toHaveBeenCalledWith(dish);
  });

  it('disables the card and does not call onSelect when there is no stock', () => {
    const onSelect = vi.fn();
    render(<DishCard dish={{ ...dish, stockActual: 0 }} onSelect={onSelect} />);

    const button = screen.getByRole('button', { name: /milanesa napolitana/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onSelect).not.toHaveBeenCalled();
  });
});
