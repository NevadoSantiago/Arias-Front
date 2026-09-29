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
    // En orden inverso al de instalación: primero el spy, después el helper.
    vi.restoreAllMocks();
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
    media = mockMatchMedia(false);
    const spy = vi.spyOn(window, 'matchMedia');
    render(<DesktopProbe />);
    expect(spy).toHaveBeenCalledWith('(min-width: 1024px)');
  });

  it('subscribes once per query, not on every render', () => {
    media = mockMatchMedia(false);
    const add = vi.fn();
    const base = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const mql = base(query);
      mql.addEventListener = add;
      return mql;
    });

    const { rerender } = render(<Probe query="(min-width: 1024px)" />);
    rerender(<Probe query="(min-width: 1024px)" />);
    rerender(<Probe query="(min-width: 1024px)" />);

    expect(add).toHaveBeenCalledTimes(1);
  });
});
