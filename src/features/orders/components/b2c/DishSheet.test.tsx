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

const dishWithPhoto: Dish = {
  ...dishWithSides,
  id: 3,
  nombre: 'Ensalada César',
  fotoUrl: 'https://example.com/ensalada.jpg',
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

  it('does not focus the notes field when it opens, so the keyboard stays closed', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    // Without sides the notes field is the first focusable control, which Radix autofocuses.
    renderSheet({ dish: dishWithoutSides });

    const notes = await screen.findByLabelText(/nota para la cocina/i);
    expect(notes).not.toHaveFocus();
  });

  it('uses a 16px notes field so iOS does not zoom when the user taps it', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet();

    const notes = await screen.findByLabelText(/nota para la cocina/i);
    expect(notes).toHaveClass('text-base');
  });

  it('shows the photo at its full 4:3 ratio, without a viewport-height cap (the sheet scrolls instead)', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet({ dish: dishWithPhoto });

    const photo = await screen.findByRole('img', { name: /ensalada césar/i });
    const frame = photo.parentElement!;
    expect(frame.className).toContain('aspect-[4/3]');
    expect(frame.className).not.toContain('max-h-[40vh]');
  });

  it('renders as a dialog with the dish name and description, without the lunch cost', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet();

    expect(await screen.findByRole('dialog', { name: /tira de asado/i })).toBeInTheDocument();
    expect(screen.getByText('Tira de asado a la parrilla.')).toBeInTheDocument();
    // El costo en almuerzos solo se muestra en el resumen final del pedido.
    expect(screen.queryByText(/usa \d+ almuerzo/i)).not.toBeInTheDocument();
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

  /**
   * F8.1: la hoja no mostraba la foto del plato — el usuario lo notó al
   * probar la app ("no se ve la imagen en el detalle"). Igual que
   * `DishDetailDialog`/`DishCard`: foto si `dish.fotoUrl` existe.
   */
  it('shows the dish photo as an image with the dish name as alt text', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet({ dish: dishWithPhoto });

    const img = await screen.findByRole('img', { name: dishWithPhoto.nombre });
    expect(img).toHaveAttribute('src', dishWithPhoto.fotoUrl);
  });

  it('shows the plate placeholder and no img when the dish has no photo', async () => {
    vi.mocked(getDishPreference).mockResolvedValue(null);
    renderSheet();

    await screen.findByRole('dialog', { name: /tira de asado/i });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when there is no dish', () => {
    const { container } = render(
      <DishSheet dish={null} open={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Corrección F7.1: `getDishPreference` no tenía `.catch` — un fallo de red
   * quedaba como unhandled rejection. La preferencia es opcional: la hoja
   * debe seguir funcionando igual.
   */
  it('stays usable when the preference request fails, with no unhandled rejection', async () => {
    vi.mocked(getDishPreference).mockRejectedValue(new Error('network down'));
    const { onConfirm } = renderSheet();

    expect(await screen.findByRole('dialog', { name: /tira de asado/i })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('radio', { name: /papas fritas/i }));
    fireEvent.click(screen.getByRole('button', { name: /agregar al pedido/i }));

    expect(onConfirm).toHaveBeenCalledWith({ sideId: 10, notas: null });
  });

  /**
   * Corrección F7.1: una preferencia que llega tarde pisaba la guarnición
   * que el usuario ya había elegido a mano. Se rastrea con un flag "tocado"
   * para no aplicar la preferencia una vez que el usuario eligió.
   */
  it('keeps the side the user picked before the preference resolves', async () => {
    let resolvePreference: (value: { sideId: number; sideNombre: string; notas: string | null }) => void;
    vi.mocked(getDishPreference).mockReturnValue(
      new Promise((resolve) => {
        resolvePreference = resolve;
      }),
    );
    renderSheet();

    // El usuario elige "Puré rústico" antes de que responda la preferencia.
    fireEvent.click(await screen.findByRole('radio', { name: /puré rústico/i }));
    expect(screen.getByRole('radio', { name: /puré rústico/i })).toHaveAttribute('aria-checked', 'true');

    resolvePreference!({ sideId: 10, sideNombre: 'Papas fritas', notas: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // La preferencia (Papas fritas) no pisa la elección manual.
    expect(screen.getByRole('radio', { name: /puré rústico/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /papas fritas/i })).toHaveAttribute('aria-checked', 'false');
  });
});
