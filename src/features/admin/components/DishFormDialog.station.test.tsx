import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DishFormDialog } from './DishFormDialog';
import {
  createDish, listCategories, listMenuSectionsAdmin, listSidesAdmin, updateDish,
  type AdminDish,
} from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/services/adminApi', () => ({
  createDish: vi.fn(),
  updateDish: vi.fn(),
  listCategories: vi.fn(),
  listSidesAdmin: vi.fn(),
  listMenuSectionsAdmin: vi.fn(),
}));
vi.mock('@/features/admin/components/DishPhotoUploader', () => ({
  DishPhotoUploader: () => null,
}));

// Radix radio/select measure their controls; jsdom has no ResizeObserver.
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const dish: AdminDish = {
  id: 7,
  nombre: 'Vacío',
  descripcion: null,
  fotoUrl: null,
  category: { id: 1, nombre: 'Clásico', parentId: null, creditCost: 1 },
  menuSection: { id: 2, nombre: 'Carnes', ordenDisplay: 1 },
  sideType: null,
  allowedSides: [],
  stockDiarioDefault: 10,
  stockActual: 10,
  enabled: true,
  especial: false,
  station: 'COCINA',
};

function renderDialog(editing: AdminDish | null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DishFormDialog open onClose={vi.fn()} editing={editing} />
    </QueryClientProvider>,
  );
}

describe('DishFormDialog station', () => {
  beforeEach(() => {
    vi.mocked(listCategories).mockResolvedValue([]);
    vi.mocked(listMenuSectionsAdmin).mockResolvedValue([]);
    vi.mocked(listSidesAdmin).mockResolvedValue([]);
    vi.mocked(createDish).mockReset();
    vi.mocked(updateDish).mockReset();
  });

  it('defaults a new dish to Cocina', () => {
    renderDialog(null);
    expect(screen.getByRole('radio', { name: /^cocina/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /^parrilla/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('explains what each station does', () => {
    renderDialog(null);
    expect(screen.getByText('Estación de preparación')).toBeInTheDocument();
    expect(screen.getByText(/suma un ticket en parrilla, además del de cocina/i)).toBeInTheDocument();
  });

  it('preselects the dish station when editing and sends the changed value explicitly', async () => {
    vi.mocked(updateDish).mockResolvedValue({ ...dish, station: 'COCINA' });
    renderDialog({ ...dish, station: 'PARRILLA' });
    expect(screen.getByRole('radio', { name: /^parrilla/i })).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('radio', { name: /^cocina/i }));
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(updateDish).toHaveBeenCalled());
    expect(vi.mocked(updateDish).mock.calls[0][1]).toEqual(
      expect.objectContaining({ station: 'COCINA' }),
    );
  });
});
