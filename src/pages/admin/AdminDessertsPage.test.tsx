import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDessertsPage } from './AdminDessertsPage';
import {
  createDessert, disableDessert, enableDessert, listDessertsAdmin, updateDessert,
  type AdminDessert,
} from '@/features/admin/services/dessertsApi';

vi.mock('@/features/admin/services/dessertsApi', () => ({
  listDessertsAdmin: vi.fn(),
  createDessert: vi.fn(),
  updateDessert: vi.fn(),
  enableDessert: vi.fn(),
  disableDessert: vi.fn(),
}));
vi.mock('@/features/admin/components/DishPhotoUploader', () => ({
  DishPhotoUploader: ({ onChange }: { onChange: (u: string | null) => void }) => (
    <button type="button" onClick={() => onChange('https://cdn/foto.webp')}>mock-subir-foto</button>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const flan: AdminDessert = {
  id: 1, nombre: 'Flan', descripcion: 'Con dulce de leche', fotoUrl: null,
  stockDiarioDefault: 10, stockActual: 4, enabled: true,
};
const brownie: AdminDessert = {
  id: 2, nombre: 'Brownie', descripcion: null, fotoUrl: 'https://cdn/b.webp',
  stockDiarioDefault: 6, stockActual: 0, enabled: false,
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AdminDessertsPage />
    </QueryClientProvider>,
  );
}

describe('AdminDessertsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(listDessertsAdmin).mockResolvedValue([flan, brownie]);
    vi.mocked(createDessert).mockResolvedValue({ ...flan, id: 3, nombre: 'Tiramisú' });
    vi.mocked(updateDessert).mockResolvedValue(flan);
    vi.mocked(enableDessert).mockResolvedValue();
    vi.mocked(disableDessert).mockResolvedValue();
  });

  it('lists desserts with today stock over the daily stock and the status', async () => {
    renderPage();
    const table = await screen.findByRole('table');
    const flanRow = within(table).getByText('Flan').closest('tr')!;
    expect(within(flanRow).getByText('Con dulce de leche')).toBeInTheDocument();
    expect(within(flanRow).getByText('4')).toBeInTheDocument();
    expect(within(flanRow).getByText('/ 10')).toBeInTheDocument();
    expect(within(flanRow).getByText('Activo')).toBeInTheDocument();
    const brownieRow = within(table).getByText('Brownie').closest('tr')!;
    expect(within(brownieRow).getByText('Inactivo')).toBeInTheDocument();
  });

  it('shows the "Visible en el menú" switch off and disabled with its hint', async () => {
    renderPage();
    await screen.findByRole('table');
    const sw = screen.getByRole('switch', { name: /visible en el menú/i });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Próximamente: vender postres en pesos desde el menú.')).toBeInTheDocument();
  });

  it('creates a dessert with name, description, photo and daily stock', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /nuevo postre/i }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tiramisú' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Con café' } });
    fireEvent.click(screen.getByRole('button', { name: 'mock-subir-foto' }));
    fireEvent.change(screen.getByLabelText('Stock diario'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Stock diario'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(createDessert).toHaveBeenCalledWith({
      nombre: 'Tiramisú', descripcion: 'Con café', fotoUrl: 'https://cdn/foto.webp', stockDiarioDefault: 8,
    }));
    expect(await screen.findByText('Postre creado.')).toBeInTheDocument();
  });

  it('edits a dessert without sending today stock', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Editar Flan' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue('Flan');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Flan casero' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateDessert).toHaveBeenCalledWith(1, {
      nombre: 'Flan casero', descripcion: 'Con dulce de leche', stockDiarioDefault: 10, enabled: true,
    }));
    expect(await screen.findByText('Cambios guardados.')).toBeInTheDocument();
  });

  it('disables an active dessert and enables an inactive one', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar Flan' }));
    await waitFor(() => expect(disableDessert).toHaveBeenCalledWith(1));
    fireEvent.click(screen.getByRole('button', { name: 'Activar Brownie' }));
    await waitFor(() => expect(enableDessert).toHaveBeenCalledWith(2));
  });

  it('validates the name and the stock before calling the API', async () => {
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /nuevo postre/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá el nombre del postre')).toBeInTheDocument();
    expect(createDessert).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tiramisú' } });
    fireEvent.change(screen.getByLabelText('Stock diario'), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Ingresá un stock diario de 0 o más')).toBeInTheDocument();
    expect(createDessert).not.toHaveBeenCalled();
  });

  it('shows the server error when saving fails', async () => {
    vi.mocked(createDessert).mockRejectedValue(new Error('stockDiarioDefault must be >= 0'));
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: /nuevo postre/i }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tiramisú' } });
    fireEvent.change(screen.getByLabelText('Stock diario'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('stockDiarioDefault must be >= 0');
  });
});
