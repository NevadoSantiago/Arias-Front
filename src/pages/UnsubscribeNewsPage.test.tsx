import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UnsubscribeNewsPage } from './UnsubscribeNewsPage';
import { unsubscribeNews } from '@/features/me/services/meApi';

vi.mock('@/features/me/services/meApi', () => ({ unsubscribeNews: vi.fn() }));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <UnsubscribeNewsPage />
    </MemoryRouter>,
  );
}

describe('UnsubscribeNewsPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('unsubscribes with the token from the link and confirms with the email', async () => {
    vi.mocked(unsubscribeNews).mockResolvedValue({ email: 'ana@example.com' });
    renderAt('/unsubscribe-news?t=abc123');

    expect(await screen.findByText('Listo')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText(/novedades y promociones/i)).toBeInTheDocument();
    expect(unsubscribeNews).toHaveBeenCalledWith('abc123');
  });

  it('shows the invalid-link state without calling the API when there is no token', async () => {
    renderAt('/unsubscribe-news');

    expect(await screen.findByText('No pudimos hacerlo')).toBeInTheDocument();
    expect(screen.getByText('Link inválido')).toBeInTheDocument();
    expect(unsubscribeNews).not.toHaveBeenCalled();
  });

  it('shows the error state when the server rejects the token', async () => {
    vi.mocked(unsubscribeNews).mockRejectedValue(new Error('invalid-token'));
    renderAt('/unsubscribe-news?t=bad');

    expect(await screen.findByText('No pudimos hacerlo')).toBeInTheDocument();
    expect(screen.getByText(/link es inválido o vencido/i)).toBeInTheDocument();
  });
});
