import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewPromptCard } from './ReviewPromptCard';
import { reviewSnoozeKey } from '@/features/me/hooks/useReviewPrompt';
import { getReviewPrompt, markReviewNever, markReviewOpened } from '@/features/me/services/meApi';

vi.mock('@/features/me/services/meApi', () => ({
  getReviewPrompt: vi.fn(),
  markReviewOpened: vi.fn(),
  markReviewNever: vi.fn(),
}));

const prompt = { show: true, dishName: 'Milanesa napolitana', reviewUrl: 'https://g.page/r/arias/review' };

function renderCard(userId = 7) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewPromptCard userId={userId} />
    </QueryClientProvider>,
  );
}

describe('ReviewPromptCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getReviewPrompt).mockResolvedValue(prompt);
    vi.mocked(markReviewOpened).mockResolvedValue(undefined);
    vi.mocked(markReviewNever).mockResolvedValue(undefined);
  });
  afterEach(() => vi.clearAllMocks());

  it('asks about the dish and offers the three actions', async () => {
    renderCard();

    expect(await screen.findByText('¿Qué tal estuvo tu Milanesa napolitana?')).toBeInTheDocument();
    expect(screen.getByText('Contanos en Google, nos ayuda mucho.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dejar mi opinión/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nunca' })).toBeInTheDocument();
  });

  it('says "almuerzo" when there is no dish name', async () => {
    vi.mocked(getReviewPrompt).mockResolvedValue({ ...prompt, dishName: null });
    renderCard();

    expect(await screen.findByText('¿Qué tal estuvo tu almuerzo?')).toBeInTheDocument();
  });

  it('renders nothing when show is false', async () => {
    vi.mocked(getReviewPrompt).mockResolvedValue({ show: false, dishName: null, reviewUrl: null });
    const { container } = renderCard();

    await waitFor(() => expect(getReviewPrompt).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('"Dejar mi opinión" opens Google in a new tab, marks it opened and hides the card', async () => {
    renderCard();

    const link = await screen.findByRole('link', { name: /dejar mi opinión/i });
    expect(link).toHaveAttribute('href', prompt.reviewUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(link);

    await waitFor(() => expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument());
    expect(markReviewOpened).toHaveBeenCalledTimes(1);
  });

  it('"Ahora no" hides it for 24 h on this device and calls no API', async () => {
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem(reviewSnoozeKey(7))).not.toBeNull();
    expect(markReviewOpened).not.toHaveBeenCalled();
    expect(markReviewNever).not.toHaveBeenCalled();
  });

  it('stays hidden during the 24 h snooze and returns after it', async () => {
    window.localStorage.setItem(reviewSnoozeKey(7), String(Date.now() - 3_600_000));
    const { container, unmount } = renderCard();
    await waitFor(() => expect(getReviewPrompt).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    window.localStorage.setItem(reviewSnoozeKey(7), String(Date.now() - 25 * 3_600_000));
    renderCard();
    expect(await screen.findByText(/qué tal estuvo/i)).toBeInTheDocument();
  });

  it('"Nunca" marks it never and hides it for good, even if the request fails', async () => {
    vi.mocked(markReviewNever).mockRejectedValue(new Error('network'));
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Nunca' }));

    expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument();
    await waitFor(() => expect(markReviewNever).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument();
  });

  it('does not reuse a cached prompt from another user in the same client', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <ReviewPromptCard userId={7} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('¿Qué tal estuvo tu Milanesa napolitana?')).toBeInTheDocument();

    vi.mocked(getReviewPrompt).mockResolvedValue({ show: true, dishName: 'Flan', reviewUrl: prompt.reviewUrl });
    rerender(
      <QueryClientProvider client={client}>
        <ReviewPromptCard userId={8} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('¿Qué tal estuvo tu Flan?')).toBeInTheDocument();
  });

  it('still works when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderCard();

    fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }));

    expect(screen.queryByText(/qué tal estuvo/i)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
