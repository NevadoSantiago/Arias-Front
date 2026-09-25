import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WalletBalance } from './WalletBalance';
import { getWallet } from '../services/creditsApi';

vi.mock('../services/creditsApi', () => ({
  getWallet: vi.fn(),
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WalletBalance />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WalletBalance', () => {
  it('shows AVAILABLE (center number + legend) and COMMITTED (legend) as two separate figures, never summed, never "créditos"', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 5,
      committed: 2,
      expiresAt: null,
    });

    renderWithClient();

    // El número grande del centro del anillo y la leyenda repiten "5".
    expect(await screen.findAllByText('5')).toHaveLength(2);
    expect(screen.getByText('Disponibles')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Reservados')).toBeInTheDocument();
    // No debe aparecer un total combinado (ej. "7") en ningún lado.
    expect(screen.queryByText('7')).not.toBeInTheDocument();
    expect(screen.queryByText(/crédito/i)).not.toBeInTheDocument();
  });

  it('uses the singular legend for exactly 1 available / 1 committed', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 1,
      committed: 1,
      expiresAt: null,
    });

    renderWithClient();

    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Reservado')).toBeInTheDocument();
  });

  it('shows a single "Vencen el <fecha>" line when the wallet reports an expiry', async () => {
    const expiresAt = '2026-12-25T00:00:00Z';
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 3,
      committed: 0,
      expiresAt,
    });

    renderWithClient();

    // Formateada en la hora LOCAL del entorno donde corre la suite — igual
    // que hace el propio componente (`toLocaleDateString`).
    const expected = new Date(expiresAt).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    expect(await screen.findByText(/vencen el/i)).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('hides the expiry line entirely when the wallet reports none', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 3,
      committed: 0,
      expiresAt: null,
    });

    renderWithClient();

    await screen.findByText('Disponibles');
    expect(screen.queryByText(/vencen el/i)).not.toBeInTheDocument();
  });

  it('links "Comprar más almuerzos" to /credits/packs', async () => {
    vi.mocked(getWallet).mockResolvedValueOnce({
      available: 3,
      committed: 0,
      expiresAt: null,
    });

    renderWithClient();

    const link = await screen.findByRole('link', { name: /comprar más almuerzos/i });
    expect(link).toHaveAttribute('href', '/credits/packs');
  });
});
