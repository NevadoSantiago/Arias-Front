import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement matchMedia or IntersectionObserver — polyfilled
// here (not in production code) so any component using them (e.g.
// `useScrollReveal`, reused unmodified by the landing split) can render
// under Vitest without throwing.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList;
}

// Cast to an untyped record — `Window`/`globalThis` already declare
// `IntersectionObserver` as always present, which would narrow the runtime
// presence check below to `never` and make TS reject the assignment.
const globalWithIO = globalThis as unknown as { IntersectionObserver?: typeof IntersectionObserver };

if (!globalWithIO.IntersectionObserver) {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: ReadonlyArray<number> = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalWithIO.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

afterEach(() => {
  cleanup();
});
