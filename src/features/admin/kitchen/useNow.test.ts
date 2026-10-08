import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { CLOCK_TICK_MS, useNow } from './useKitchenBoard';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks exactly when the minute changes, not a fixed interval after mounting', () => {
    vi.setSystemTime(new Date('2026-10-07T12:00:45'));
    const { result } = renderHook(() => useNow(CLOCK_TICK_MS));

    act(() => {
      vi.advanceTimersByTime(14_000);
    });
    expect(result.current.getMinutes()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.getMinutes()).toBe(1);
  });

  it('keeps ticking on every following minute', () => {
    vi.setSystemTime(new Date('2026-10-07T12:00:45'));
    const { result } = renderHook(() => useNow(CLOCK_TICK_MS));

    act(() => {
      vi.advanceTimersByTime(15_000 + 60_000 * 2);
    });
    expect(result.current.getMinutes()).toBe(3);
  });
});
