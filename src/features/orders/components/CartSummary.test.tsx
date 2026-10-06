import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CartSummary } from './CartSummary';
import type { CartLine } from '../hooks/useCart';
import type { Dish } from '../types';

function makeDish(id: number, nombre: string, creditCost: number): Dish {
  return {
    id,
    nombre,
    descripcion: '',
    fotoUrl: null,
    category: { id: 1, nombre: 'Básico', parentId: null, creditCost },
    menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
    sideType: null,
    allowedSides: [],
    stockActual: 5,
    especial: false,
  };
}

function renderSummary(lines: CartLine[], props: Partial<Parameters<typeof CartSummary>[0]> = {}) {
  const onRemove = vi.fn();
  render(
    <MemoryRouter>
      <CartSummary lines={lines} onRemove={onRemove} {...props} />
    </MemoryRouter>,
  );
  return { onRemove };
}

describe('CartSummary', () => {
  it('shows an empty-cart message when there are no lines', () => {
    renderSummary([]);
    expect(screen.getByText(/todavía no agregaste platos/i)).toBeInTheDocument();
  });

  it('lists the dishes without lunch costs or a total — the cost only lives in the balance box', () => {
    const lines: CartLine[] = [
      { localId: 'a', dish: makeDish(1, 'Milanesa', 2), sideId: null, sideNombre: null, notas: null },
      { localId: 'b', dish: makeDish(2, 'Ensalada', 1), sideId: null, sideNombre: null, notas: null },
    ];

    renderSummary(lines);

    expect(screen.getByText('Milanesa')).toBeInTheDocument();
    expect(screen.getByText('Ensalada')).toBeInTheDocument();
    expect(screen.queryByText(/almuerzo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^total$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });

  it('removes a line when its remove button is clicked', () => {
    const lines: CartLine[] = [
      { localId: 'a', dish: makeDish(1, 'Milanesa', 2), sideId: null, sideNombre: null, notas: null },
    ];
    const { onRemove } = renderSummary(lines);

    fireEvent.click(screen.getByRole('button', { name: /quitar milanesa/i }));

    expect(onRemove).toHaveBeenCalledWith('a');
  });

  it('surfaces insufficient balance as a clear message pointing to buying a pack, not a generic error', () => {
    const lines: CartLine[] = [
      { localId: 'a', dish: makeDish(1, 'Milanesa', 2), sideId: null, sideNombre: null, notas: null },
    ];

    renderSummary(lines, { insufficientBalance: true });

    expect(screen.getByText(/no te alcanzan los almuerzos disponibles/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /comprá un paquete/i });
    expect(link).toHaveAttribute('href', '/credits/packs');
  });
});
