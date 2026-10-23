import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminPrintersPage } from './AdminPrintersPage';
import {
  getPrintAgentStatus, listPrinters, type PrintAgentStatus,
} from '@/features/admin/services/adminApi';

vi.mock('@/features/admin/services/adminApi', () => ({
  listPrinters: vi.fn(),
  updatePrinter: vi.fn(),
  getPrintAgentStatus: vi.fn(),
}));

const printers = [
  { station: 'COCINA' as const, host: '192.168.0.121', port: 9100, updatedAt: '2026-10-23T15:20:00Z' },
  { station: 'PARRILLA' as const, host: '192.168.0.120', port: 9100, updatedAt: '2026-10-23T15:20:00Z' },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminPrintersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function agent(status: PrintAgentStatus) {
  vi.mocked(getPrintAgentStatus).mockResolvedValue(status);
}

describe('AdminPrintersPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T16:00:00Z'));
    vi.mocked(listPrinters).mockResolvedValue(printers);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the agent as online with the last contact time', async () => {
    agent({ lastSeenAt: '2026-10-23T15:31:05Z', online: true });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Ticketera en línea' })).toBeInTheDocument();
    expect(screen.getByText(/último contacto: hoy 12:31:05/i)).toBeInTheDocument();
    expect(screen.getByText(/cuenta como en línea si consultó en los últimos 30 s/i)).toBeInTheDocument();
  });

  it('shows the agent as offline since its last contact', async () => {
    agent({ lastSeenAt: '2026-10-23T15:20:47Z', online: false });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Sin conexión desde 12:20' })).toBeInTheDocument();
    expect(screen.getByText(/las comandas quedan en cola y salen solas cuando vuelva/i)).toBeInTheDocument();
  });

  it('handles an agent that never connected', async () => {
    agent({ lastSeenAt: null, online: false });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeInTheDocument();
    expect(screen.getByText(/último contacto: nunca/i)).toBeInTheDocument();
  });

  it('refetches the agent status on "Volver a consultar"', async () => {
    agent({ lastSeenAt: '2026-10-23T15:31:05Z', online: true });
    renderPage();
    await screen.findByRole('heading', { name: 'Ticketera en línea' });
    expect(getPrintAgentStatus).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Volver a consultar' }));
    await waitFor(() => expect(getPrintAgentStatus).toHaveBeenCalledTimes(2));
  });

  it('renders one card per printer, COCINA first, plus the how-it-works strip', async () => {
    agent({ lastSeenAt: null, online: false });
    renderPage();
    const forms = await screen.findAllByRole('form');
    expect(forms).toHaveLength(2);
    expect(within(forms[0]).getByRole('heading', { name: 'Cocina' })).toBeInTheDocument();
    expect(within(forms[1]).getByRole('heading', { name: 'Parrilla' })).toBeInTheDocument();
    expect(within(forms[0]).getByLabelText('IP de la ticketera')).toHaveValue('192.168.0.121');

    expect(screen.getByRole('heading', { name: 'Cómo sale una comanda' })).toBeInTheDocument();
    expect(screen.getByText('Cocina, siempre')).toBeInTheDocument();
    expect(screen.getByText('Parrilla, si hace falta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'plato' })).toHaveAttribute('href', '/admin/dishes');
    expect(screen.getByRole('link', { name: 'tablero' })).toHaveAttribute('href', '/admin/dashboard');
  });
});
