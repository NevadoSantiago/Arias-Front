import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DishSheet } from './DishSheet';
import { getDishPreference } from '../../services/ordersApi';
import type { Dish } from '../../types';

vi.mock('../../services/ordersApi', () => ({
  getDishPreference: vi.fn(),
}));

const dishWithSides: Dish = {
  id: 1,
  nombre: 'Tira de Asado',
  descripcion: 'Tira de asado a la parrilla.',
  fotoUrl: null,
  category: { id: 1, nombre: 'Premium', parentId: null, creditCost: 1 },
  menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: 'GUARNICION',
  allowedSides: [
    { id: 10, nombre: 'Papas fritas', tipo: 'GUARNICION', enabled: true },
    { id: 11, nombre: 'Puré rústico', tipo: 'GUARNICION', enabled: true },
  ],
  stockActual: 5,
  especial: true,
};

const dishWithoutSides: Dish = {
  ...dishWithSides,
  id: 2,
  nombre: 'Tortilla de Papa',
  sideType: null,
  allowedSides: [],
};

function renderSheet(props: Partial<Parameters<typeof DishSheet>[0]> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(
    <DishSheet dish={dishWithSides} open={true} onClose={onClose} onConfirm={onConfirm} {...props} />,
  );
  return { onClose, onConfirm };
}

describe('DishSheet', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders as a dialog with the dish name, description and cost in "almuerzos"', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet();

    expect(await screen.findByRole('dialog', { name: /tira de asado/i })).toBeInTheDocument();
    expect(screen.getByText('Tira de asado a la parrilla.')).toBeInTheDocument();
    // Aparece dos veces: la insignia de costo y el botón "Agregar al pedido".
    expect(screen.getAllByText('Usa 1 almuerzo')).toHaveLength(2);
  });

  it('requires a side choice before confirming, when the dish has sides', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    const { onConfirm } = renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /agregar al pedido/i }));

    expect(await screen.findByText(/tenés que elegir/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the chosen side id and the trimmed note', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    const { onConfirm } = renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /papas fritas/i }));
    fireEvent.change(screen.getByLabelText(/nota para la cocina/i), { target: { value: '  sin sal  ' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));

    expect(onConfirm).toHaveBeenCalledWith({ sideId: 10, notas: 'sin sal' });
  });

  it('maps the "sin guarnición" option to a null side id', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    const { onConfirm } = renderSheet();

    fireEvent.click(await screen.findByRole('radio', { name: /sin guarnición/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));

    expect(onConfirm).toHaveBeenCalledWith({ sideId: null, notas: null });
  });

  it('shows no side picker and a "sin acompañamiento" note for a dish without sides', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    const { onConfirm } = renderSheet({ dish: dishWithoutSides });

    expect(await screen.findByText(/va sin acompañamiento/i)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));
    expect(onConfirm).toHaveBeenCalledWith({ sideId: null, notas: null });
  });

  it('closes when the close button is clicked', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    const { onClose } = renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /^cerrar$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when there is no dish', () => {
    const { container } = render(
      <DishSheet dish={null} open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
