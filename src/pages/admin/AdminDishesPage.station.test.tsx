import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDishesPage } from './AdminDishesPage';
import {
  listCategories, listDishesAdmin, listMenuSectionsAdmin, type AdminDish,
} from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/services/adminApi', () => ({
  listDishesAdmin: vi.fn(),
  listCategories: vi.fn(),
  listMenuSectionsAdmin: vi.fn(),
  disableDish: vi.fn(),
  enableDish: vi.fn(),
  archiveDish: vi.fn(),
  getDishAffectedOrders: vi.fn(),
}));
vi.mock('@/features/admin/components/DishFormDialog', () => ({ DishFormDialog: () => null }));

function makeDish(id: number, nombre: string, station: AdminDish['station']): AdminDish {
  return {
    id, nombre, descripcion: null, fotoUrl: null,
    category: { id: 1, nombre: 'Clásico', parentId: null, creditCost: 1 },
    menuSection: { id: 1, nombre: 'Carnes', ordenDisplay: 1 },
    sideType: null, allowedSides: [], stockDiarioDefault: 10, stockActual: 10,
    enabled: true, especial: false, station,
  };
}

describe('AdminDishesPage station column', () => {
  beforeEach(() => {
    vi.mocked(listDishesAdmin).mockResolvedValue([
      makeDish(1, 'Bife', 'COCINA'),
      makeDish(2, 'Vacío', 'PARRILLA'),
    ]);
    vi.mocked(listCategories).mockResolvedValue([]);
    vi.mocked(listMenuSectionsAdmin).mockResolvedValue([]);
  });

  it('renders an Estación column with a badge per dish and a station filter', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminDishesPage />
      </QueryClientProvider>,
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Estación' })).toBeInTheDocument();
    expect(within(table).getByText('Parrilla')).toBeInTheDocument();
    expect(within(table).getByText('Cocina')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /estación/i })).toBeInTheDocument();
  });
});
