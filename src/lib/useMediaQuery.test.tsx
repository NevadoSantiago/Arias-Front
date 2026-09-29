import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { mockMatchMedia } from '@/test/matchMedia';
import { useIsDesktop, useMediaQuery } from './useMediaQuery';

function Probe({ query }: { query: string }) {
  return <span>{useMediaQuery(query) ? 'match' : 'no-match'}</span>;
}

function DesktopProbe() {
  return <span>{useIsDesktop() ? 'match' : 'no-match'}</span>;
}

describe('useMediaQuery', () => {
  let media: ReturnType<typeof mockMatchMedia> | null = null;
  afterEach(() => {
    media?.restore();
    media = null;
  });

  it('reads the current match synchronously and follows changes', () => {
    media = mockMatchMedia(false);
    render(<Probe query="(min-width: 1024px)" />);
    expect(screen.getByText('no-match')).toBeInTheDocument();

    act(() => media!.set(true));

    expect(screen.getByText('match')).toBeInTheDocument();
  });

  it('useIsDesktop is the lg breakpoint (>= 1024px)', () => {
    const spy = vi.fn(window.matchMedia);
    window.matchMedia = spy as unknown as typeof window.matchMedia;
    render(<DesktopProbe />);
    expect(spy).toHaveBeenCalledWith('(min-width: 1024px)');
  });
});
