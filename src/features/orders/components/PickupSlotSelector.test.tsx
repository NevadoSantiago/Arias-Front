import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PickupSlotSelector } from './PickupSlotSelector';
import { getPickupSlots } from '../services/ordersApi';

vi.mock('../services/ordersApi', () => ({
  getPickupSlots: vi.fn(),
}));

function renderWithClient(onSelect = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PickupSlotSelector fecha="2026-05-21" selected={null} onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return { onSelect };
}

describe('PickupSlotSelector', () => {
  it('renders exactly the slots the backend returns — never more, never generated client-side', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([
      '2026-05-21T15:00:00Z',
      '2026-05-21T15:15:00Z',
    ]);

    renderWithClient();

    const buttons = await screen.findAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(getPickupSlots).toHaveBeenCalledWith('2026-05-21');
  });

  it('shows a clear message instead of inventing slots when the backend returns none', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce([]);

    renderWithClient();

    expect(
      await screen.findByText(/no hay horarios de retiro disponibles/i),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('calls onSelect with the exact backend-provided instant, unmodified', async () => {
    vi.mocked(getPickupSlots).mockResolvedValueOnce(['2026-05-21T15:00:00Z']);
    const { onSelect } = renderWithClient();

    const button = await screen.findByRole('button');
    fireEvent.click(button);

    expect(onSelect).toHaveBeenCalledWith('2026-05-21T15:00:00Z');
  });
});
