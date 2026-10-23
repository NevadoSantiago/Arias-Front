import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrinterCard } from './PrinterCard';
import { updatePrinter, type PrinterConfig } from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/services/adminApi', () => ({ updatePrinter: vi.fn() }));

const cocina: PrinterConfig = {
  station: 'COCINA', host: '192.168.0.121', port: 9100, updatedAt: '2026-10-23T15:20:00Z',
};
const parrilla: PrinterConfig = {
  station: 'PARRILLA', host: '192.168.0.120', port: 9100, updatedAt: '2026-10-23T15:20:00Z',
};

function renderCard(printer: PrinterConfig) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PrinterCard printer={printer} />
    </QueryClientProvider>,
  );
}

const hostInput = () => screen.getByLabelText('IP de la ticketera');
const portInput = () => screen.getByLabelText('Puerto');
const saveButton = () => screen.getByRole('button', { name: /^guardar/i });

describe('PrinterCard', () => {
  afterEach(() => vi.clearAllMocks());

  it('describes each station rule', () => {
    const { unmount } = renderCard(cocina);
    expect(screen.getByRole('heading', { name: 'Cocina' })).toBeInTheDocument();
    expect(screen.getByText('Imprime todas las comandas.')).toBeInTheDocument();
    expect(screen.getByText('Siempre')).toBeInTheDocument();
    unmount();

    renderCard(parrilla);
    expect(screen.getByRole('heading', { name: 'Parrilla' })).toBeInTheDocument();
    expect(screen.getByText('Imprime solo los pedidos con algún plato de parrilla.')).toBeInTheDocument();
    expect(screen.getByText('Si hay parrilla')).toBeInTheDocument();
  });

  it('starts clean with the saved address and a disabled save button', () => {
    renderCard(cocina);
    expect(hostInput()).toHaveValue('192.168.0.121');
    expect(portInput()).toHaveValue('9100');
    expect(saveButton()).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
  });

  it('shows an inline error and blocks saving for a public address', () => {
    renderCard(cocina);
    fireEvent.change(hostInput(), { target: { value: '8.8.8.8' } });
    expect(screen.getByText(/tiene que ser una ip de la red del local/i)).toBeInTheDocument();
    expect(hostInput()).toHaveAttribute('aria-invalid', 'true');
    expect(saveButton()).toBeDisabled();
  });

  it('shows an inline error and blocks saving for a bad port', () => {
    renderCard(cocina);
    fireEvent.change(portInput(), { target: { value: '70000' } });
    expect(screen.getByText('El puerto es un número entre 1 y 65535.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('discards the edits', () => {
    renderCard(cocina);
    fireEvent.change(hostInput(), { target: { value: '192.168.0.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(hostInput()).toHaveValue('192.168.0.121');
    expect(screen.queryByRole('button', { name: 'Descartar' })).not.toBeInTheDocument();
  });

  it('saves a trimmed host and numeric port, then confirms with the stale-queue note', async () => {
    let resolve!: (row: PrinterConfig) => void;
    vi.mocked(updatePrinter).mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderCard(cocina);

    fireEvent.change(hostInput(), { target: { value: ' 192.168.0.50 ' } });
    fireEvent.change(portInput(), { target: { value: '9101' } });
    fireEvent.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(updatePrinter).toHaveBeenCalledWith('COCINA', { host: '192.168.0.50', port: 9101 });
    expect(hostInput()).toBeDisabled();

    resolve({ ...cocina, host: '192.168.0.50', port: 9101 });

    expect(
      await screen.findByText('Guardado. Las comandas nuevas salen por 192.168.0.50:9101.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/las comandas que ya están en cola salen por la dirección anterior/i))
      .toBeInTheDocument();
    expect(hostInput()).toHaveValue('192.168.0.50');
    expect(hostInput()).toBeEnabled();
  });

  it('keeps the edits and explains the failure, naming the address still in use', async () => {
    vi.mocked(updatePrinter).mockRejectedValueOnce(new Error('boom'));
    renderCard(cocina);

    fireEvent.change(hostInput(), { target: { value: '192.168.0.50' } });
    fireEvent.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'No se pudo guardar. Revisá tu conexión y probá de nuevo; la ticketera sigue usando 192.168.0.121:9100.',
    );
    expect(hostInput()).toHaveValue('192.168.0.50');
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });
});
